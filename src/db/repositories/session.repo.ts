import { db } from '..';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface PersistentSession {
    id: string;
    userId: string;
    phone: string;
    role: 'parent' | 'teacher' | 'admin';
    context: Record<string, any>;
    expiresAt: Date;
    createdAt: Date;
    lastActivity: Date;
}

export class SessionRepository {
    
    static async createSession(
        userId: string,
        phone: string,
        role: 'parent' | 'teacher' | 'admin',
        ttlMinutes: number = 120,
        context: Record<string, any> = {}
    ): Promise<string> {
        const id = uuidv4();
        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
        
        const sql = `
            INSERT OR REPLACE INTO sessions (id, user_id, phone, role, context, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        return new Promise((resolve, reject) => {
            db.getDB().run(
                sql,
                [id, userId, phone, role, JSON.stringify(context), expiresAt.toISOString()],
                (err) => {
                    if (err) {
                        logger.error({ error: err, userId, phone }, 'Failed to create session');
                        reject(err);
                    } else {
                        logger.info({ sessionId: id, userId, role }, 'Persistent session created');
                        resolve(id);
                    }
                }
            );
        });
    }

    static async updateActivity(userId: string): Promise<void> {
        const sql = `UPDATE sessions SET last_activity = CURRENT_TIMESTAMP, is_active = 1 WHERE user_id = ?`;
        return new Promise((resolve, reject) => {
            db.getDB().run(sql, [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    static async getSession(userId: string): Promise<PersistentSession | null> {
        const sql = `SELECT * FROM sessions WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP`;
        
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, [userId], (err, row: any) => {
                if (err) {
                    logger.error({ error: err, userId }, 'Failed to fetch session');
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    // Refresh TTL (sliding window)
                    const newExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
                    db.getDB().run(
                        `UPDATE sessions SET expires_at = ?, last_activity = CURRENT_TIMESTAMP WHERE id = ?`,
                        [newExpiresAt.toISOString(), row.id],
                        (updateErr) => {
                            if (updateErr) logger.warn({ updateErr }, 'Failed to refresh session TTL');
                        }
                    );

                    resolve({
                        id: row.id,
                        userId: row.user_id,
                        phone: row.phone,
                        role: row.role,
                        context: JSON.parse(row.context || '{}'),
                        expiresAt: new Date(row.expires_at),
                        createdAt: new Date(row.created_at),
                        lastActivity: new Date(row.last_activity)
                    });
                }
            });
        });
    }

    static async updateContext(userId: string, key: string, value: any): Promise<void> {
        return new Promise((resolve, reject) => {
            db.getDB().get(`SELECT context FROM sessions WHERE user_id = ?`, [userId], (err, row: any) => {
                if (err) {
                    logger.error({ error: err, userId }, 'Failed to fetch session context');
                    reject(err);
                } else if (!row) {
                    resolve(); // Session doesn't exist or is expired
                } else {
                    const context = JSON.parse(row.context || '{}');
                    context[key] = value;
                    
                    const sql = `UPDATE sessions SET context = ? WHERE user_id = ?`;
                    db.getDB().run(sql, [JSON.stringify(context), userId], (updateErr) => {
                        if (updateErr) {
                            logger.error({ updateErr, userId }, 'Failed to update session context');
                            reject(updateErr);
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    }

    static async clearSession(userId: string): Promise<void> {
        const sql = `DELETE FROM sessions WHERE user_id = ?`;
        
        return new Promise((resolve, reject) => {
            db.getDB().run(sql, [userId], (err) => {
                if (err) {
                    logger.error({ error: err, userId }, 'Failed to clear session');
                    reject(err);
                } else {
                    logger.info({ userId }, 'Session cleared');
                    resolve();
                }
            });
        });
    }

    static async getSessionByPhone(phone: string): Promise<PersistentSession | null> {
        const sql = `SELECT * FROM sessions WHERE phone = ? AND expires_at > CURRENT_TIMESTAMP`;
        
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, [phone], (err, row: any) => {
                if (err) {
                    logger.error({ error: err, phone }, 'Failed to fetch session by phone');
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve({
                        id: row.id,
                        userId: row.user_id,
                        phone: row.phone,
                        role: row.role,
                        context: JSON.parse(row.context || '{}'),
                        expiresAt: new Date(row.expires_at),
                        createdAt: new Date(row.created_at),
                        lastActivity: new Date(row.last_activity)
                    });
                }
            });
        });
    }

    static async logTokenAccess(
        token: string,
        phone: string,
        userId: string,
        accessType: 'TEACHER_TOKEN' | 'PARENT_TOKEN' | 'TEMPORAL',
        expiresAt: Date,
        details?: Record<string, any>
    ): Promise<void> {
        const sql = `
            INSERT INTO token_access_logs (token, phone, user_id, access_type, expires_at, details)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        return new Promise((resolve, reject) => {
            db.getDB().run(
                sql,
                [token, phone, userId, accessType, expiresAt.toISOString(), JSON.stringify(details || {})],
                (err) => {
                    if (err) {
                        logger.error({ error: err, token }, 'Failed to log token access');
                        reject(err);
                    } else {
                        logger.info({ token, accessType }, 'Token access logged');
                        resolve();
                    }
                }
            );
        });
    }

    static async revokeToken(token: string): Promise<void> {
        const sql = `UPDATE token_access_logs SET is_active = 0, revoked_at = CURRENT_TIMESTAMP WHERE token = ? AND is_active = 1`;
        
        return new Promise((resolve, reject) => {
            db.getDB().run(sql, [token], (err) => {
                if (err) {
                    logger.error({ error: err, token }, 'Failed to revoke token');
                    reject(err);
                } else {
                    logger.info({ token }, 'Token revoked');
                    resolve();
                }
            });
        });
    }

    static async isTokenValid(token: string): Promise<boolean> {
        const sql = `
            SELECT 1 FROM token_access_logs 
            WHERE token = ? AND is_active = 1 AND expires_at > CURRENT_TIMESTAMP
        `;
        
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, [token], (err, row) => {
                if (err) {
                    logger.error({ error: err, token }, 'Failed to check token validity');
                    reject(err);
                } else {
                    resolve(!!row);
                }
            });
        });
    }

    static async cleanupExpiredSessions(): Promise<number> {
        const sql = `DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP`;
        
        return new Promise((resolve, reject) => {
            db.getDB().run(sql, (err) => {
                if (err) {
                    logger.error({ error: err }, 'Failed to cleanup expired sessions');
                    reject(err);
                } else {
                    logger.info('Expired sessions cleaned up');
                    resolve(1);
                }
            });
        });
    }
}
