/**
 * Parent Token Repository
 * Handles parent access token validation with hashing support
 */

import { db } from '..';
import { logger } from '../../utils/logger';
import { TokenHasher } from '../../utils/token-hash';

export interface ParentTokenInfo {
    parentId: string;
    name: string;
    schoolId: string;
    termId: string;
}

export class ParentTokenRepository {
    /**
     * Find parent by token (supports both hashed and plain for backward compatibility)
     */
    static async findParentByToken(token: string): Promise<ParentTokenInfo | null> {
        // Get all active parent tokens
        const sql = `
            SELECT p.parent_id, u.name, p.school_id, p.term_id, p.token as stored_token
            FROM parent_access_tokens p
            JOIN users u ON p.parent_id = u.id
            WHERE p.expires_at > datetime('now')
        `;

        return new Promise(async (resolve, reject) => {
            db.getDB().all(sql, [], async (err, rows: any[]) => {
                if (err) {
                    logger.error({ err, token }, 'Error finding parent by token');
                    reject(err);
                    return;
                }

                if (!rows || rows.length === 0) {
                    resolve(null);
                    return;
                }

                // Try to match token (supports both hashed and plain for backward compatibility)
                for (const row of rows) {
                    const storedToken = row.stored_token;
                    
                    // Check if stored token is a hash (starts with $2b$ or $2a$ or $2y$)
                    const isHash = storedToken.startsWith('$2');
                    
                    if (isHash) {
                        // Compare with hashed token
                        const isValid = await TokenHasher.verifyToken(token, storedToken);
                        if (isValid) {
                            resolve({
                                parentId: row.parent_id,
                                name: row.name,
                                schoolId: row.school_id,
                                termId: row.term_id
                            });
                            return;
                        }
                    } else {
                        // Plain text comparison (backward compatibility)
                        if (storedToken === token) {
                            resolve({
                                parentId: row.parent_id,
                                name: row.name,
                                schoolId: row.school_id,
                                termId: row.term_id
                            });
                            return;
                        }
                    }
                }

                // No match found
                resolve(null);
            });
        });
    }
}

