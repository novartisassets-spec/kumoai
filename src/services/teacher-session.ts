
import { db } from '../db';
import { logger } from '../utils/logger';
import { TeacherAuthService } from './teacher-auth';
import { v4 as uuidv4 } from 'uuid';

export interface TeacherSession {
    session_id: string;
    teacher_id: string;
    token: string;
    school_id: string;
    phone: string;
    teacher_name?: string;
    created_at: string;
    expires_at: string;
    last_activity: string;
    is_active: boolean;
    context: any; // Added for unified context storage (PDF drafts, etc)
}

export class TeacherSessionManager {
    // Default session duration: 4 hours (in milliseconds)
    private static readonly DEFAULT_SESSION_TTL = 4 * 60 * 60 * 1000;

    // TA 1.5: Sessions keyed by PHONE (not sessionId) for reliable lookup
    // Reason: TA passes message.from (phone) to getSession(), not sessionId
    // This allows consistent session lookup across requests
    private static memorySessions: Map<string, TeacherSession> = new Map();

    /**
     * TA 1.2: Create teacher session after token validation
     * Centralizes the flow: validate token → refresh token → create session
     */
    static async createTeacherSession(
        phone: string,
        token: string,
        schoolId: string,
        ttlHours: number = 4
    ): Promise<{
        success: boolean;
        message: string;
        sessionId?: string;
        teacherName?: string;
        teacherId?: string;
    }> {
        try {
            // Step 1: Validate token
            logger.info({ phone, schoolId }, '[TeacherSessionManager] Validating teacher token');
            const teacherValidation = await TeacherAuthService.validateAccessToken(token, schoolId);
            if (!teacherValidation) {
                logger.warn({ phone, token }, '❌ Teacher token validation failed');
                return {
                    success: false,
                    message: 'Invalid or expired teacher access token. Please check your token and try again.'
                };
            }

            // Step 2: Refresh token (extends 4h expiry)
            logger.info({ teacherId: teacherValidation.teacherId }, '🔄 Refreshing teacher token');
            const refreshedToken = await TeacherAuthService.refreshAccessToken(
                teacherValidation.teacherId,
                schoolId
            );
            if (!refreshedToken) {
                logger.error({ teacherId: teacherValidation.teacherId }, 'Token refresh failed');
                return {
                    success: false,
                    message: 'Failed to refresh your access. Please try again.'
                };
            }

            // Step 3: Create session with refreshed token
            logger.info({ teacherId: teacherValidation.teacherId, phone }, '📝 Creating authenticated teacher session');
            const sessionId = await this.createSession(
                teacherValidation.teacherId,
                refreshedToken,
                schoolId,
                phone,
                teacherValidation.teacherName
            );

            // Store in memory for fast lookup
            const now = new Date().toISOString();
            const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
            this.memorySessions.set(phone, {
                session_id: sessionId,
                teacher_id: teacherValidation.teacherId,
                token: refreshedToken,
                school_id: schoolId,
                phone,
                teacher_name: teacherValidation.teacherName,
                created_at: now,
                expires_at: expiresAt,
                last_activity: now,
                is_active: 1,
                context: {}
            });

            logger.info({ sessionId, teacherId: teacherValidation.teacherId }, '✅ Teacher session created successfully');
            return {
                success: true,
                message: `✅ Welcome, ${teacherValidation.teacherName || 'Teacher'}!`,
                sessionId,
                teacherName: teacherValidation.teacherName,
                teacherId: teacherValidation.teacherId
            };
        } catch (error) {
            logger.error({ error, phone, schoolId }, 'TeacherSessionManager error during teacher session creation');
            return {
                success: false,
                message: 'An error occurred during authentication. Please try again.'
            };
        }
    }

    /**
     * TA 1.5: Get session by phone (memory-first)
     */
    static getSessionByPhone(phone: string): TeacherSession | null {
        const memSession = this.memorySessions.get(phone);
        if (memSession && new Date(memSession.expires_at) > new Date()) {
            return memSession;
        }
        return null;
    }

    /**
     * Update context for the active teacher.
     */
    static updateContext(phone: string, key: string, value: any) {
        const session = this.getSessionByPhone(phone);
        if (session) {
            session.context[key] = value;
            
            // Async update to DB
            db.getDB().run(
                `UPDATE teacher_sessions SET context_json = ? WHERE session_id = ?`,
                [JSON.stringify(session.context), session.session_id],
                (err) => {
                    if (err) logger.error({ err, phone }, 'Failed to persist teacher context update');
                }
            );
        }
    }

    static getContext(phone: string): any {
        const session = this.getSessionByPhone(phone);
        return session ? session.context : {};
    }

    /**
     * TA 1.4: Refresh teacher session expiry (sliding window)
     */
    static async refreshSession(phone: string, schoolId: string): Promise<boolean> {
        const session = this.memorySessions.get(phone);
        if (!session) return false;
        // Extend expiry by 4 hours from now
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 4);
        session.expires_at = expiresAt.toISOString();
        this.memorySessions.set(phone, session);
        // Also update DB
        return new Promise((resolve) => {
            db.getDB().run(
                `UPDATE teacher_sessions SET expires_at = ? WHERE session_id = ?`,
                [session.expires_at, session.session_id],
                (err) => {
                    if (err) {
                        logger.error({ err, phone }, 'Failed to refresh teacher session expiry');
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    }

    /**
     * Create or resume a teacher session based on access token
     * Returns the session ID for memory tracking
     */
    static async createSession(
        teacherId: string,
        token: string,
        schoolId: string,
        phone: string,
        teacherName?: string
    ): Promise<string> {
        const sessionId = uuidv4();
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + this.DEFAULT_SESSION_TTL).toISOString();

        return new Promise((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO teacher_sessions 
                 (session_id, teacher_id, token, school_id, phone, teacher_name, created_at, expires_at, last_activity, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [sessionId, teacherId, token, schoolId, phone, teacherName || null, now, expiresAt, now],
                (err) => {
                    if (err) {
                        logger.error({ err, teacherId, token }, 'Failed to create teacher session');
                        reject(err);
                    } else {
                        // ✅ CRITICAL FIX: Sync memory map
                        TeacherSessionManager.memorySessions.set(phone, {
                            session_id: sessionId,
                            teacher_id: teacherId,
                            token: token,
                            school_id: schoolId,
                            phone,
                            teacher_name: teacherName,
                            created_at: now,
                            expires_at: expiresAt,
                            last_activity: now,
                            is_active: 1,
                            context: {}
                        });
                        logger.info({ sessionId, teacherId, phone }, 'Teacher session created and memory synced');
                        resolve(sessionId);
                    }
                }
            );
        });
    }

    /**
     * Get active session by token
     */
    static async getSessionByToken(token: string): Promise<TeacherSession | null> {
        return new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT * FROM teacher_sessions 
                 WHERE token = ? AND is_active = 1 AND expires_at > datetime('now')`,
                [token],
                (err, row: any) => {
                    if (err) {
                        logger.error({ err, token }, 'Failed to get session by token');
                        reject(err);
                    } else if (!row) {
                        resolve(null);
                    } else {
                        resolve({
                            session_id: row.session_id,
                            teacher_id: row.teacher_id,
                            token: row.token,
                            school_id: row.school_id,
                            phone: row.phone,
                            teacher_name: row.teacher_name,
                            created_at: row.created_at,
                            expires_at: row.expires_at,
                            last_activity: row.last_activity,
                            is_active: !!row.is_active,
                            context: JSON.parse(row.context_json || '{}')
                        });
                    }
                }
            );
        });
    }

    /**
     * Get active session by session ID
     */
    static async getSession(sessionId: string): Promise<TeacherSession | null> {
        return new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT * FROM teacher_sessions 
                 WHERE session_id = ? AND is_active = 1 AND expires_at > datetime('now')`,
                [sessionId],
                (err, row: any) => {
                    if (err) {
                        logger.error({ err, sessionId }, 'Failed to get session');
                        reject(err);
                    } else if (!row) {
                        resolve(null);
                    } else {
                        resolve({
                            session_id: row.session_id,
                            teacher_id: row.teacher_id,
                            token: row.token,
                            school_id: row.school_id,
                            phone: row.phone,
                            teacher_name: row.teacher_name,
                            created_at: row.created_at,
                            expires_at: row.expires_at,
                            last_activity: row.last_activity,
                            is_active: !!row.is_active,
                            context: JSON.parse(row.context_json || '{}')
                        });
                    }
                }
            );
        });
    }

    /**
     * Update session last activity timestamp
     */
    static async updateActivity(sessionId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            db.getDB().run(
                `UPDATE teacher_sessions SET last_activity = datetime('now') WHERE session_id = ?`,
                [sessionId],
                (err) => {
                    if (err) {
                        logger.error({ err, sessionId }, 'Failed to update session activity');
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Check if session is still valid (not expired, still active)
     */
    static async isSessionValid(sessionId: string): Promise<boolean> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) return false;

            const expiresAt = new Date(session.expires_at);
            const now = new Date();
            return expiresAt > now;
        } catch (error) {
            logger.error({ error, sessionId }, 'Error checking session validity');
            return false;
        }
    }

    /**
     * Terminate session
     */
    static async terminateSession(sessionId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            db.getDB().run(
                `UPDATE teacher_sessions SET is_active = 0 WHERE session_id = ?`,
                [sessionId],
                (err) => {
                    if (err) {
                        logger.error({ err, sessionId }, 'Failed to terminate session');
                        reject(err);
                    } else {
                        logger.info({ sessionId }, 'Teacher session terminated');
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Cleanup expired sessions
     */
    static async cleanupExpiredSessions(): Promise<number> {
        return new Promise((resolve, reject) => {
            db.getDB().run(
                `UPDATE teacher_sessions SET is_active = 0 WHERE expires_at < datetime('now') AND is_active = 1`,
                function(err) {
                    if (err) {
                        logger.error({ err }, 'Failed to cleanup expired sessions');
                        reject(err);
                    } else {
                        const cleaned = this.changes;
                        if (cleaned > 0) {
                            logger.info({ count: cleaned }, 'Expired sessions cleaned up');
                        }
                        resolve(cleaned);
                    }
                }
            );
        });
    }

    /**
     * Get session summary for LLM context
     */
    static getSessionSummary(session: TeacherSession): string {
        const createdAt = new Date(session.created_at);
        const now = new Date();
        const sessionDuration = Math.floor((now.getTime() - createdAt.getTime()) / 1000 / 60);
        const expiresIn = Math.floor((new Date(session.expires_at).getTime() - now.getTime()) / 1000 / 60);

        return `
SESSION_CONTEXT:
- Teacher: ${session.teacher_name || session.teacher_id}
- Phone: ${session.phone}
- Session Duration: ${sessionDuration} minutes
- Session Expires In: ${expiresIn} minutes
- Session ID: ${session.session_id.substring(0, 8)}...
`;
    }
}
