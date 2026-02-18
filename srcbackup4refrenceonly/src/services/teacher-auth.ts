import { db } from '../db';
import { logger } from '../utils/logger';

/**
 * TA 1.1: TeacherAuthService
 * Centralized teacher authentication and token validation
 * 
 * Provides:
 * - Token validation (teacher_access_tokens table)
 * - Token expiry checking
 * - Teacher verification
 * - Secure authentication flow
 * 
 * Used by: TA handler + TeacherSessionManager.createTeacherSession()
 */
export class TeacherAuthService {
    /**
     * Validate a teacher access token
     * Returns teacher info if valid, null if invalid/expired
     * 
     * TA 1.1: Single source of truth for teacher token validation
     */
    static async validateAccessToken(token: string, schoolId: string): Promise<{
        teacherId: string;
        schoolId: string;
        teacherName?: string;
        tokenExpiresAt: string;
    } | null> {
        return new Promise((resolve) => {
            // TA 1.1: Use canonical teacher_access_tokens table
            db.getDB().get(
                `SELECT teacher_id, teacher_name, expires_at FROM teacher_access_tokens 
                 WHERE token = ? AND school_id = ? AND is_revoked = 0`,
                [token, schoolId],
                (err, row: any) => {
                    if (err) {
                        logger.error({ err, token, schoolId }, 'Error validating teacher token');
                        resolve(null);
                        return;
                    }

                    if (!row) {
                        logger.warn({ token, schoolId }, 'Teacher token not found');
                        resolve(null);
                        return;
                    }

                    // Check expiration
                    const expiresAt = new Date(row.expires_at);
                    if (expiresAt < new Date()) {
                        logger.warn({ token }, 'Teacher token expired');
                        resolve(null);
                        return;
                    }

                    // Token is valid
                    logger.info({ teacherId: row.teacher_id }, '✅ Teacher token validated');
                    resolve({
                        teacherId: row.teacher_id,
                        schoolId,
                        teacherName: row.teacher_name,
                        tokenExpiresAt: row.expires_at
                    });
                }
            );
        });
    }

    /**
     * Verify teacher exists and is active in school
     * TA 1.1: Confirm teacher has valid registration
     */
    static async validateTeacherExists(teacherId: string, schoolId: string): Promise<boolean> {
        return new Promise((resolve) => {
            db.getDB().get(
                `SELECT teacher_id FROM teacher_profiles 
                 WHERE teacher_id = ? AND school_id = ? AND is_active = 1`,
                [teacherId, schoolId],
                (err, row: any) => {
                    if (err || !row) {
                        logger.debug({ teacherId, schoolId }, 'Teacher not found or inactive');
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    }

    /**
     * Refresh teacher access token (extends expiry)
     * TA 1.4: Called after teacher authenticates or uses token
     * Extends expiry from current time + 4 hours (same as session TTL)
     */
    static async refreshAccessToken(teacherId: string, schoolId: string): Promise<string | null> {
        return new Promise((resolve) => {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 4);

            db.getDB().run(
                `UPDATE teacher_access_tokens 
                 SET expires_at = ? 
                 WHERE teacher_id = ? AND school_id = ? AND is_revoked = 0`,
                [expiresAt.toISOString(), teacherId, schoolId],
                (err) => {
                    if (err) {
                        logger.error({ err, teacherId }, 'Failed to refresh teacher token');
                        resolve(null);
                        return;
                    }

                    // Fetch and return refreshed token
                    db.getDB().get(
                        `SELECT token FROM teacher_access_tokens WHERE teacher_id = ? AND school_id = ?`,
                        [teacherId, schoolId],
                        (err2, row: any) => {
                            if (err2 || !row) {
                                logger.error({ err2, teacherId }, 'Failed to fetch refreshed token');
                                resolve(null);
                            } else {
                                logger.info({ teacherId }, '✅ Teacher token refreshed (4h extension)');
                                resolve(row.token);
                            }
                        }
                    );
                }
            );
        });
    }

    /**
     * Revoke a teacher token (logout/removal)
     * TA 1.1: Invalidate token when teacher logs out or is removed
     */
    static async revokeAccessToken(teacherId: string, schoolId: string): Promise<boolean> {
        return new Promise((resolve) => {
            db.getDB().run(
                `UPDATE teacher_access_tokens 
                 SET is_revoked = 1 
                 WHERE teacher_id = ? AND school_id = ?`,
                [teacherId, schoolId],
                (err) => {
                    if (err) {
                        logger.error({ err, teacherId }, 'Failed to revoke teacher token');
                        resolve(false);
                    } else {
                        logger.info({ teacherId }, '✅ Teacher token revoked');
                        resolve(true);
                    }
                }
            );
        });
    }

    /**
     * Get active tokens for teacher (for audit/debug)
     */
    static async getActiveTokens(teacherId: string, schoolId: string): Promise<number> {
        return new Promise((resolve) => {
            db.getDB().get(
                `SELECT COUNT(*) as count FROM teacher_access_tokens 
                 WHERE teacher_id = ? AND school_id = ? AND is_revoked = 0 AND expires_at > datetime('now')`,
                [teacherId, schoolId],
                (err, row: any) => {
                    resolve(err || !row ? 0 : row.count);
                }
            );
        });
    }
}

export const teacherAuthService = new TeacherAuthService();
