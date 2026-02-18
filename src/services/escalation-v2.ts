/**
 * Escalation Service (Refactored)
 * Implements escalation as conversational pause-and-resume
 * NOT as one-way instruction delivery
 */

import { db } from '../db';
import { EscalationRepository } from '../db/repositories/escalation.repo';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface EscalationRequest {
    origin_agent: 'PA' | 'TA' | 'GA';
    escalation_type: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    school_id: string;
    from_phone: string;
    session_id: string;
    pause_message_id: string;
    user_name?: string;
    user_role?: string;
    reason: string;
    what_agent_needed: string;
    context?: Record<string, any>;
    conversation_summary?: string;
}

export interface AuthorityResponse {
    escalation_id: string;
    round_number: number;
    authority_type: 'CLARIFICATION_REQUEST' | 'NEEDS_DECISION' | 'DECISION_MADE';
    authority_request?: string; // Optional: what was being asked (for documentation)
    authority_response: string; // The actual response/decision
}

export class EscalationServiceV2 {
    /**
     * PAUSE: Create an escalation when original agent needs authority
     * 
     * This marks a "pause point" in the original conversation.
     * The original agent's next turn is suspended until authority provides response.
     */
    static async pauseForEscalation(request: EscalationRequest): Promise<string> {
        const escalationId = `ESC-${Date.now()}-${uuidv4().substring(0, 8)}`;
        
        logger.info(
            { escalationId, origin: request.origin_agent, type: request.escalation_type },
            '⏸️  [ESCALATION] Creating escalation (pause point)'
        );
        
        try {
            // Use repository for persistence with all fields
            const createdId = await EscalationRepository.createEscalation({
                escalation_id: escalationId,
                origin_agent: request.origin_agent,
                escalation_type: request.escalation_type,
                priority: request.priority,
                school_id: request.school_id,
                from_phone: request.from_phone,
                session_id: request.session_id,
                pause_message_id: request.pause_message_id,
                user_name: request.user_name,
                user_role: request.user_role || 'unknown',
                reason: request.reason,
                what_agent_needed: request.what_agent_needed,
                context: request.context,
                conversation_summary: request.conversation_summary
            });

            // Log the escalation creation event
            await EscalationRepository.logEscalationEvent(createdId, {
                school_id: request.school_id,
                event_type: 'ESCALATION_CREATED',
                origin_agent: request.origin_agent,
                context_data: {
                    pause_message_id: request.pause_message_id,
                    escalation_type: request.escalation_type,
                    priority: request.priority
                }
            });

            logger.info({ escalationId: createdId }, '✅ [ESCALATION] Escalation created and persisted');
            return createdId;
        } catch (err) {
            logger.error({ err, escalationId }, '❌ [ESCALATION] Failed to create escalation');
            throw err;
        }
    }
    
    /**
     * HANDOFF: Get full context for authority agent
     * 
     * Authority agent (SA/Admin) receives full context, not just summary
     * Includes conversation history up to pause point
     * 
     * NOTE: This is called from Dispatcher after SA has already validated school_id
     * The escalation table has school_id field, but lookup is by ID only since
     * dispatcher context is already school-isolated
     */
    static async getEscalationForAuthority(
        escalationId: string,
        conversationHistory: any[],
        schoolId?: string  // ← Optional: Added for explicit validation
    ): Promise<{ escalation: any; context: { history: any[]; situation: string } }> {
        return new Promise((resolve, reject) => {
            // Build query - with optional school_id validation for extra security
            let sql = `SELECT * FROM escalations WHERE id = ?`;
            let params: any[] = [escalationId];
            
            if (schoolId) {
                sql += ` AND school_id = ?`;
                params.push(schoolId);
                logger.debug({ escalationId, schoolId }, '✅ [ESCALATION] Validating escalation belongs to school');
            }
            
            db.getDB().get(sql, params, (err: any, escalation: any) => {
                if (err) {
                    logger.error({ err, escalationId }, '❌ [ESCALATION] Error fetching escalation');
                    reject(err);
                } else if (!escalation) {
                    logger.warn({ escalationId, schoolId }, '❌ [ESCALATION] Escalation not found (or school mismatch)');
                    resolve({ escalation: null, context: { history: [], situation: '' } });
                } else {
                    logger.debug({ escalationId, schoolId: escalation.school_id }, '✅ [ESCALATION] Escalation retrieved');
                    const context = {
                        history: conversationHistory, // Full conversation thread
                        situation: `
Original agent (${escalation.origin_agent}) needs authority for:
${escalation.what_agent_needed}

Reason: ${escalation.reason}
User: ${escalation.user_name || 'Unknown'}
Priority: ${escalation.priority}

Context: ${escalation.conversation_summary || 'No summary available'}
`
                    };
                    resolve({ escalation, context });
                }
            });
        });
    }
    
    /**
     * AUTHORITY RESPONSE: Record authority's response
     * 
     * Authority agent responds. Can be:
     * - CLARIFICATION_REQUEST: "I need to know..."
     * - NEEDS_DECISION: "This requires approval, let me review..."
     * - DECISION_MADE: "I approve/deny..."
     * 
     * Multi-turn escalations supported via round_number
     */
    static async recordAuthorityResponse(response: AuthorityResponse): Promise<void> {
        return new Promise((resolve, reject) => {
            const roundId = `ROUND-${response.escalation_id}-${response.round_number}-${Date.now()}`;
            
            const sql = `
                INSERT INTO escalation_round_log (
                    id, escalation_id, round_number, authority_type,
                    authority_request, authority_response, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.getDB().run(
                sql,
                [roundId, response.escalation_id, response.round_number, response.authority_type, response.authority_request || response.authority_response, response.authority_response, Date.now()],
                (err: any) => {
                    if (err) reject(err);
                    else {
                        // Update escalation state based on response type
                        const newState = 
                            response.authority_type === 'CLARIFICATION_REQUEST' ? 'AWAITING_CLARIFICATION' :
                            response.authority_type === 'DECISION_MADE' ? 'RESOLVED' :
                            'IN_AUTHORITY';
                        
                        const updateSql = `UPDATE escalations SET escalation_state = ?, round_number = ? WHERE id = ?`;
                        db.getDB().run(
                            updateSql,
                            [newState, response.round_number, response.escalation_id],
                            (updateErr: any) => {
                                if (updateErr) reject(updateErr);
                                else {
                                    logger.info(
                                        { escalationId: response.escalation_id, type: response.authority_type },
                                        '🔄 [ESCALATION] Authority response recorded'
                                    );
                                    resolve();
                                }
                            }
                        );
                    }
                }
            );
        });
    }
    
    /**
     * HARPER PATTERN: Record authority response with intent_clear gating and instruction
     * 
     * Enhanced version of recordAuthorityResponse for Harper's canonical model
     * Stores intent_clear score, decision type, and harper_instruction for origin agent
     */
    static async recordHarperAuthorityResponse(escalationId: string, harperPayload: {
        final_decision: string,
        harper_instruction: string,
        admin_response: string,
        context?: Record<string, any>
    }): Promise<void> {
        return new Promise((resolve, reject) => {
            const roundId = `ROUND-${escalationId}-${Date.now()}`;
            
            const sql = `
                INSERT INTO escalation_round_log (
                    id, escalation_id, round_number, authority_type,
                    authority_response, decision_type, harper_instruction, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.getDB().run(
                sql,
                [
                    roundId, 
                    escalationId, 
                    1, 
                    'DECISION_MADE',
                    harperPayload.admin_response,
                    harperPayload.final_decision,
                    harperPayload.harper_instruction,
                    Date.now()
                ],
                (err: any) => {
                    if (err) reject(err);
                    else {
                        // Update escalation with decision and instruction
                        const updateSql = `
                            UPDATE escalations 
                            SET escalation_state = 'RESOLVED',
                                admin_decision = ?,
                                admin_instruction = ?
                            WHERE id = ?
                        `;
                        
                        db.getDB().run(
                            updateSql,
                            [harperPayload.final_decision, harperPayload.harper_instruction, escalationId],
                            (updateErr: any) => {
                                if (updateErr) reject(updateErr);
                                else {
                                    logger.info(
                                        { escalationId, decision: harperPayload.final_decision },
                                        '✅ [ESCALATION] Harper authority response recorded'
                                    );
                                    resolve();
                                }
                            }
                        );
                    }
                }
            );
        });
    }
    
    /**
     * RESUME: Mark escalation as resolved and ready for original agent to resume
     * 
     * When authority has made a decision, original agent resumes.
     * The original agent sees the full context (user message + authority response)
     * and composes a natural final response to user.
     */
    static async markForResuption(escalationId: string, resumeMessageId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE escalations 
                SET escalation_state = 'RESOLVED', status = 'RESUMED', resumed_at = ?
                WHERE id = ?
            `;
            
            db.getDB().run(sql, [Date.now(), escalationId], (err: any) => {
                if (err) {
                    logger.error({ err, escalationId }, '❌ [ESCALATION] Failed to mark for resumption');
                    reject(err);
                } else {
                    logger.info({ escalationId }, '▶️  [ESCALATION] Marked for resumption - agent can now resume');
                    resolve();
                }
            });
        });
    }
    
    /**
     * GET AUTHORITY DECISION: Retrieve what authority decided for original agent
     */
    static async getAuthorityDecision(escalationId: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT authority_response FROM escalation_round_log
                WHERE escalation_id = ? AND authority_type = 'DECISION_MADE'
                ORDER BY round_number DESC LIMIT 1
            `;
            
            db.getDB().get(sql, [escalationId], (err: any, row: any) => {
                if (err) reject(err);
                else resolve(row?.authority_response || null);
            });
        });
    }
    
    /**
     * GET FULL ESCALATION HISTORY: For resuming agent to see full context
     */
    static async getEscalationHistory(escalationId: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM escalation_round_log
                WHERE escalation_id = ?
                ORDER BY round_number ASC
            `;
            
            db.getDB().all(sql, [escalationId], (err: any, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
    
    /**
     * FAILED ESCALATION: If escalation can't be resolved, mark as failed
     * Original agent can retry with different approach
     */
    static async markEscalationFailed(escalationId: string, reason: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE escalations 
                SET escalation_state = 'FAILED', status = 'CLOSED'
                WHERE id = ?
            `;
            
            db.getDB().run(sql, [escalationId], (err: any) => {
                if (err) reject(err);
                else {
                    logger.warn({ escalationId, reason }, '❌ [ESCALATION] Marked as failed - can retry');
                    resolve();
                }
            });
        });
    }
    
    /**
     * GET PENDING ESCALATIONS: For authority agent to process
     */
    static async getPendingEscalations(schoolId: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM escalations
                WHERE school_id = ? AND escalation_state IN ('PAUSED', 'AWAITING_CLARIFICATION')
                ORDER BY priority DESC, timestamp ASC
            `;
            
            db.getDB().all(sql, [schoolId], (err: any, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    // ============================================================================
    // FOCUS MANAGEMENT (Human-in-the-Loop Ambiguity Resolution)
    // ============================================================================

    /**
     * LOCK FOCUS: Admin is now attending to this specific escalation
     * Prevents other escalations from interrupting until resolved/unlocked
     */
    static async lockEscalationFocus(adminPhone: string, escalationId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO admin_focus_state (admin_phone, locked_escalation_id, last_interaction, school_id)
                VALUES (?, ?, ?, (SELECT school_id FROM escalations WHERE id = ?))
                ON CONFLICT(admin_phone) DO UPDATE SET
                    locked_escalation_id = excluded.locked_escalation_id,
                    last_interaction = excluded.last_interaction
            `;
            
            db.getDB().run(sql, [adminPhone, escalationId, Date.now(), escalationId], (err: any) => {
                if (err) reject(err);
                else {
                    logger.info({ adminPhone, escalationId }, '🔒 [FOCUS] Admin focus locked on escalation');
                    resolve();
                }
            });
        });
    }

    /**
     * UNLOCK FOCUS: Admin has finished with current escalation
     */
    static async unlockEscalationFocus(adminPhone: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE admin_focus_state SET locked_escalation_id = NULL WHERE admin_phone = ?`;
            
            db.getDB().run(sql, [adminPhone], (err: any) => {
                if (err) reject(err);
                else {
                    logger.info({ adminPhone }, '🔓 [FOCUS] Admin focus unlocked');
                    resolve();
                }
            });
        });
    }

    /**
     * GET ESCALATION: Retrieve a specific escalation by ID
     */
    static async getEscalation(escalationId: string): Promise<any | null> {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM escalations WHERE id = ?`;
            
            db.getDB().get(sql, [escalationId], (err: any, row: any) => {
                if (err) {
                    logger.error({ err, escalationId }, '❌ Failed to retrieve escalation');
                    reject(err);
                } else {
                    logger.debug({ escalationId, found: !!row }, '📋 Escalation lookup result');
                    resolve(row || null);
                }
            });
        });
    }

    /**
     * GET ACTIVE FOCUS: Which escalation is the admin currently talking about?
     */
    static async getActiveEscalation(adminPhone: string): Promise<any | null> {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT e.* 
                FROM admin_focus_state f
                JOIN escalations e ON f.locked_escalation_id = e.id
                WHERE f.admin_phone = ? AND f.locked_escalation_id IS NOT NULL
            `;
            
            db.getDB().get(sql, [adminPhone], (err: any, row: any) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    /**
     * GET NEXT QUEUED: Get the next high-priority escalation waiting for attention
     */
    static async getNextPendingEscalation(schoolId: string, excludeId?: string): Promise<any | null> {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT * FROM escalations 
                WHERE school_id = ? 
                AND escalation_state IN ('PAUSED', 'PENDING_QUEUE')
            `;
            const params = [schoolId];
            
            if (excludeId) {
                sql += ` AND id != ?`;
                params.push(excludeId);
            }
            
            sql += ` ORDER BY CASE priority 
                WHEN 'CRITICAL' THEN 1 
                WHEN 'HIGH' THEN 2 
                WHEN 'MEDIUM' THEN 3 
                ELSE 4 END ASC, timestamp ASC LIMIT 1`;

            db.getDB().get(sql, params, (err: any, row: any) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }
}
