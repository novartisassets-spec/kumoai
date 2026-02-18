import { db } from '../index';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class EscalationRepository {
    /**
     * Create a new escalation record
     */
    static async createEscalation(escalation: {
        escalation_id?: string;
        origin_agent: string;
        escalation_type: string;
        priority: string;
        school_id: string;
        from_phone: string;
        session_id: string;
        pause_message_id: string;
        user_name?: string;
        user_role?: string;
        reason: string;
        what_agent_needed?: string;
        context?: any;
        conversation_summary?: string;
    }): Promise<string> {
        const escalation_id = escalation.escalation_id || `ESC-${uuidv4()}`;
        const timestamp = Date.now();

        return new Promise((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO escalations (
                    id, origin_agent, escalation_type, priority,
                    school_id, from_phone, session_id, pause_message_id, user_name, user_role,
                    reason, what_agent_needed, context, conversation_summary,
                    status, escalation_state, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    escalation_id,
                    escalation.origin_agent,
                    escalation.escalation_type,
                    escalation.priority,
                    escalation.school_id,
                    escalation.from_phone,
                    escalation.session_id,
                    escalation.pause_message_id || `MSG-${Date.now()}-fallback`,
                    escalation.user_name || null,
                    escalation.user_role || null,
                    escalation.reason,
                    escalation.what_agent_needed || null,
                    typeof escalation.context === 'string' ? escalation.context : JSON.stringify(escalation.context || {}),
                    escalation.conversation_summary || null,
                    'ESCALATED',
                    'PAUSED',
                    timestamp
                ],
                function(err) {
                    if (err) {
                        logger.error({ err, escalation_id }, '❌ Failed to create escalation record');
                        reject(err);
                    } else {
                        logger.info({ escalation_id, origin_agent: escalation.origin_agent }, '✅ Escalation record created');
                        resolve(escalation_id);
                    }
                }
            );
        });
    }

    /**
     * Get escalation by ID
     */
    static async getEscalation(escalation_id: string): Promise<any> {
        return new Promise((resolve, reject) => {
            db.getDB().get(
                'SELECT * FROM escalations WHERE id = ?',
                [escalation_id],
                (err, row) => {
                    if (err) {
                        logger.error({ err, escalation_id }, '❌ Failed to fetch escalation');
                        reject(err);
                    } else {
                        resolve(row || null);
                    }
                }
            );
        });
    }

    /**
     * Persist admin decision to escalation
     */
    static async recordAdminDecision(escalation_id: string, {
        admin_decision,
        admin_instruction,
        resolved_by,
        school_id
    }: {
        admin_decision: string;
        admin_instruction: string;
        resolved_by: string;
        school_id: string;
    }): Promise<void> {
        return new Promise((resolve, reject) => {
            db.getDB().run(
                `UPDATE escalations 
                 SET status = 'RESOLVED', 
                     admin_decision = ?, 
                     admin_instruction = ?, 
                     resolved_by = ?, 
                     resolved_at = ?,
                     admin_decision_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    admin_decision,
                    admin_instruction,
                    resolved_by,
                    Date.now(),
                    escalation_id
                ],
                (err) => {
                    if (err) {
                        logger.error({ err, escalation_id, admin_decision }, '❌ Failed to record admin decision');
                        reject(err);
                    } else {
                        logger.info({ escalation_id, admin_decision, resolved_by }, 
                            '✅ Admin decision persisted to escalation');
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Get all escalations for a school
     */
    static async getSchoolEscalations(school_id: string, status?: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const query = status 
                ? 'SELECT * FROM escalations WHERE school_id = ? AND status = ? ORDER BY timestamp DESC'
                : 'SELECT * FROM escalations WHERE school_id = ? ORDER BY timestamp DESC';
            
            const params = status ? [school_id, status] : [school_id];

            db.getDB().all(
                query,
                params,
                (err, rows) => {
                    if (err) {
                        logger.error({ err, school_id }, '❌ Failed to fetch school escalations');
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    /**
     * Get pending escalations (awaiting admin decision)
     */
    static async getPendingEscalations(school_id: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            db.getDB().all(
                `SELECT * FROM escalations 
                 WHERE school_id = ? AND status IN ('ESCALATED', 'IN_AUTHORITY', 'AUTHORITY_RESPONDED') 
                 ORDER BY 
                     CASE WHEN priority = 'CRITICAL' THEN 1
                          WHEN priority = 'HIGH' THEN 2
                          WHEN priority = 'MEDIUM' THEN 3
                          ELSE 4
                     END,
                     timestamp ASC`,
                [school_id],
                (err, rows) => {
                    if (err) {
                        logger.error({ err, school_id }, '❌ Failed to fetch pending escalations');
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    /**
     * Get escalations with admin decisions
     */
    static async getResolvedEscalations(school_id: string, limit: number = 10): Promise<any[]> {
        return new Promise((resolve, reject) => {
            db.getDB().all(
                `SELECT * FROM escalations 
                 WHERE school_id = ? AND status = 'RESOLVED' AND admin_decision IS NOT NULL
                 ORDER BY resolved_at DESC LIMIT ?`,
                [school_id, limit],
                (err, rows) => {
                    if (err) {
                        logger.error({ err, school_id }, '❌ Failed to fetch resolved escalations');
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    /**
     * Audit log for escalation event
     */
    static async logEscalationEvent(escalation_id: string, {
        school_id,
        event_type,
        admin_phone,
        origin_agent,
        decision_summary,
        context_data
    }: {
        school_id: string;
        event_type: string;
        admin_phone?: string;
        origin_agent?: string;
        decision_summary?: string;
        context_data?: any;
    }): Promise<void> {
        const audit_id = `AUDIT-${uuidv4()}`;
        const event_timestamp = Date.now();

        return new Promise((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO escalation_audit_log (
                    id, escalation_id, school_id, event_type,
                    event_timestamp, admin_phone, origin_agent,
                    decision_summary, context_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    audit_id,
                    escalation_id,
                    school_id,
                    event_type,
                    event_timestamp,
                    admin_phone || null,
                    origin_agent || null,
                    decision_summary || null,
                    typeof context_data === 'string' ? context_data : JSON.stringify(context_data || {})
                ],
                (err) => {
                    if (err) {
                        logger.error({ err, escalation_id, event_type }, '❌ Failed to log escalation event');
                        reject(err);
                    } else {
                        logger.debug({ escalation_id, event_type }, '✅ Escalation event logged');
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Get escalation audit timeline
     */
    static async getEscalationTimeline(escalation_id: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            db.getDB().all(
                `SELECT * FROM escalation_audit_log 
                 WHERE escalation_id = ? 
                 ORDER BY event_timestamp ASC`,
                [escalation_id],
                (err, rows) => {
                    if (err) {
                        logger.error({ err, escalation_id }, '❌ Failed to fetch escalation timeline');
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }
}
