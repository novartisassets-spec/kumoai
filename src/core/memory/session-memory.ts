import { embeddingService } from './embedding-service';
import { SummarizerService } from './summarizer-service';
import { HistoryManager } from './history-manager';
import { logger } from '../../utils/logger';
import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';

/**
 * SessionMemoryService manages memory that persists across a teacher's active session
 * When a teacher accesses the system via token, their session-specific context is prioritized
 * After session expiration, the system falls back to phone-based memory
 */
export class SessionMemoryService {
    /**
     * Store message in session memory (token-based context)
     * Messages are stored ONLY in session_memory during active session
     * When session ends, messages are archived to messages table via clearSessionMemory()
     * This avoids duplicate storage and maintains a single source of truth
     */
    static async recordSessionMessage(
        sessionId: string,
        schoolId: string,
        userId: string,
        fromPhone: string,
        context: string,
        msg: { type: string, body: string, mediaPath?: string, timestamp: number, source?: string },
        actionInfo?: { action: string, status: string }
    ): Promise<void> {
        try {
            // Store only in session memory (single source of truth during active session)
            const sessionMessageId = uuidv4();
            let messageBody = msg.source === 'system' ? `[SYSTEM] ${msg.body}` : msg.body;

            // Mask tokens to prevent exposure
            messageBody = messageBody.replace(/KUMO-[A-Z0-9]+/g, '[REDACTED_TOKEN]');

            return new Promise((resolve, reject) => {
                db.getDB().run(
                    `INSERT INTO session_memory 
                     (id, session_id, school_id, user_id, from_phone, type, body, media_path, context, timestamp, action_performed, action_status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        sessionMessageId,
                        sessionId,
                        schoolId,
                        userId || null,
                        fromPhone,
                        msg.type,
                        messageBody,
                        msg.mediaPath || null,
                        context,
                        msg.timestamp,
                        actionInfo?.action || null,
                        actionInfo?.status || null
                    ],
                    (err) => {
                        if (err) {
                            logger.error({ err, sessionId }, 'Failed to record session message');
                            reject(err);
                        } else {
                            logger.debug({ sessionId, messageId: sessionMessageId }, 'Session message recorded');
                            resolve();
                        }
                    }
                );
            });
        } catch (error) {
            logger.error({ error, sessionId }, 'Failed to record session message');
            throw error;
        }
    }

    /**
     * Get full session context for LLM
     * Returns session-specific memory when available, with prioritized recent interactions
     */
    static async getSessionContext(
        sessionId: string,
        fromPhone: string,
        userInput: string,
        limit: number = 15
    ): Promise<string> {
        try {
            // 1. Get session message history (prioritized - these are from THIS session)
            const sessionHistory = await this.getSessionHistory(sessionId, limit);

            // 2. Build context string
            const sessionContextStr = sessionHistory
                .map((m: any) =>
                    `[${new Date(m.timestamp).toISOString()}] [SESSION] ${m.context || 'TA'}: ${m.body} ${m.action_performed ? `(Action: ${m.action_performed})` : ''}`
                )
                .join('\n');

            // 3. Get semantic context if available
            let semanticContext = '';
            const relevantSummaries = await embeddingService.findRelevantSummaries(
                sessionId,
                userInput,
                2
            );
            if (relevantSummaries.length > 0) {
                semanticContext = `\nRELEVANT_PAST_CONTEXT:\n${relevantSummaries.join('\n---\n')}\n`;
            }

            // 4. Get session metadata
            const sessionMetadata = await this.getSessionMetadata(sessionId);

            const finalContext = `
${semanticContext}
SESSION_MEMORY (Token-Based Access):
${sessionContextStr || '[No prior messages in this session]'}
---
${sessionMetadata}
---
User Input: ${userInput}
`;

            return finalContext;
        } catch (error) {
            logger.error({ error, sessionId }, 'Failed to get session context');
            return userInput; // Fallback to raw input
        }
    }

    /**
     * Get session message history (last N messages from THIS session only)
     */
    static async getSessionHistory(sessionId: string, limit: number = 15): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM (
                    SELECT sm.*, u.role
                    FROM session_memory sm
                    LEFT JOIN users u ON sm.user_id = u.id
                    WHERE sm.session_id = ?
                    ORDER BY sm.timestamp DESC
                    LIMIT ?
                ) ORDER BY timestamp ASC
            `;

            db.getDB().all(sql, [sessionId, limit], (err, rows: any[]) => {
                if (err) {
                    logger.error({ err, sessionId }, 'Error fetching session history');
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Get session metadata for context enrichment
     */
    static async getSessionMetadata(sessionId: string): Promise<string> {
        return new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT ts.*, COUNT(sm.id) as message_count
                 FROM teacher_sessions ts
                 LEFT JOIN session_memory sm ON ts.session_id = sm.session_id
                 WHERE ts.session_id = ?
                 GROUP BY ts.session_id`,
                [sessionId],
                (err, row: any) => {
                    if (err) {
                        logger.error({ err, sessionId }, 'Error fetching session metadata');
                        resolve('SESSION_METADATA: Not available');
                    } else if (!row) {
                        resolve('SESSION_METADATA: Not available');
                    } else {
                        const expiresAt = new Date(row.expires_at);
                        const now = new Date();
                        const expiresInMinutes = Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60);

                        resolve(`SESSION_METADATA:
- Teacher: ${row.teacher_name || row.teacher_id}
- Session Duration: ${row.message_count || 0} messages
- Session Expires In: ${expiresInMinutes} minutes
- Active Since: ${new Date(row.created_at).toLocaleString()}`);
                    }
                }
            );
        });
    }

    /**
     * Get combined context (session + phone-based fallback)
     * Used to determine which memory system to use
     */
    static async getContextWithFallback(
        sessionId: string | null,
        fromPhone: string,
        userInput: string,
        userId?: string
    ): Promise<{ context: string, isSessionActive: boolean }> {
        // If session is valid, use session memory
        if (sessionId) {
            try {
                const isValid = await this.isSessionValid(sessionId);
                if (isValid) {
                    const context = await this.getSessionContext(sessionId, fromPhone, userInput);
                    return { context, isSessionActive: true };
                }
            } catch (error) {
                logger.warn({ error, sessionId }, 'Session context retrieval failed, falling back to phone-based');
            }
        }

        // Fallback: Use phone-based memory (standard HistoryManager)
        // Since session-memory is sessionId based, we try to get schoolId from the session
        let schoolId: string | undefined;
        if (sessionId) {
            const { TeacherSessionManager } = await import('../../services/teacher-session');
            const session = await TeacherSessionManager.getSession(sessionId);
            schoolId = session?.school_id;
        }

        const history = await HistoryManager.getSlidingWindow(fromPhone, 10, userId, schoolId);
        const historyContext = history
            .map((m: any) =>
                `[${m.timestamp}] [PHONE] ${m.sender_role}: ${m.content} ${m.action_performed ? `(Action: ${m.action_performed})` : ''}`
            )
            .join('\n');

        const fallbackContext = `
FALLBACK_PHONE_BASED_MEMORY:
(Session expired or not available - using phone number based context)
---
${historyContext || '[No prior messages]'}
---
User Input: ${userInput}
`;

        return { context: fallbackContext, isSessionActive: false };
    }

    /**
     * Clear session memory when session is terminated
     * Archives session messages to messages table before clearing (single source of truth migration)
     */
    static async clearSessionMemory(sessionId: string, archiveToHistory: boolean = true): Promise<void> {
        try {
            if (archiveToHistory) {
                // Archive session messages to standard history table before clearing
                logger.info({ sessionId }, 'Archiving session memory to messages table');
                
                const archiveSql = `
                    INSERT INTO messages (id, school_id, user_id, from_phone, type, body, media_path, context, timestamp, action_performed, action_status, is_internal, created_at)
                    SELECT id, school_id, user_id, from_phone, type, body, media_path, context, timestamp, action_performed, action_status, false, created_at
                    FROM session_memory 
                    WHERE session_id = ?
                `;

                await new Promise<void>((resolve, reject) => {
                    db.getDB().run(archiveSql, [sessionId], (err) => {
                        if (err) {
                            logger.error({ err, sessionId }, 'Failed to archive session memory');
                            reject(err);
                        } else {
                            logger.info({ sessionId }, 'Session memory archived to messages table');
                            resolve();
                        }
                    });
                });
            }

            // Clear session memory
            return new Promise((resolve, reject) => {
                db.getDB().run(
                    `DELETE FROM session_memory WHERE session_id = ?`,
                    [sessionId],
                    (err) => {
                        if (err) {
                            logger.error({ err, sessionId }, 'Failed to clear session memory');
                            reject(err);
                        } else {
                            logger.info({ sessionId }, 'Session memory cleared');
                            resolve();
                        }
                    }
                );
            });
        } catch (error) {
            logger.error({ error, sessionId }, 'Failed to clear session memory');
            throw error;
        }
    }

    /**
     * Check if session is still valid
     */
    static async isSessionValid(sessionId: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT expires_at FROM teacher_sessions 
                 WHERE session_id = ? AND is_active = 1`,
                [sessionId],
                (err, row: any) => {
                    if (err) {
                        logger.error({ err, sessionId }, 'Error checking session validity');
                        resolve(false);
                    } else if (!row) {
                        resolve(false);
                    } else {
                        const expiresAt = new Date(row.expires_at);
                        const isValid = expiresAt > new Date();
                        resolve(isValid);
                    }
                }
            );
        });
    }

    /**
     * Get session ID from access token
     */
    static async getSessionIdByToken(token: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT session_id FROM teacher_sessions 
                 WHERE token = ? AND is_active = 1 AND expires_at > datetime('now')`,
                [token],
                (err, row: any) => {
                    if (err) {
                        logger.error({ err, token }, 'Error getting session ID by token');
                        resolve(null);
                    } else if (!row) {
                        resolve(null);
                    } else {
                        resolve(row.session_id);
                    }
                }
            );
        });
    }
}
