/**
 * WhatsApp Connection API Routes
 * Handles QR code generation, connection status, and reconnection
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { whatsappManager, QRCodeData } from '../../core/transport/multi-socket-manager';
import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { SetupRepository } from '../../db/repositories/setup.repo';

const router = Router();

interface SchoolInfo {
    id: string;
    name: string;
    admin_phone: string;
    whatsapp_number?: string;
    whatsapp_connection_status: string;
    connected_whatsapp_jid?: string;
    qr_refresh_count: number;
    qr_refresh_locked_until?: string;
    setup_status?: string;
}

/**
 * GET /api/whatsapp/status/:schoolId
 * Get WhatsApp connection status for a school
 */
router.get('/status/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;

        const school: SchoolInfo = await new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT id, name, admin_phone, whatsapp_number, whatsapp_connection_status, connected_whatsapp_jid, 
                        qr_refresh_count, qr_refresh_locked_until, setup_status
                 FROM schools WHERE id = ?`,
                [schoolId],
                (err, row: any) => {
                    if (err) reject(err);
                    else resolve(row as SchoolInfo);
                }
            );
        });

        if (!school) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        // Get real-time connection state from manager
        const realTimeState = whatsappManager.getConnectionState(schoolId);

        // Check if locked
        const isLocked = school.qr_refresh_locked_until
            ? new Date(school.qr_refresh_locked_until) > new Date()
            : false;

        let lockedUntil = undefined;
        if (isLocked && school.qr_refresh_locked_until) {
            lockedUntil = new Date(school.qr_refresh_locked_until).toISOString();
        }

        // Get setup state
        let setupState = null;
        try {
            setupState = await SetupRepository.getSetupState(schoolId);
        } catch (e) {
            logger.debug({ error: e }, 'Could not fetch setup state');
        }

        res.json({
            success: true,
            data: {
                schoolId: school.id,
                schoolName: school.name,
                status: realTimeState.status || school.whatsapp_connection_status,
                botJid: realTimeState.botJid || school.connected_whatsapp_jid,
                adminPhone: school.admin_phone,
                refreshAttempts: school.qr_refresh_count,
                isLocked,
                lockedUntil,
                isConnected: whatsappManager.isConnected(schoolId),
                connectedAt: realTimeState.connectedAt?.toISOString(),
                setupStatus: school.setup_status || 'PENDING_SETUP',
                setupProgress: setupState ? {
                    currentStep: setupState.current_step,
                    completedSteps: setupState.completed_steps,
                    pendingSteps: setupState.pending_steps,
                    isActive: setupState.is_active
                } : null
            }
        });
    } catch (error: any) {
        logger.error({ error }, 'Failed to get WhatsApp status');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/whatsapp/connect/:schoolId
 * Initiate WhatsApp connection (returns JSON)
 */
router.post('/connect/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;
        console.log(`\n📱 CONNECT REQUEST received for school: ${schoolId}`);
        console.log(`   User: ${(req as any).user?.userId || 'unknown'}`);
        console.log(`   Headers: ${JSON.stringify(req.headers.authorization ? 'Bearer [present]' : 'none')}`);

        // Check if already connected
        if (whatsappManager.isConnected(schoolId)) {
            console.log(`   Status: Already connected`);
            return res.json({
                success: true,
                message: 'Already connected',
                connected: true
            });
        }

        // Get school info to check if exists
        const school: SchoolInfo = await new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT id, name, admin_phone, qr_refresh_locked_until FROM schools WHERE id = ?`,
                [schoolId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row as SchoolInfo);
                }
            );
        });

        if (!school) {
            console.log(`   Error: School not found in database`);
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        // Check if QR generation is locked
        if (school.qr_refresh_locked_until && new Date(school.qr_refresh_locked_until) > new Date()) {
            return res.json({
                success: false,
                locked: true,
                error: 'QR generation is temporarily locked due to too many attempts',
                lockedUntil: school.qr_refresh_locked_until
            });
        }

        // Start connection (non-blocking - it runs asynchronously)
        console.log(`   Starting WhatsApp connection...`);
        whatsappManager.connect(schoolId).then(() => {
            console.log(`   ✅ WhatsApp connect() completed successfully`);
        }).catch(err => {
            console.log(`   ❌ Connection error: ${err.message}`);
            console.log(`   ❌ Stack trace: ${err.stack}`);
            logger.error({ err, schoolId }, 'WhatsApp connection failed');
        });

        // Return success immediately - client should use GET for SSE stream
        console.log(`   ✅ Connection initiated - QR code should generate shortly`);
        return res.json({
            success: true,
            message: 'Connection initiated. Use SSE to receive QR code.'
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.params.schoolId }, 'Failed to start WhatsApp connection');
        res.status(500).json({
            success: false,
            error: error.message,
            locked: error.message.includes('locked')
        });
    }
});

/**
 * POST /api/whatsapp/request-pairing-code/:schoolId
 * Request pairing code for WhatsApp connection (alternative to QR)
 * Body: { phoneNumber: string } - The WhatsApp number to connect (with country code, no +)
 */
router.post('/request-pairing-code/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;
        const { phoneNumber } = req.body;
        
        console.log(`\n📱 PAIRING CODE REQUEST for school: ${schoolId}`);
        console.log(`   Phone number from request: ${phoneNumber}`);

        // Check if already connected
        if (whatsappManager.isConnected(schoolId)) {
            return res.json({
                success: false,
                error: 'Already connected',
                connected: true
            });
        }

        // Validate phone number
        if (!phoneNumber) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phone number is required' 
            });
        }

        // Clean the phone number (remove any non-digits)
        const cleanedPhone = phoneNumber.replace(/\D/g, '');
        
        if (cleanedPhone.length < 8 || cleanedPhone.length > 15) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid phone number format' 
            });
        }

        // Start connection with pairing code using the provided phone number
        console.log(`   Requesting pairing code for: ${cleanedPhone}`);
        
        // Use requestNewPairingCode instead of connect() to ensure fresh state
        whatsappManager.requestNewPairingCode(schoolId, cleanedPhone).catch(err => {
            logger.error({ err, schoolId }, 'WhatsApp pairing code request failed');
        });

        return res.json({
            success: true,
            message: 'Pairing code request initiated',
            phoneNumber: cleanedPhone
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.params.schoolId }, 'Failed to request pairing code');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/whatsapp/connect/:schoolId
 * Stream QR codes via SSE
 */
router.get('/connect/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;

        // Check if already connected
        if (whatsappManager.isConnected(schoolId)) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
            res.write(`data: ${JSON.stringify({ type: 'connected', schoolId })}\n\n`);
            res.end();
            return;
        }

        // Set up SSE for streaming QR codes
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Send initial connection event
        res.write(`data: ${JSON.stringify({ type: 'connecting', schoolId })}\n\n`);

        // Listen for QR codes
        const qrEmitter = whatsappManager.getQREmitter(schoolId);

        const onQR = (data: QRCodeData) => {
            res.write(`data: ${JSON.stringify({ type: 'qr', ...data })}\n\n`);
        };

        const onConnected = (data: { schoolId: string; botJid: string }) => {
            // Update setup status to IN_PROGRESS when connected ONLY IF currently PENDING_SETUP
            try {
                db.getDB().run(
                    `UPDATE schools SET setup_status = 'IN_PROGRESS' WHERE id = ? AND setup_status = 'PENDING_SETUP'`,
                    [schoolId],
                    (err) => {
                        if (err) logger.warn({ err, schoolId }, 'Could not update setup_status');
                    }
                );
            } catch (e) {
                logger.warn({ error: e }, 'Error updating setup_status');
            }

            res.write(`data: ${JSON.stringify({ type: 'connected', ...data })}\n\n`);
            res.end();
        };

        const onLocked = (data: { schoolId: string; lockedUntil: Date }) => {
            res.write(`data: ${JSON.stringify({ type: 'locked', ...data })}
\n`);
            res.end();
        };

        // Handle pairing code events
        const onPairingCode = (data: { schoolId: string; code: string; phoneNumber: string }) => {
            res.write(`data: ${JSON.stringify({ type: 'pairing-code', ...data })}
\n`);
        };

        const onPairingError = (data: { schoolId: string; error: string }) => {
            res.write(`data: ${JSON.stringify({ type: 'pairing-error', ...data })}

`);
            res.end();
        };

        const onPairingCodeExpired = (data: { schoolId: string; code: string; phoneNumber: string; expiredAt: number }) => {
            res.write(`data: ${JSON.stringify({ type: 'pairing-code-expired', ...data })}

`);
            // Don't end connection - let user click "Get New Code"
        };

        qrEmitter.on('qr', onQR);
        qrEmitter.on('connected', onConnected);
        qrEmitter.on('locked', onLocked);
        qrEmitter.on('pairing-code', onPairingCode);
        qrEmitter.on('pairing-error', onPairingError);
        qrEmitter.on('pairing-code-expired', onPairingCodeExpired);

        // Keep connection alive for QR streaming
        const heartbeat = setInterval(() => {
            res.write(`: heartbeat\n\n`);
        }, 30000);

        // Cleanup on client disconnect
        req.on('close', () => {
            clearInterval(heartbeat);
            qrEmitter.removeListener('qr', onQR);
            qrEmitter.removeListener('connected', onConnected);
            qrEmitter.removeListener('locked', onLocked);
            qrEmitter.removeListener('pairing-code', onPairingCode);
            qrEmitter.removeListener('pairing-error', onPairingError);
            qrEmitter.removeListener('pairing-code-expired', onPairingCodeExpired);
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.params.schoolId }, 'Failed to stream QR codes');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/whatsapp/disconnect/:schoolId
 * Disconnect WhatsApp for a school
 */
router.post('/disconnect/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;

        await whatsappManager.disconnect(schoolId);

        // Update database
        await new Promise<void>((resolve) => {
            db.getDB().run(
                `UPDATE schools SET whatsapp_connection_status = 'disconnected' WHERE id = ?`,
                [schoolId],
                () => resolve()
            );
        });

        res.json({ success: true, message: 'Disconnected successfully' });
    } catch (error: any) {
        logger.error({ error }, 'Failed to disconnect');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/whatsapp/reconnect/:schoolId
 * Reset and reconnect (unlocks QR generation)
 */
router.post('/reconnect/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;

        // Disconnect existing connection if any
        await whatsappManager.disconnect(schoolId);

        // Reset QR count and unlock
        await whatsappManager.resetQRCount(schoolId);

        // Update status
        await new Promise<void>((resolve) => {
            db.getDB().run(
                `UPDATE schools SET whatsapp_connection_status = 'disconnected' WHERE id = ?`,
                [schoolId],
                () => resolve()
            );
        });

        res.json({
            success: true,
            message: 'Reconnect ready. Click Connect to generate new QR code.'
        });
    } catch (error: any) {
        logger.error({ error }, 'Failed to prepare reconnect');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/whatsapp/clear-session/:schoolId
 * Clear session and reset for fresh start
 */
router.post('/clear-session/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;

        await whatsappManager.clearSession(schoolId);

        // Update status
        await new Promise<void>((resolve) => {
            db.getDB().run(
                `UPDATE schools SET whatsapp_connection_status = 'disconnected' WHERE id = ?`,
                [schoolId],
                () => resolve()
            );
        });

        res.json({
            success: true,
            message: 'Session cleared. You can now connect with fresh authentication.'
        });
    } catch (error: any) {
        logger.error({ error }, 'Failed to clear session');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/whatsapp/pairing-code-status/:schoolId
 * Check pairing code status (expiration, time remaining)
 */
router.get('/pairing-code-status/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;
        
        const status = whatsappManager.getPairingCodeStatus(schoolId);
        
        res.json({
            success: true,
            data: {
                ...status,
                validityMinutes: 2, // WhatsApp's official timeout
                validityMs: 2 * 60 * 1000
            }
        });
    } catch (error: any) {
        logger.error({ error }, 'Failed to get pairing code status');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/whatsapp/new-pairing-code/:schoolId
 * Generate a new pairing code (invalidates old one)
 * Body: { phoneNumber: string }
 */
router.post('/new-pairing-code/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;
        const { phoneNumber } = req.body;
        
        console.log(`\n🆕 NEW PAIRING CODE REQUEST for school: ${schoolId}`);
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }
        
        // Check if already connected
        if (whatsappManager.isConnected(schoolId)) {
            return res.json({
                success: false,
                error: 'Already connected',
                connected: true
            });
        }
        
        // Clean phone number
        const cleanedPhone = phoneNumber.replace(/\D/g, '');
        
        if (cleanedPhone.length < 8 || cleanedPhone.length > 15) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format'
            });
        }
        
        // Request new pairing code
        const result = await whatsappManager.requestNewPairingCode(schoolId, cleanedPhone);
        
        if (result.success && result.code) {
            console.log(`✅ New pairing code generated: ${result.code}`);
            res.json({
                success: true,
                code: result.code,
                phoneNumber: cleanedPhone,
                expiresAt: result.expiresAt,
                message: 'New pairing code generated. Enter it on your phone within 2 minutes.'
            });
        } else {
            console.log(`❌ Failed to generate pairing code: ${result.error}`);
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to generate pairing code'
            });
        }
        
    } catch (error: any) {
        logger.error({ error }, 'Failed to generate new pairing code');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/whatsapp/reset-qr/:schoolId
 * Reset QR count and lock (for testing)
 */
router.post('/reset-qr/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;

        await new Promise<void>((resolve) => {
            db.getDB().run(
                `UPDATE schools SET qr_refresh_count = 0, qr_refresh_locked_until = NULL WHERE id = ?`,
                [schoolId],
                () => resolve()
            );
        });

        res.json({ success: true, message: 'QR count reset' });
    } catch (error: any) {
        logger.error({ error }, 'Failed to reset QR');
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/refresh-qr/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;

        // Get lock status
        const school: SchoolInfo = await new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT id, qr_refresh_locked_until FROM schools WHERE id = ?`,
                [schoolId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row as SchoolInfo);
                }
            );
        });

        if (!school) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        // Check if QR generation is locked
        if (school.qr_refresh_locked_until && new Date(school.qr_refresh_locked_until) > new Date()) {
            return res.json({
                success: false,
                locked: true,
                error: 'QR generation is temporarily locked due to too many attempts',
                lockedUntil: school.qr_refresh_locked_until
            });
        }

        // Check if connected
        if (whatsappManager.isConnected(schoolId)) {
            return res.json({
                success: false,
                error: 'Already connected. Disconnect first to generate new QR.',
                connected: true
            });
        }

        // Disconnect and reconnect to generate new QR
        await whatsappManager.disconnect(schoolId);
        await new Promise(resolve => setTimeout(resolve, 500));
        await whatsappManager.connect(schoolId);

        res.json({ success: true, message: 'QR code refreshed' });
    } catch (error: any) {
        logger.error({ error }, 'Failed to refresh QR');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/whatsapp/connections
 * Get all active connections (admin only)
 */
router.get('/connections', async (req: Request, res: Response) => {
    try {
        const activeConnections = whatsappManager.getActiveConnections();

        res.json({
            success: true,
            data: {
                activeConnections,
                count: activeConnections.length
            }
        });
    } catch (error: any) {
        logger.error({ error }, 'Failed to get connections');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/whatsapp/setup/complete/:schoolId
 * Mark setup as complete from UI (syncs with SA chat)
 */
router.post('/setup/complete/:schoolId', async (req: Request, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;
        const { step, data } = req.body;

        // Update setup state in database
        if (step) {
            const setupState = await SetupRepository.getSetupState(schoolId);
            const completedSteps = setupState?.completed_steps || [];
            await SetupRepository.updateSetup(schoolId, {
                current_step: step,
                completed_steps: [...completedSteps, step],
                is_active: step !== 'SETUP_COMPLETE'
            });
        }

        // If complete, update school status
        if (step === 'SETUP_COMPLETE' || step === 'OPERATIONAL') {
            await new Promise<void>((resolve) => {
                db.getDB().run(
                    `UPDATE schools SET setup_status = 'OPERATIONAL' WHERE id = ?`,
                    [schoolId],
                    () => resolve()
                );
            });
        }

        res.json({
            success: true,
            message: 'Setup step recorded',
            currentStep: step
        });
    } catch (error: any) {
        logger.error({ error }, 'Failed to update setup');
        res.status(500).json({ success: false, error: error.message });
    }
});

export { router as whatsappRouter };
