/**
 * Escalation Resumption Handler
 * 
 * Handles the "Active Resume" pattern where the dispatcher injects admin decisions
 * back to origin agents (PA, TA, GA) for them to craft natural user-facing responses.
 * 
 * This service encapsulates all the complex logic for:
 * - Fetching escalation details
 * - Recording authority responses
 * - Invoking origin agents with ghost messages
 * - Delivering final responses to users/groups
 * - Logging to audit trail
 */

import { logger } from '../../utils/logger';
import { EscalationServiceV2 } from '../../services/escalation-v2';
import { EscalationAuditService } from '../../services/escalation-audit';
import { HistoryManager } from '../memory/history-manager';
import { messenger } from '../../services/messenger';
import { ParentAgent } from '../../agents/pa';
import { TeacherAgent } from '../../agents/ta';
import { SchoolGroupAgent } from '../../agents/ga';
import { RoutedMessage } from '../types';

export class EscalationResumptionHandler {
    /**
     * Handle escalation resolution when admin makes a decision
     * This injects the decision back to the origin agent for natural response crafting
     * 
     * Called from dispatcher when: intent_clear === true && escalation_payload?.admin_instruction exists
     */
    static async handleResolution(
        output: any,
        message: RoutedMessage,
        schoolId: string,
        originAgents: {
            pa: ParentAgent;
            ta: TeacherAgent;
            ga: SchoolGroupAgent;
        }
    ): Promise<void> {
        if (!output?.intent_clear || !output?.escalation_payload?.admin_instruction) {
            logger.debug({}, 'ResumptionHandler: Not a resolution message, skipping');
            return;
        }

        logger.info(
            {
                escalationId: output.escalation_payload?.escalation_id,
                decision: output.escalation_payload?.admin_decision,
                instruction: output.escalation_payload?.admin_instruction?.substring(0, 100)
            },
            '🔔 [RESUMPTION] ESCALATION RESOLVED - Notifying origin agent'
        );

        try {
            const escalationPayload = output.escalation_payload;

            // Get the escalation to know which origin agent and original user to contact
            let { escalation } = await EscalationServiceV2.getEscalationForAuthority(
                escalationPayload.escalation_id,
                [],
                schoolId
            );

            if (!escalation) {
                logger.error(
                    { escalationId: escalationPayload.escalation_id, schoolId },
                    '🔴 [RESUMPTION] CRITICAL ERROR: Escalation not found - refusing to guess'
                );
                return;
            }

            logger.info(
                {
                    escalationId: escalation.id || escalation.escalation_id,
                    originAgent: escalation.origin_agent,
                    fromPhone: escalation.from_phone,
                    escalationType: escalation.escalation_type
                },
                '🔔 [RESUMPTION] Found escalation - will notify origin agent'
            );

            // Step 1: Record the authority decision in the database
            await EscalationServiceV2.recordAuthorityResponse({
                escalation_id: escalationPayload.escalation_id,
                round_number: 1,
                authority_type: 'DECISION_MADE',
                authority_request: 'Admin decision requested',
                authority_response: JSON.stringify({
                    decision: escalationPayload.admin_decision,
                    instruction_to_agent: escalationPayload.admin_instruction
                })
            });

            logger.info(
                { escalationId: escalationPayload.escalation_id, decision: escalationPayload.admin_decision },
                '✅ [RESUMPTION] Escalation resolution recorded in database'
            );

            // Log decision in audit trail
            await EscalationAuditService.logDecisionMade(
                escalationPayload.escalation_id,
                schoolId,
                escalationPayload.admin_decision,
                message.from,
                escalationPayload.admin_instruction
            );

            // 🔔 TEACHER NOTIFICATION: For mark amendment escalations, send direct notification
            if (escalation.escalation_type === 'MARK_AMENDMENT' && escalation.origin_agent === 'TA') {
                try {
                    const escContext = typeof escalation.context === 'string' ? JSON.parse(escalation.context || '{}') : (escalation.context || {});
                    const studentName = escContext.student_name || 'Student';
                    const subject = escContext.subject || 'subject';
                    const decision = escalationPayload.admin_decision?.toUpperCase() || 'RESOLVED';
                    
                    let notificationMsg = '';
                    if (decision === 'APPROVE' || decision === 'APPROVED') {
                        const newScore = escContext.new_score ? ` to ${escContext.new_score}` : '';
                        notificationMsg = `✅ *Amendment Approved*\n\nYour amendment request for *${studentName}* (${subject}) has been approved by the admin.${newScore}`;
                    } else if (decision === 'REJECT' || decision === 'DENY' || decision === 'DENIED') {
                        notificationMsg = `❌ *Amendment Denied*\n\nYour amendment request for *${studentName}* (${subject}) has been denied by the admin.\n\n${escalationPayload.admin_instruction ? `Reason: ${escalationPayload.admin_instruction}` : 'Please contact the admin if you have questions.'}`;
                    } else {
                        notificationMsg = `📋 *Amendment Update*\n\nYour amendment request for *${studentName}* (${subject}) has been ${decision.toLowerCase()} by the admin.\n\n${escalationPayload.admin_instruction || ''}`;
                    }
                    
                    await messenger.sendPush(schoolId, escalation.from_phone, notificationMsg);
                    logger.info({ 
                        escalationId: escalationPayload.escalation_id, 
                        teacherPhone: escalation.from_phone,
                        studentName,
                        subject,
                        decision 
                    }, '📱 Teacher notified of mark amendment resolution');
                } catch (notifyErr) {
                    logger.warn({ 
                        error: notifyErr, 
                        escalationId: escalationPayload.escalation_id 
                    }, '⚠️ Failed to send direct teacher notification - will rely on origin agent');
                }
            }

            logger.debug(
                { escalationId: escalationPayload.escalation_id, auditLogged: true },
                '📋 [RESUMPTION] Decision logged to audit trail'
            );

            // Step 2: Actively resume origin agent - inject ghost message and invoke
            try {
                const esc = escalation;
                const escId = esc?.id || esc?.escalation_id || escalationPayload.escalation_id;
                const originAgent = this.getOriginAgentHandler(esc.origin_agent, originAgents);

                if (!originAgent) {
                    logger.error(
                        { originAgent: esc.origin_agent },
                        '❌ [RESUMPTION] Unknown origin agent type - cannot resume'
                    );
                    return;
                }

                // Construct the context for the origin agent to craft natural response
                const resolutionContext = `SYSTEM EVENT: ESCALATION_RESOLVED\nAdmin Decision: ${escalationPayload.admin_decision}\nAdmin Instruction: ${escalationPayload.admin_instruction}\nOriginal Request: ${esc.reason}\n\nTASK: Inform the user (${esc.user_name || esc.from_phone}) of this outcome politely. Acknowledge the admin's decision and provide next steps.`;

                // Create ghost message to resume agent execution
                const ghostMessage = {
                    ...message,
                    from: esc.from_phone, // resume as if from original user/group
                    body: resolutionContext,
                    context: esc.origin_agent,
                    identity: {
                        ...(message.identity || {}),
                        userId: undefined,
                        role: esc.user_role || 'user'
                    },
                    system_injection: true, // mark system-injected resume
                    escalation_resume_id: escId
                } as any;

                logger.debug({ escId, originAgent: esc.origin_agent }, '📲 [RESUMPTION] Invoking origin agent for active resumption');

                // Invoke origin agent to craft natural final reply
                const finalResponse = await originAgent.handle(ghostMessage);

                if (!finalResponse) {
                    logger.warn({ escalationId: escId }, '⚠️ [RESUMPTION] Origin agent handler returned null/undefined');
                } else {
                    logger.debug(
                        {
                            escalationId: escId,
                            hasReplyText: !!finalResponse.reply_text,
                            replyLength: finalResponse.reply_text?.length || 0
                        },
                        '📲 [RESUMPTION] Origin agent returned response'
                    );
                }

                // Log that origin agent was resumed with decision
                await EscalationAuditService.logOriginAgentResumed(
                    escId,
                    schoolId,
                    esc.origin_agent
                );

                // Deliver final response to original target (group or user)
                if (finalResponse && finalResponse.reply_text) {
                    // Ensure group JID has @g.us suffix for proper delivery
                    let targetJid = esc.from_phone;
                    if (esc.origin_agent === 'GA' && targetJid && !targetJid.includes('@')) {
                        targetJid = `${targetJid}@g.us`;
                        logger.debug(
                            { originalJid: esc.from_phone, formattedJid: targetJid },
                            '✅ [RESUMPTION] Formatted group JID with @g.us suffix'
                        );
                    }

                    logger.debug({ to: targetJid, escalationId: escId }, '📤 [RESUMPTION] Sending final response to user/group');
                    await messenger.sendPush(schoolId, targetJid, finalResponse.reply_text);
                    logger.info({ to: targetJid, escalationId: escId }, '✅ [RESUMPTION] Sent final resolution to original user/group');

                    // Record escalation resolution to history so agent remembers
                    // This ensures on the next message from this user, the agent still remembers the outcome
                    try {
                        const resolutionRecord = `SYSTEM EVENT: ESCALATION_RESOLVED\nAdmin Decision: ${escalationPayload.admin_decision}\nAdmin Instruction: ${escalationPayload.admin_instruction}\nAgent Response: ${finalResponse.reply_text}`;
                        await HistoryManager.recordMessage(
                            schoolId,
                            esc.user_id,
                            esc.from_phone,
                            esc.origin_agent,
                            {
                                type: 'text',
                                body: resolutionRecord,
                                timestamp: Date.now(),
                                source: 'system'
                            },
                            {
                                action: 'ESCALATION_RESOLVED',
                                status: 'COMPLETED'
                            }
                        );
                        logger.info({ escalationId: escId, recordedBy: esc.origin_agent }, '📝 [RESUMPTION] Escalation resolution recorded to history');
                    } catch (memErr) {
                        logger.warn({ escalationId: escId, memErr }, '⚠️ [RESUMPTION] Failed to record escalation resolution to history');
                    }
                } else {
                    logger.warn({ escalationId: escId }, '⚠️ [RESUMPTION] Origin agent returned no reply_text for resumption');
                }

                // Mark escalation as resumed in DB so state is consistent
                logger.debug({ escalationId: escId }, '💾 [RESUMPTION] Marking escalation for resumption in DB');
                await EscalationServiceV2.markForResuption(escId, `MSG-RESUME-${Date.now()}`);
                logger.info({ escalationId: escId }, '▶️ [RESUMPTION] Escalation marked for resumption after delivery');

                // Log escalation fully resolved in audit trail
                await EscalationAuditService.logEscalationResolved(escId, schoolId);
                logger.debug({ escalationId: escId }, '✅ [AUDIT] Escalation marked fully resolved');
            } catch (resumeErr: any) {
                logger.error(
                    {
                        resumeErr: {
                            message: resumeErr?.message,
                            code: resumeErr?.code,
                            errno: resumeErr?.errno,
                            stack: resumeErr?.stack?.substring(0, 500)
                        },
                        escalationId: escalationPayload.escalation_id,
                        originAgent: escalation.origin_agent
                    },
                    '❌ [RESUMPTION] Failed to actively resume origin agent with admin instruction'
                );
            }
        } catch (resumeError: any) {
            logger.error(
                {
                    error: {
                        message: resumeError?.message,
                        code: resumeError?.code,
                        stack: resumeError?.stack?.substring(0, 500)
                    },
                    escalationId: output?.escalation_payload?.escalation_id
                },
                '❌ [RESUMPTION] Failed to notify origin agent of escalation resolution'
            );
        }
    }

    /**
     * Get the appropriate agent handler based on origin agent type
     */
    private static getOriginAgentHandler(
        originAgent: string,
        agents: {
            pa: ParentAgent;
            ta: TeacherAgent;
            ga: SchoolGroupAgent;
        }
    ): any {
        switch (originAgent) {
            case 'PA':
                return agents.pa;
            case 'TA':
                return agents.ta;
            case 'GA':
                return agents.ga;
            default:
                logger.warn({ originAgent }, 'Unknown origin agent type');
                return null;
        }
    }
}
