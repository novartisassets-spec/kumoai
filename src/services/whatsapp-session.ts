import { db } from '../db';
import { logger } from '../utils/logger';

/**
 * Simple WhatsApp session storage - stores full session as JSON in DB
 * Works with both SQLite and PostgreSQL
 */
export class WhatsAppSessionService {
    /**
     * Save session data to database (simple JSON string)
     */
    async saveSession(schoolId: string, sessionData: any): Promise<void> {
        const sessionStr = JSON.stringify(sessionData);

        try {
            if (db.isSupabase()) {
                await db.run(
                    `INSERT INTO whatsapp_sessions (school_id, auth_data, last_active_at, is_active)
                     VALUES ($1, $2, NOW(), true)
                     ON CONFLICT(school_id) DO UPDATE SET
                     auth_data = $2, last_active_at = NOW(), is_active = true`,
                    [schoolId, sessionStr]
                );
            } else {
                await db.run(
                    `INSERT INTO whatsapp_sessions (school_id, auth_data, last_active_at, is_active)
                     VALUES (?, ?, datetime('now'), 1)
                     ON CONFLICT(school_id) DO UPDATE SET
                     auth_data = ?, last_active_at = datetime('now'), is_active = 1`,
                    [schoolId, sessionStr, sessionStr]
                );
            }
            logger.info({ schoolId }, 'WhatsApp session saved to database');
        } catch (err) {
            logger.error({ err, schoolId }, 'Failed to save WhatsApp session');
        }
    }

    /**
     * Load session from database
     */
    async loadSession(schoolId: string): Promise<any> {
        try {
            const row = await db.get(
                'SELECT auth_data FROM whatsapp_sessions WHERE school_id = ?',
                [schoolId]
            );

            if (!row || !row.auth_data) return null;

            try {
                return JSON.parse(row.auth_data);
            } catch (err) {
                logger.warn({ err, schoolId }, 'Failed to parse session data');
                return null;
            }
        } catch (err) {
            logger.error({ err, schoolId }, 'Failed to load WhatsApp session');
            return null;
        }
    }

    /**
     * Delete session from database
     */
    async deleteSession(schoolId: string): Promise<void> {
        try {
            await db.run('DELETE FROM whatsapp_sessions WHERE school_id = ?', [schoolId]);
            logger.info({ schoolId }, 'WhatsApp session deleted from database');
        } catch (err) {
            logger.error({ err, schoolId }, 'Failed to delete WhatsApp session');
        }
    }

    /**
     * Check if session exists in database
     */
    async sessionExists(schoolId: string): Promise<boolean> {
        try {
            const row = await db.get(
                'SELECT school_id FROM whatsapp_sessions WHERE school_id = ? AND is_active = true',
                [schoolId]
            );
            return !!row;
        } catch (err) {
            logger.error({ err, schoolId }, 'Failed to check session existence');
            return false;
        }
    }
}

export const whatsappSessionService = new WhatsAppSessionService();
