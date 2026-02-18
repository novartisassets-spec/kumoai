import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { VoiceOrchestrator } from '../services/voice-orchestrator';
import { embeddingService } from '../core/memory/embedding-service';
import { db } from '../db';
import { messenger } from '../services/messenger';
import { ENV } from '../config/env';
import crypto from 'crypto';

const router = Router();

/**
 * ELEVENLABS WEBHOOK HANDLER
 * Receives post-call summaries and transcripts
 */
router.post('/elevenlabs/voice-summary', async (req: Request, res: Response) => {
    const signature = req.headers['x-elevenlabs-signature-256'];
    const payload = req.body;
    
    // 🛡️ SECURITY: Verify Webhook Signature
    if (ENV.ELEVENLABS_WEBHOOK_SECRET) {
        const hmac = crypto.createHmac('sha256', ENV.ELEVENLABS_WEBHOOK_SECRET);
        const computedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
        
        if (signature !== computedSignature) {
            logger.error({ 
                received: signature, 
                computed: computedSignature 
            }, '⚠️ INVALID WEBHOOK SIGNATURE - Access Denied');
            return res.status(401).send({ error: 'Invalid signature' });
        }
    }

    try {
        logger.info({ conversationId: payload.conversation_id }, '📥 Received ElevenLabs Voice Webhook');

        const conversationId = payload.conversation_id;

        // 🛡️ IDEMPOTENCY: Check if this conversation has already been processed
        const existingSession = await new Promise<any>((resolve) => {
            db.getDB().get(
                `SELECT status FROM voice_sessions WHERE conversation_id = ?`,
                [conversationId],
                (err, row) => resolve(row)
            );
        });

        if (existingSession && existingSession.status === 'completed') {
            logger.warn({ conversationId }, '⚠️ [WEBHOOK] Conversation already processed - skipping');
            return res.status(200).send({ status: 'already_processed' });
        }

        // Extract relevant data from ElevenLabs payload
        // Note: Field names might vary based on ElevenLabs API version/config
        const summary = payload.summary || payload.analysis?.summary;
        const transcript = payload.transcript;
        
        // Metadata we passed during initiation is returned in payload.metadata
        const metadata = payload.metadata;
        let sessionInfo = null;

        if (metadata && metadata.school_id) {
            sessionInfo = {
                schoolId: metadata.school_id,
                userId: metadata.user_id,
                fromPhone: metadata.from_phone
            };
            logger.info({ sessionInfo }, '✅ Identified session via webhook metadata');
        } else {
            // Fallback to DB lookup if metadata is missing
            sessionInfo = await getSessionByConversationId(conversationId);
        }

        if (summary && sessionInfo) {
            const { schoolId, userId, fromPhone } = sessionInfo;

            logger.info({ userId, schoolId }, '🧠 Processing Voice Summary into Long-Term Memory');

            // 1. Store the summary as a Memory Snapshot (Semantic Memory)
            await embeddingService.storeSnapshot(
                schoolId,
                userId || fromPhone,
                `VOICE CALL SUMMARY (${new Date().toLocaleDateString()}): ${summary}`,
                0 // 0 means it's a manual/voice injection
            );

            // 2. Log to History as a system message so the next turn sees it
            const historySql = `
                INSERT INTO message_history (id, school_id, user_id, from_phone, content, sender_role, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            // Using a dummy UUID or similar
            const uuid = require('uuid').v4();
            await new Promise<void>((resolve, reject) => {
                db.getDB().run(historySql, [
                    uuid, 
                    schoolId, 
                    userId, 
                    fromPhone, 
                    `[Voice Call Summary]: ${summary}`, 
                    'system', 
                    new Date().toISOString()
                ], (err) => err ? reject(err) : resolve());
            });

            // 3. Send a follow-up text on WhatsApp (Optional but premium)
            await messenger.sendPush(fromPhone, `Glad we could speak! I've noted down our discussion about: ${summary.substring(0, 100)}...`);

            // 4. Mark as completed for idempotency
            await new Promise<void>((resolve, reject) => {
                db.getDB().run(
                    `UPDATE voice_sessions SET status = 'completed', summary_text = ?, completed_at = CURRENT_TIMESTAMP WHERE conversation_id = ?`,
                    [summary, conversationId],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        res.status(200).send({ status: 'success' });
    } catch (error: any) {
        logger.error({ error: error.message }, '❌ Failed to process voice webhook');
        res.status(500).send({ error: 'Internal server error' });
    }
});

// Helper to retrieve session info (should be implemented in VoiceOrchestrator or similar)
async function getSessionByConversationId(id: string): Promise<any> {
    // In a real implementation, we'd store conversation_id -> session mapping in SQLite
    // For now, returning a mock or looking up the latest active voice session
    return new Promise((resolve) => {
        db.getDB().get(
            `SELECT school_id, user_id, from_phone FROM voice_sessions WHERE conversation_id = ?`,
            [id],
            (err, row) => resolve(row)
        );
    });
}

export const webhookRouter = router;
