import { logger } from '../utils/logger';
import { db } from '../db';

export type AuditAction = 
    | 'LOCK_RESULTS' 
    | 'UNLOCK_RESULTS' 
    | 'RELEASE_RESULTS'
    | 'CONFIRM_PAYMENT' 
    | 'REJECT_PAYMENT' 
    | 'CONFIRM_MARKS' 
    | 'REJECT_MARKS'
    | 'CREATE_SESSION'
    | 'REVOKE_TOKEN'
    | 'FETCH_RESULT'
    | 'ANALYZE_PERFORMANCE'
    | 'OVERRIDE_LOCK'
    | 'VIEW_AUDIT_LOG'
    | 'PROPOSE_AMENDMENT'
    | 'CONFIRM_AMENDMENT'
    | 'CANCEL_AMENDMENT'
    | 'SELECT_CHILD'
    | 'RECORD_ATTENDANCE'
    | 'EXTRACT_STUDENTS'
    | 'PROCESS_ESCALATION'
    | 'GET_TEACHER_TOKEN'
    | 'REVOKE_TEACHER_TOKEN'
    | 'CLOSE_ALL_ESCALATIONS'
    | 'CLOSE_ESCALATION'
    | 'APPROVE_MARK_SUBMISSION'
    | 'APPROVE_MARK_AMENDMENT'
    | 'DENY_MARK_AMENDMENT'
    | 'REQUEST_MARK_CORRECTION'
    | 'ENGAGE_PARENTS'
    | 'TRIGGER_PROACTIVE_ENGAGEMENT'
    | 'UPDATE_TEACHER_PROFILE';

export interface AuditLogEntry {
    id?: number;
    timestamp?: string;
    actor_phone: string;
    action: AuditAction;
    target_resource: string;
    details: string | Record<string, any>;
    status?: 'success' | 'failure';
    error_message?: string;
}

/**
 * AuditTrailService
 * 
 * Comprehensive audit logging with error recovery and retry logic.
 * Every sensitive mutation is logged with full context for compliance.
 * 
 * CRITICAL PRINCIPLE: Audit failures are logged but never block primary operations.
 */
export class AuditTrailService {
    
    /**
     * Log an audit event with retry logic
     * Failures are logged but never throw - audit service fails open to prevent blocking operations
     */
    static async logAuditEvent(
        entry: AuditLogEntry,
        retries: number = 3
    ): Promise<void> {
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await this.insertAuditLog(entry);
                logger.info({ action: entry.action, actor: entry.actor_phone }, 'Audit logged successfully');
                return;
            } catch (error) {
                lastError = error as Error;
                logger.warn(
                    { 
                        attempt, 
                        action: entry.action, 
                        error: lastError.message 
                    }, 
                    `Audit log retry ${attempt}/${retries}`
                );
                
                if (attempt < retries) {
                    // Exponential backoff: 100ms, 200ms, 400ms
                    await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
                }
            }
        }
        
        // FAIL OPEN: Log failure but don't throw
        logger.error(
            { 
                action: entry.action, 
                actor: entry.actor_phone, 
                finalError: lastError?.message 
            }, 
            'Audit logging failed after retries - continuing without audit'
        );
    }

    private static insertAuditLog(entry: AuditLogEntry): Promise<void> {
        const details = typeof entry.details === 'string' 
            ? entry.details 
            : JSON.stringify(entry.details);

        const sql = `
            INSERT INTO audit_logs (actor_phone, action, target_resource, details)
            VALUES (?, ?, ?, ?)
        `;
        
        return new Promise((resolve, reject) => {
            db.getDB().run(
                sql,
                [entry.actor_phone, entry.action, entry.target_resource, details],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Query audit logs for compliance review
     */
    static async getAuditLogs(
        filters?: {
            actorPhone?: string;
            action?: AuditAction;
            startDate?: Date;
            endDate?: Date;
            limit?: number;
        }
    ): Promise<AuditLogEntry[]> {
        let sql = 'SELECT * FROM audit_logs WHERE 1=1';
        const params: any[] = [];

        if (filters?.actorPhone) {
            sql += ' AND actor_phone = ?';
            params.push(filters.actorPhone);
        }

        if (filters?.action) {
            sql += ' AND action = ?';
            params.push(filters.action);
        }

        if (filters?.startDate) {
            sql += ' AND timestamp >= ?';
            params.push(filters.startDate.toISOString());
        }

        if (filters?.endDate) {
            sql += ' AND timestamp <= ?';
            params.push(filters.endDate.toISOString());
        }

        sql += ' ORDER BY timestamp DESC';

        if (filters?.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return new Promise((resolve, reject) => {
            db.getDB().all(sql, params, (err, rows: any[]) => {
                if (err) {
                    logger.error({ error: err }, 'Failed to query audit logs');
                    reject(err);
                } else {
                    resolve(rows.map(r => ({
                        id: r.id,
                        timestamp: r.timestamp,
                        actor_phone: r.actor_phone,
                        action: r.action,
                        target_resource: r.target_resource,
                        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
                    })));
                }
            });
        });
    }

    /**
     * Get audit summary for a specific resource
     */
    static async getResourceAuditTrail(targetResource: string): Promise<AuditLogEntry[]> {
        const sql = `
            SELECT * FROM audit_logs 
            WHERE target_resource = ? 
            ORDER BY timestamp DESC
        `;
        
        return new Promise((resolve, reject) => {
            db.getDB().all(sql, [targetResource], (err, rows: any[]) => {
                if (err) {
                    logger.error({ error: err, resource: targetResource }, 'Failed to fetch resource audit trail');
                    reject(err);
                } else {
                    resolve(rows.map(r => ({
                        id: r.id,
                        timestamp: r.timestamp,
                        actor_phone: r.actor_phone,
                        action: r.action,
                        target_resource: r.target_resource,
                        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
                    })));
                }
            });
        });
    }

    /**
     * Verify audit trail integrity for compliance
     */
    static async getAuditSummary(startDate?: Date, endDate?: Date): Promise<{
        totalEntries: number;
        actionCounts: Record<AuditAction, number>;
        actorCounts: Record<string, number>;
    }> {
        const query = `SELECT action, actor_phone, COUNT(*) as count FROM audit_logs`;
        const params: any[] = [];

        let where = '';
        if (startDate) {
            where += ` AND timestamp >= ?`;
            params.push(startDate.toISOString());
        }
        if (endDate) {
            where += ` AND timestamp <= ?`;
            params.push(endDate.toISOString());
        }

        const sql = query + (where ? ` WHERE 1=1 ${where}` : '') + ` GROUP BY action, actor_phone`;

        return new Promise((resolve, reject) => {
            db.getDB().all(sql, params, (err, rows: any[]) => {
                if (err) {
                    logger.error({ error: err }, 'Failed to get audit summary');
                    reject(err);
                } else {
                    const actionCounts: Record<string, number> = {};
                    const actorCounts: Record<string, number> = {};
                    let totalEntries = 0;

                    rows.forEach(row => {
                        actionCounts[row.action] = (actionCounts[row.action] || 0) + row.count;
                        actorCounts[row.actor_phone] = (actorCounts[row.actor_phone] || 0) + row.count;
                        totalEntries += row.count;
                    });

                    resolve({ totalEntries, actionCounts, actorCounts });
                }
            });
        });
    }
}
