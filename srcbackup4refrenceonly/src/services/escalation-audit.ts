/**
 * Escalation Audit Service
 * Records decision chain events for escalation tracking and SA context
 */

import { db } from '../db';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class EscalationAuditService {
    /**
     * Log when admin is notified about an escalation
     */
    static async logAdminNotified(escalationId: string, schoolId: string, adminPhone: string): Promise<void> {
        await this.logEvent(escalationId, schoolId, 'ADMIN_NOTIFIED', {
            admin_phone: adminPhone,
            notified_at: Date.now()
        });
    }

    /**
     * Log when admin response is recorded (clarification, decision, etc)
     */
    static async logAdminResponse(escalationId: string, schoolId: string, responseType: string, adminPhone: string): Promise<void> {
        await this.logEvent(escalationId, schoolId, 'ADMIN_RESPONSE_RECORDED', {
            admin_phone: adminPhone,
            response_type: responseType,
            recorded_at: Date.now()
        });
    }

    /**
     * Log when decision is made (final admin decision)
     */
    static async logDecisionMade(escalationId: string, schoolId: string, decision: string, adminPhone: string, instruction: string): Promise<void> {
        await this.logEvent(escalationId, schoolId, 'DECISION_MADE', {
            admin_phone: adminPhone,
            decision: decision,
            instruction: instruction?.substring(0, 500),
            decided_at: Date.now()
        }, decision);
    }

    /**
     * Log when origin agent is resumed with decision
     */
    static async logOriginAgentResumed(escalationId: string, schoolId: string, originAgent: string): Promise<void> {
        await this.logEvent(escalationId, schoolId, 'ORIGIN_AGENT_RESUMED', {
            origin_agent: originAgent,
            resumed_at: Date.now()
        }, originAgent);
    }

    /**
     * Log when escalation is fully resolved
     */
    static async logEscalationResolved(escalationId: string, schoolId: string): Promise<void> {
        await this.logEvent(escalationId, schoolId, 'ESCALATION_RESOLVED', {
            resolved_at: Date.now()
        });
    }

    /**
     * Internal: Log a generic audit event
     */
    private static async logEvent(escalationId: string, schoolId: string, eventType: string, contextData: any, decisionSummary?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const auditId = `AUDIT-${escalationId}-${Date.now()}`;
            
            const sql = `
                INSERT INTO escalation_audit_log (
                    id, escalation_id, school_id, event_type, 
                    event_timestamp, admin_phone, origin_agent,
                    decision_summary, context_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.getDB().run(
                sql,
                [
                    auditId,
                    escalationId,
                    schoolId,
                    eventType,
                    Date.now(),
                    contextData.admin_phone || null,
                    contextData.origin_agent || null,
                    decisionSummary || null,
                    JSON.stringify(contextData)
                ],
                (err: any) => {
                    if (err) {
                        logger.warn({ err, escalationId, eventType }, '⚠️ [AUDIT] Failed to log event');
                        resolve(); // Don't fail the main flow for audit failures
                    } else {
                        logger.debug({ escalationId, eventType }, '📋 [AUDIT] Event logged');
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Get full audit trail for an escalation
     */
    static async getAuditTrail(escalationId: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM escalation_audit_log
                WHERE escalation_id = ?
                ORDER BY event_timestamp ASC
            `;
            
            db.getDB().all(sql, [escalationId], (err: any, rows: any[]) => {
                if (err) {
                    logger.error({ err, escalationId }, '❌ Failed to fetch audit trail');
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Get recent resolved escalations for context (last 7 days)
     */
    static async getRecentResolvedEscalations(schoolId: string, days: number = 7): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const sevenDaysAgo = Date.now() - (days * 24 * 60 * 60 * 1000);
            
            const sql = `
                SELECT DISTINCT
                    e.id,
                    e.escalation_type,
                    e.origin_agent,
                    e.reason,
                    e.priority,
                    (SELECT decision_summary FROM escalation_audit_log 
                     WHERE escalation_id = e.id AND event_type = 'DECISION_MADE' LIMIT 1) as decision,
                    (SELECT MAX(event_timestamp) FROM escalation_audit_log 
                     WHERE escalation_id = e.id AND event_type = 'DECISION_MADE') as decided_at
                FROM escalations e
                WHERE e.school_id = ? 
                AND e.escalation_state = 'RESOLVED'
                AND e.updated_at > datetime(?, 'unixepoch')
                ORDER BY e.updated_at DESC
            `;
            
            db.getDB().all(sql, [schoolId, Math.floor(sevenDaysAgo / 1000)], (err: any, rows: any[]) => {
                if (err) {
                    logger.warn({ err, schoolId }, '⚠️ Failed to fetch recent escalations');
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }
}
