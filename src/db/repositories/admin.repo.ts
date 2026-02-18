import { db } from '..';
import { logger } from '../../utils/logger';

export class AdminRepository {
    static async lockTermResults(schoolId: string, termId: string, classLevel: string): Promise<void> {
        const sql = `UPDATE term_results SET status = 'locked', locked_at = CURRENT_TIMESTAMP WHERE school_id = ? AND term_id = ? AND class_level = ?`;
        return new Promise((resolve, reject) => {
             db.getDB().run(sql, [schoolId, termId, classLevel], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    static async getTermResultsStatus(schoolId: string, termId: string, classLevel: string): Promise<string> {
         const sql = `SELECT status FROM term_results WHERE school_id = ? AND term_id = ? AND class_level = ? LIMIT 1`;
         return new Promise((resolve, reject) => {
            db.getDB().get(sql, [schoolId, termId, classLevel], (err, row: any) => {
                if (err) reject(err);
                else resolve(row ? row.status : 'draft');
            });
        });
    }

    static async lockTermResultsWithAudit(
        schoolId: string, 
        termId: string, 
        classLevel: string,
        actorPhone: string
    ): Promise<void> {
        // 1. Update status
        const sql = `
            UPDATE term_results 
            SET status = 'locked', locked_at = CURRENT_TIMESTAMP 
            WHERE school_id = ? AND term_id = ? AND class_level = ?
        `;
        
        // 2. Write audit log
        const auditSql = `
            INSERT INTO audit_logs (actor_phone, action, target_resource, details)
            VALUES (?, 'LOCK_RESULTS', ?, ?)
        `;
        
        const targetResource = `term_results:${schoolId}:${termId}:${classLevel}`;
        const details = JSON.stringify({ class_level: classLevel, term_id: termId });
        
        return new Promise((resolve, reject) => {
            db.getDB().serialize(() => {
                db.getDB().run(sql, [schoolId, termId, classLevel], (err) => {
                    if (err) {
                        logger.error({ error: err, schoolId, termId, classLevel }, 'LOCK_RESULTS update failed');
                        reject(err);
                    }
                });
                db.getDB().run(auditSql, [actorPhone, targetResource, details], (err) => {
                    if (err) {
                        logger.error({ error: err, actorPhone }, 'LOCK_RESULTS audit failed');
                        reject(err);
                    } else {
                        logger.info({ schoolId, termId, classLevel, actor: actorPhone }, 'LOCK_RESULTS executed with audit');
                        resolve();
                    }
                });
            });
        });
    }

    static async unlockTermResultsWithAudit(
        schoolId: string, 
        termId: string, 
        classLevel: string,
        actorPhone: string,
        reason: string
    ): Promise<void> {
        const sql = `
            UPDATE term_results 
            SET status = 'draft', locked_at = NULL 
            WHERE school_id = ? AND term_id = ? AND class_level = ?
        `;
        
        const auditSql = `
            INSERT INTO audit_logs (actor_phone, action, target_resource, details)
            VALUES (?, 'UNLOCK_RESULTS', ?, ?)
        `;
        
        const targetResource = `term_results:${schoolId}:${termId}:${classLevel}`;
        const details = JSON.stringify({ 
            class_level: classLevel, 
            term_id: termId, 
            unlock_reason: reason 
        });
        
        return new Promise((resolve, reject) => {
            db.getDB().serialize(() => {
                db.getDB().run(sql, [schoolId, termId, classLevel], (err) => {
                    if (err) {
                        logger.error({ error: err, schoolId, termId, classLevel }, 'UNLOCK_RESULTS update failed');
                        reject(err);
                    }
                });
                db.getDB().run(auditSql, [actorPhone, targetResource, details], (err) => {
                    if (err) {
                        logger.error({ error: err, actorPhone }, 'UNLOCK_RESULTS audit failed');
                        reject(err);
                    } else {
                        logger.info({ schoolId, termId, classLevel, actor: actorPhone, reason }, 'UNLOCK_RESULTS executed with audit');
                        resolve();
                    }
                });
            });
        });
    }
}
