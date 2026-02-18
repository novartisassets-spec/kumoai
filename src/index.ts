import { db } from './db';
import { logger } from './utils/logger';
import { whatsappManager } from './core/transport/multi-socket-manager';
import { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

let cleanupService: any = null;

async function gracefulShutdown(signal: string) {
    logger.info({ signal }, 'Received shutdown signal');
    try {
        if (cleanupService) {
            cleanupService.stop();
            logger.info('Cleanup service stopped');
        }
        // Disconnect all WhatsApp connections
        const activeConnections = whatsappManager.getActiveConnections();
        for (const schoolId of activeConnections) {
            await whatsappManager.disconnect(schoolId);
        }
        db.close();
        logger.info('Database connection closed');
        process.exit(0);
    } catch (error) {
        logger.error({ error, signal }, 'Error during shutdown');
        process.exit(1);
    }
}

process.on('uncaughtException', (error: Error) => {
    logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught Exception - Fatal Error');
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error({ reason, stack: reason?.stack }, 'Unhandled Promise Rejection');
});

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

async function main() {
    try {
        logger.info('Starting Kumo System...');

        await db.init();

        // Run WhatsApp connection migration
        try {
            await runWhatsAppMigration();
        } catch (migrationError) {
            logger.warn({ error: migrationError }, 'Migration warning (continuing...)');
        }

        // Check for existing schools
        const schools: any[] = await new Promise((resolve, reject) => {
            db.getDB().all('SELECT * FROM schools', (err, rows: any) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (schools.length === 0) {
            // No school configured - frontend will handle signup
            console.log('\n\n════════════════════════════════════════════════════════════');
            console.log(' NO SCHOOL CONFIGURED - WAITING FOR FRONTEND SIGNUP ');
            console.log('════════════════════════════════════════════════════════════');
            console.log('Start the frontend and sign up to create your school.\n');
        }

        // Show ALL schools in the database
        console.log('\n════════════════════════════════════════════════════════════');
        console.log(' REGISTERED SCHOOLS (' + schools.length + ')');
        console.log('════════════════════════════════════════════════════════════');
        
        for (const school of schools) {
            console.log(`\n📚 ${school.name}`);
            console.log(`   Admin Phone: ${school.admin_phone}`);
            console.log(`   School ID: ${school.id}`);
            console.log(`   WhatsApp Status: ${school.whatsapp_connection_status || 'disconnected'}`);
        }
        
        console.log('\n════════════════════════════════════════════════════════════');
        
        // Auto-reconnect to previously connected schools
        // Check both DB AND session files on disk
        const previouslyConnected = schools.filter(s => {
            const dbConnected = s.connected_whatsapp_jid && s.whatsapp_connection_status === 'connected';
            // Also check if session files exist on disk (same logic as multi-socket-manager)
            const authBaseDir = path.resolve('kumo_auth_info');
            const sessionPath = path.join(authBaseDir, s.id);
            let sessionExists = false;
            try {
                sessionExists = fs.existsSync(sessionPath) && fs.readdirSync(sessionPath).length > 0;
            } catch (e) {
                // Ignore errors
            }
            return dbConnected || sessionExists;
        });
        
        if (previouslyConnected.length > 0) {
            console.log(`\n🔄 Auto-reconnecting to ${previouslyConnected.length} previously connected school(s)...`);
            for (const school of previouslyConnected) {
                console.log(`   ↻ Attempting reconnect for: ${school.name} (${school.id})`);
                try {
                    await whatsappManager.connect(school.id);
                    console.log(`   ✅ Reconnect initiated for: ${school.name}`);
                } catch (err: any) {
                    console.log(`   ❌ Reconnect failed for ${school.name}: ${err.message}`);
                }
            }
        }
        
        console.log('\n👉 Backend ready! Each school can connect their own WhatsApp via the frontend.');
        
        // --- API SERVER ---
        const express = require('express');
        const cors = require('cors');
        const cookieParser = require('cookie-parser');
        const { webhookRouter } = require('./api/webhook-handler');
        const { whatsappRouter } = require('./api/routes/whatsapp');
        const { setupRouter } = require('./api/routes/setup');
        const { authRouter } = require('./api/routes/auth');
        const { dashboardRouter } = require('./api/routes/dashboard');
        const { supportRouter } = require('./api/routes/support');
        const { authenticateToken, requireAdmin } = require('./api/middleware/auth.middleware');

        const app = express();
        const isProduction = process.env.NODE_ENV === 'production';
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
            .split(',')
            .map(o => o.trim())
            .filter(o => o.length > 0);
        
        const corsOptions: cors.CorsOptions = {
            origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
                if (!origin) {
                    return callback(null, true);
                }
                
                if (allowedOrigins.length > 0) {
                    if (allowedOrigins.includes(origin)) {
                        return callback(null, true);
                    }
                    if (isProduction) {
                        return callback(new Error('Not allowed by CORS policy'), false);
                    }
                }
                
                if (!isProduction) {
                    if (origin.startsWith('http://localhost:') || 
                        origin.startsWith('http://127.0.0.1:') ||
                        origin.startsWith('http://192.168.') ||
                        origin.startsWith('http://10.') ||
                        origin.startsWith('http://172.')) {
                        return callback(null, true);
                    }
                }
                
                logger.warn({ origin }, 'CORS BLOCKED - Origin not allowed');
                if (isProduction) {
                    return callback(new Error('Not allowed by CORS policy'), false);
                }
            },
            credentials: true
        };
        app.use(cors(corsOptions));
        app.use(express.json());
        app.use(cookieParser());

        // --- API Routes ---
        
        // 1. Public Routes (No Authentication)
        app.use('/api/webhooks', webhookRouter);
        app.use('/api/auth', authRouter);
        app.use('/api/support', supportRouter);

        // 2. Authentication Middleware (Applies to all routes below)
        app.use('/api', authenticateToken);

        // 3. Protected Routes
        app.use('/api/whatsapp', requireAdmin, whatsappRouter);
        app.use('/api/setup', requireAdmin, setupRouter);
        app.use('/api', dashboardRouter);

        // Health check (Now Protected)
        app.get('/api/health', (req: Request, res: Response) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                activeConnections: whatsappManager.getActiveConnections()
            });
        });

        const PORT = process.env.PORT || 3000;
        const HOST = '0.0.0.0'; // Bind to all interfaces for mobile access
        
        app.listen(Number(PORT), HOST, () => {
            logger.info({ PORT, HOST }, '🚀 Kumo API Server running');
            // Get actual IP for display (useful for frontend connection)
            const os = require('os');
            const interfaces = os.networkInterfaces();
            let localIP = 'localhost';
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('10.')) {
                        localIP = iface.address;
                        break;
                    }
                }
            }
            console.log(`\n📡 API Server: http://${localIP}:${PORT} (Accessible on network)`);
            console.log(`   Update your frontend .env: VITE_API_URL=http://${localIP}:${PORT}/api`);
            console.log(`📱 WhatsApp Connections managed at: /api/whatsapp/*`);
            console.log(`⚙️  School Setup API at: /api/setup/*`);
            console.log(`🔐 Auth API at: /api/auth/*`);
        });
        // ----------------------

        const { getFileCleanupService } = await import('./services/file-cleanup');
        cleanupService = getFileCleanupService();
        cleanupService.start();

        logger.info('Kumo System Running');

    } catch (error: any) {
        logger.error({ error: error?.message, stack: error?.stack }, 'Fatal error starting system');
        process.exit(1);
    }
}

async function runWhatsAppMigration(): Promise<void> {
    return new Promise((resolve, reject) => {
        const dbRef = db.getDB();

        // Add columns one by one, handling existing columns
        const columnsToAdd = [
            { name: 'whatsapp_connection_status', type: 'TEXT DEFAULT "disconnected"' },
            { name: 'qr_refresh_count', type: 'INTEGER DEFAULT 0' },
            { name: 'qr_refresh_locked_until', type: 'DATETIME' },
            { name: 'last_connection_at', type: 'DATETIME' }
        ];

        let pending = columnsToAdd.length;

        for (const col of columnsToAdd) {
            dbRef.run(`ALTER TABLE schools ADD COLUMN ${col.name} ${col.type}`, (err) => {
                // Ignore "duplicate column name" errors
                if (err && !err.message.includes('duplicate column name')) {
                    logger.warn({ error: err, column: col.name }, 'Could not add column');
                }
                pending--;
                if (pending === 0) {
                    createQRHistoryTable(dbRef).then(resolve).catch(reject);
                }
            });
        }

        if (columnsToAdd.length === 0) {
            resolve();
        }
    });
}

async function createQRHistoryTable(dbRef: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbRef.serialize(() => {
            dbRef.run(`
                CREATE TABLE IF NOT EXISTS whatsapp_qr_history (
                    id TEXT PRIMARY KEY,
                    school_id TEXT NOT NULL,
                    qr_generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    connection_status TEXT DEFAULT 'pending',
                    qr_data TEXT,
                    FOREIGN KEY (school_id) REFERENCES schools(id))
            `, (err: Error | null) => {
                if (err) {
                    logger.warn({ error: err }, 'Could not create QR history table');
                }
            });

            dbRef.run(`CREATE INDEX IF NOT EXISTS idx_schools_connection_status ON schools(whatsapp_connection_status)`, () => {});
            dbRef.run(`CREATE INDEX IF NOT EXISTS idx_schools_admin_phone ON schools(admin_phone)`, () => {});
            dbRef.run(`CREATE INDEX IF NOT EXISTS idx_qr_history_school ON whatsapp_qr_history(school_id, qr_generated_at DESC)`, () => {});

            resolve();
        });
    });
}

main();
