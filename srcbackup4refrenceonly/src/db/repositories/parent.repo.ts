import { db } from '..';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ParentRegistryRecord {
    parentId: string;
    schoolId: string;
    parentPhone: string;
    parentName: string;
    parentAccessToken: string;
    tokenGeneratedAt: string;
    tokenExpiresAt: string;
    isActive: boolean;
    createdByAdminPhone?: string;
}

export interface ParentChildRecord {
    parentId: string;
    studentId: string;
    schoolId: string;
    linkedAt: string;
}

export class ParentRepository {
    /**
     * Register a parent when admin uploads a student
     * Creates parent_registry record + links to student
     * CRITICAL FIX 1.2: Deduplicates - checks if parent already registered to prevent duplicates
     */
    static async registerParent(
        schoolId: string,
        parentPhone: string,
        parentName: string,
        studentId: string,
        adminPhone?: string
    ): Promise<{ parentId: string; token: string } | null> {
        // FIX 1.2: Check if parent already exists for this school
        // This prevents duplicate parent records when same parent has multiple students
        const existingParent = await new Promise<string | null>((resolve) => {
            db.getDB().get(
                `SELECT parent_id FROM parent_registry WHERE school_id = ? AND parent_phone = ?`,
                [schoolId, parentPhone],
                (err, row: any) => {
                    if (err) {
                        logger.error({ err, parentPhone, schoolId }, 'Error checking existing parent');
                        resolve(null);
                    } else {
                        resolve(row?.parent_id || null);
                    }
                }
            );
        });

        // If parent already registered, just link new student
        if (existingParent) {
            logger.info({ parentPhone, schoolId, studentId }, '✅ Parent already registered - linking additional student');
            
            await new Promise<void>((resolve) => {
                db.getDB().run(
                    `INSERT OR IGNORE INTO parent_children_mapping (parent_id, student_id, school_id)
                     VALUES (?, ?, ?)`,
                    [existingParent, studentId, schoolId],
                    (err) => {
                        if (err) {
                            logger.error({ err, existingParent, studentId }, 'Failed to link student to existing parent');
                        } else {
                            logger.info({ existingParent, studentId }, '✅ Student linked to existing parent');
                        }
                        resolve();
                    }
                );
            });

            // Also link to student_guardians if not already there
            await new Promise<void>((resolve) => {
                db.getDB().run(
                    `INSERT OR IGNORE INTO student_guardians (student_id, guardian_phone, relationship) VALUES (?, ?, 'parent')`,
                    [studentId, parentPhone],
                    (err) => {
                        if (err) {
                            logger.error({ err }, 'Failed to link guardian');
                        }
                        resolve();
                    }
                );
            });

            // Return empty token (don't regenerate)
            return { parentId: existingParent, token: '' };
        }

        // FIX 1.2: Use UUID consistently (not timestamp)
        // This ensures all parent IDs use same format for DB consistency
        const parentId: string = `parent_${uuidv4()}`;
        const token = this.generateAccessToken();
        const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        return new Promise((resolve) => {
            // Insert into parent_registry
            db.getDB().run(
                `INSERT INTO parent_registry 
                 (parent_id, school_id, parent_phone, parent_name, parent_access_token, token_expires_at, created_by_admin_phone, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                [parentId, schoolId, parentPhone, parentName, token, tokenExpiresAt, adminPhone || 'system'],
                (err) => {
                    if (err) {
                        logger.error({ err, parentPhone, schoolId }, '❌ Failed to create parent registry');
                        resolve(null);
                        return;
                    }

                    logger.info({ parentId, parentPhone, schoolId }, '✅ Parent registered in registry');

                    // Link parent to student
                    db.getDB().run(
                        `INSERT INTO parent_children_mapping (parent_id, student_id, school_id)
                         VALUES (?, ?, ?)`,
                        [parentId, studentId, schoolId],
                        (err) => {
                            if (err) {
                                logger.error({ err, parentId, studentId }, '❌ Failed to link parent to parent_children_mapping');
                            } else {
                                logger.info({ parentId, studentId }, '✅ Parent linked to parent_children_mapping');
                            }
                            // Also ensure student_guardians table is populated for systems reading from that table
                            db.getDB().run(
                                `INSERT OR IGNORE INTO student_guardians (student_id, guardian_phone, relationship) VALUES (?, ?, 'parent')`,
                                [studentId, parentPhone],
                                (err2) => {
                                    if (err2) {
                                        logger.error({ err2, parentId, studentId }, '❌ Failed to link parent to student_guardians');
                                    } else {
                                        logger.info({ parentId, studentId }, '✅ Parent linked to student_guardians');
                                    }
                                    resolve({ parentId, token });
                                }
                            );
                        }
                    );
                }
            );
        });
    }

    /**
     * Check if a phone number is an identified parent for a school
     */
    static async isIdentifiedParent(parentPhone: string, schoolId: string): Promise<boolean> {
        return new Promise((resolve) => {
            db.getDB().get(
                `SELECT parent_id FROM parent_registry 
                 WHERE parent_phone = ? AND school_id = ? AND is_active = 1 AND token_expires_at > CURRENT_TIMESTAMP`,
                [parentPhone, schoolId],
                (err, row: any) => {
                    if (err) {
                        logger.error({ err, parentPhone, schoolId }, 'Error checking identified parent');
                        resolve(false);
                    } else {
                        resolve(!!row);
                    }
                }
            );
        });
    }

    /**
     * Get parent info if registered
     */
    static async getParentInfo(parentPhone: string, schoolId: string): Promise<ParentRegistryRecord | null> {
        return new Promise((resolve) => {
            db.getDB().get(
                `SELECT parent_id, school_id, parent_phone, parent_name, parent_access_token, 
                        token_generated_at, token_expires_at, is_active, created_by_admin_phone
                 FROM parent_registry 
                 WHERE parent_phone = ? AND school_id = ? AND is_active = 1`,
                [parentPhone, schoolId],
                (err, row: any) => {
                    if (err) {
                        logger.error({ err }, 'Error fetching parent info');
                        resolve(null);
                    } else if (!row) {
                        resolve(null);
                    } else {
                        resolve({
                            parentId: row.parent_id,
                            schoolId: row.school_id,
                            parentPhone: row.parent_phone,
                            parentName: row.parent_name,
                            parentAccessToken: row.parent_access_token,
                            tokenGeneratedAt: row.token_generated_at,
                            tokenExpiresAt: row.token_expires_at,
                            isActive: row.is_active,
                            createdByAdminPhone: row.created_by_admin_phone
                        });
                    }
                }
            );
        });
    }

    /**
     * Get all children for an identified parent
     */
    static async getParentChildren(parentPhone: string, schoolId: string): Promise<Array<{
        studentId: string;
        name: string;
        classLevel: string;
    }>> {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT s.student_id, s.name, s.class_level
                FROM students s
                JOIN parent_children_mapping pcm ON s.student_id = pcm.student_id
                JOIN parent_registry pr ON pcm.parent_id = pr.parent_id
                WHERE pr.parent_phone = ? AND pr.school_id = ? AND pr.is_active = 1
                ORDER BY s.name ASC
            `;
            db.getDB().all(sql, [parentPhone, schoolId], (err, rows: any[]) => {
                if (err) {
                    logger.error({ err, parentPhone, schoolId }, 'Failed to fetch parent children');
                    reject(err);
                } else {
                    resolve((rows || []).map(r => ({
                        studentId: r.student_id,
                        name: r.name,
                        classLevel: r.class_level
                    })));
                }
            });
        });
    }

    /**
     * Validate a parent access token
     * FIX 1.3: Use ONLY parent_registry (not parent_access_tokens)
     * This simplifies the validation logic and eliminates schema conflicts
     * Returns parent info if valid, null if invalid/expired
     */
    static async validateAccessToken(token: string, schoolId: string): Promise<{
        parentId: string;
        studentIds: string[];
        parentName: string;
        tokenExpiresAt: string;
    } | null> {
        return new Promise((resolve) => {
            // FIX 1.3: SIMPLIFIED - use only parent_registry as canonical source
            db.getDB().get(
                `SELECT parent_id, parent_name, token_expires_at FROM parent_registry 
                 WHERE parent_access_token = ? AND school_id = ? AND is_active = 1`,
                [token, schoolId],
                (err, row: any) => {
                    if (err) {
                        logger.error({ err, token, schoolId }, 'Error validating token');
                        resolve(null);
                        return;
                    }

                    if (!row) {
                        logger.warn({ token, schoolId }, 'Token not found in registry');
                        resolve(null);
                        return;
                    }

                    // Check expiration
                    const expiresAt = new Date(row.token_expires_at);
                    if (expiresAt < new Date()) {
                        logger.warn({ token }, 'Token expired');
                        resolve(null);
                        return;
                    }

                    // Token is valid - fetch children
                    db.getDB().all(
                        `SELECT student_id FROM parent_children_mapping WHERE parent_id = ?`,
                        [row.parent_id],
                        (err2, studentRows: any[]) => {
                            if (err2) {
                                logger.error({ err2, parentId: row.parent_id }, 'Failed to fetch student mappings');
                                resolve(null);
                                return;
                            }

                            resolve({
                                parentId: row.parent_id,
                                studentIds: (studentRows || []).map(s => s.student_id),
                                parentName: row.parent_name,
                                tokenExpiresAt: row.token_expires_at
                            });
                        }
                    );
                }
            );
        });
    }

    /**
     * Log token access attempt (for audit trail)
     */
    static async logTokenAccess(
        token: string,
        parentPhone: string,
        schoolId: string,
        studentAccessed: string,
        result: 'SUCCESS' | 'INVALID_TOKEN' | 'EXPIRED' | 'INVALID_STUDENT'
    ): Promise<void> {
        return new Promise((resolve) => {
            db.getDB().run(
                `INSERT INTO parent_token_access_log (token, parent_phone, school_id, student_accessed, access_result)
                 VALUES (?, ?, ?, ?, ?)`,
                [token, parentPhone, schoolId, studentAccessed, result],
                (err) => {
                    if (err) {
                        logger.error({ err }, 'Failed to log token access');
                    }
                    resolve();
                }
            );
        });
    }

    /**
     * Add a new child to an already-registered parent
     * (In case parent has more than one child)
     */
    static async linkStudentToParent(parentId: string, studentId: string, schoolId: string): Promise<boolean> {
        return new Promise((resolve) => {
            db.getDB().run(
                `INSERT OR IGNORE INTO parent_children_mapping (parent_id, student_id, school_id)
                 VALUES (?, ?, ?)`,
                [parentId, studentId, schoolId],
                (err) => {
                    if (err) {
                        logger.error({ err, parentId, studentId }, 'Failed to link student to parent');
                        resolve(false);
                    } else {
                        logger.info({ parentId, studentId }, '✅ Student linked to existing parent');
                        resolve(true);
                    }
                }
            );
        });
    }

    /**
     * Refresh parent access token (extends 24-hour expiry)
     * FIX 2.1: Token refresh mechanism - called after parent authenticates
     * Updates token_expires_at to current time + 24 hours
     */
    static async refreshAccessToken(parentId: string, schoolId: string): Promise<string | null> {
        return new Promise((resolve) => {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            db.getDB().run(
                `UPDATE parent_registry 
                 SET token_expires_at = ? 
                 WHERE parent_id = ? AND school_id = ? AND is_active = 1`,
                [expiresAt.toISOString(), parentId, schoolId],
                (err) => {
                    if (err) {
                        logger.error({ err, parentId }, 'Failed to refresh token');
                        resolve(null);
                        return;
                    }

                    // Fetch the refreshed token to return
                    db.getDB().get(
                        `SELECT parent_access_token FROM parent_registry WHERE parent_id = ? AND school_id = ?`,
                        [parentId, schoolId],
                        (err2, row: any) => {
                            if (err2 || !row) {
                                logger.error({ err2, parentId }, 'Failed to fetch refreshed token');
                                resolve(null);
                            } else {
                                logger.info({ parentId }, '✅ Token refreshed (24h extension)');
                                resolve(row.parent_access_token);
                            }
                        }
                    );
                }
            );
        });
    }

    /**
     * Deactivate a parent (admin removes)
     */
    static async deactivateParent(parentPhone: string, schoolId: string): Promise<boolean> {
        return new Promise((resolve) => {
            db.getDB().run(
                `UPDATE parent_registry SET is_active = 0 WHERE parent_phone = ? AND school_id = ?`,
                [parentPhone, schoolId],
                (err) => {
                    if (err) {
                        logger.error({ err }, 'Failed to deactivate parent');
                        resolve(false);
                    } else {
                        logger.info({ parentPhone, schoolId }, '✅ Parent deactivated');
                        resolve(true);
                    }
                }
            );
        });
    }

    /**
     * Regenerate access token for a parent (admin feature)
     */
    static async regenerateAccessToken(parentPhone: string, schoolId: string): Promise<string | null> {
        const newToken = this.generateAccessToken();
        const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        return new Promise((resolve) => {
            db.getDB().run(
                `UPDATE parent_registry 
                 SET parent_access_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE parent_phone = ? AND school_id = ?`,
                [newToken, tokenExpiresAt, parentPhone, schoolId],
                (err) => {
                    if (err) {
                        logger.error({ err }, 'Failed to regenerate token');
                        resolve(null);
                    } else {
                        logger.info({ parentPhone }, '✅ New access token generated');
                        resolve(newToken);
                    }
                }
            );
        });
    }

    /**
     * Private helper: Generate access token in format PAT-KUMO-ABC123DEF456
     */
    private static generateAccessToken(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let suffix = '';
        for (let i = 0; i < 12; i++) {
            suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `PAT-KUMO-${suffix}`;
    }
}
