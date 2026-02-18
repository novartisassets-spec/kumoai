import { db } from '..';
import { UserIdentity, UserRole } from '../../core/types';
import { logger } from '../../utils/logger';
import { PhoneNormalizer } from '../../utils/phone-normalizer';

export class UserRepository {

    static async findByPhone(phone: string): Promise<UserIdentity | null> {
        return this.findByPhoneAndSchool(phone);
    }

    static async findByPhoneAndSchool(phone: string, schoolId?: string): Promise<UserIdentity | null> {
        const normalized = PhoneNormalizer.normalize(phone);
        
        let sql = `
            SELECT u.id, u.phone, u.role, u.school_id, u.name, u.assigned_class 
            FROM users u 
            WHERE u.phone = ?
        `;
        const params: any[] = [normalized];

        if (schoolId) {
            sql += ` AND u.school_id = ?`;
            params.push(schoolId);
        }
        
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, params, (err, row: any) => {
                if (err) {
                    console.log(`   ❌ Database error:`, err);
                    logger.error({ err, phone, normalized }, '❌ Error finding user by phone');
                    reject(err);
                } else if (!row) {
                    console.log(`   ⚠️ No row found for phone="${normalized}"`);
                    logger.debug({ phone, normalized }, '⚠️ User not found by phone');
                    resolve(null);
                } else {
                    console.log(`   ✅ Found! Role: ${row.role}, Name: ${row.name}`);
                    logger.info({ phone, normalized, role: row.role, name: row.name, assignedClass: row.assigned_class }, '✅ User found by phone');
                    resolve({
                        userId: row.id,
                        phone: row.phone,
                        role: row.role as UserRole,
                        schoolId: row.school_id,
                        name: row.name,
                        assignedClass: row.assigned_class
                    });
                }
            });
        });
    }

    static async findTeacherByToken(token: string): Promise<UserIdentity | null> {
        // Teacher Access Token logic
        const sql = `
            SELECT u.id, u.phone, u.role, u.school_id, u.name 
            FROM teacher_access_tokens t
            JOIN users u ON t.teacher_id = u.id
            WHERE t.token = ? AND t.expires_at > datetime('now') AND t.is_revoked = 0
        `;

         return new Promise((resolve, reject) => {
            db.getDB().get(sql, [token], (err, row: any) => {
                if (err) {
                    logger.error({ err, token }, 'Error finding teacher by token');
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve({
                        userId: row.id,
                        phone: row.phone, // This might be the user's original phone, but the session is current
                        role: 'teacher',
                        schoolId: row.school_id,
                        name: row.name
                    });
                }
            });
        });
    }

    /**
     * Unified Token Resolver: TEA-KUMO-* or PAT-KUMO-*
     */
    static async findUserByToken(token: string, schoolId: string): Promise<UserIdentity | null> {
        if (token.startsWith('TEA-KUMO-')) {
            const teacher = await this.findTeacherByToken(token);
            return (teacher && teacher.schoolId === schoolId) ? teacher : null;
        }

        if (token.startsWith('PAT-KUMO-')) {
            const { ParentRepository } = await import('./parent.repo');
            const parent = await ParentRepository.validateAccessToken(token, schoolId);
            if (parent) {
                return {
                    userId: parent.parentId,
                    phone: '', // Placeholder, will be populated by incoming message from
                    role: 'parent',
                    schoolId: schoolId,
                    name: parent.parentName
                };
            }
        }

        return null;
    }
}
