import { BaseAgent } from '../base/agent';
import { RoutedMessage } from '../../core/types/index';
import { GAOutput, GAActionType } from './types/schema';
import { logger } from '../../utils/logger';
import { aiProvider } from '../../ai/provider';
import { GA_CONFIG } from '../../ai/config';
import { PromptEngine } from '../../core/prompt-engine';
import { RobustJsonParser } from '../../core/robust-json-parser';
import { GARepository } from '../../db/repositories/ga.repo';
import { MemoryOrchestrator } from '../../core/memory/orchestrator';
import { ActionAuthorizer } from '../../core/action-authorization';
import { db } from '../../db';

export class SchoolGroupAgent extends BaseAgent {
    /**
     * 🔍 Find school by group JID
     * Checks if incoming group message is from a configured school group
     */
    private async findSchoolByGroupJid(groupJid: string): Promise<string | null> {
        const jidVariants = [
            groupJid,
            groupJid.replace('@g.us', ''),
            `${groupJid}@g.us`
        ];
        const uniqueVariants = Array.from(new Set(jidVariants));
        
        for (const variant of uniqueVariants) {
            const row: any = await new Promise((resolve) => {
                db.getDB().get(
                    `SELECT id FROM schools WHERE whatsapp_group_jid = ?`,
                    [variant],
                    (err, row) => resolve(row)
                );
            });
            if (row?.id) return row.id;
        }
        return null;
    }

    /**
     * 🔐 PHASE 1: ROLE-BASED ACCESS CONTROL
     * Resolve user's role for group context (group_admin or regular member)
     */
    private async getUserRoleInGroup(userPhone: string, groupJid: string, schoolId: string): Promise<string | null> {
        try {
            // For now, assume parent role since GA is called by group members
            // Role resolution can be enhanced later with database queries
            return 'parent';
        } catch (err) {
            logger.error({ err, userPhone, groupJid }, '⚠️ Could not resolve user role in group');
            return null;
        }
    }

    /**
     * 🔐 Validate action authorization for group member
     */
    private async validateActionAuthorization(
        action: string,
        userPhone: string,
        groupJid: string,
        schoolId: string
    ): Promise<{ authorized: boolean; reason?: string }> {
        const userRole = await this.getUserRoleInGroup(userPhone, groupJid, schoolId);
        
        if (!userRole) {
            logger.error({ 
                action, 
                userPhone, 
                groupJid,
                schoolId 
            }, '🔴 SECURITY: Non-member attempted GA action');
            return {
                authorized: false,
                reason: 'User role not found in group'
            };
        }

        const auth = ActionAuthorizer.authorize(action, userRole as any);

        if (!auth.authorized) {
            logger.error({
                action,
                userPhone,
                userRole,
                reason: auth.reason
            }, '🔴 SECURITY: Authorization failed for action');
        }

        return auth;
    }

    async handle(message: RoutedMessage): Promise<GAOutput> {
        const taskType = (message as any).task_type || 'MODERATION';
        const schoolId = message.identity?.schoolId;
        const groupJid = message.from; // The incoming group JID
        
        // 🚨 CRITICAL FIX: GA should ONLY respond to configured school groups
        // Check if this group JID matches a school's configured whatsapp_group_jid
        const configuredSchoolId = await this.findSchoolByGroupJid(groupJid);
        
        if (!configuredSchoolId) {
            // This group is not registered to any school - GA should NOT respond
            logger.warn({ 
                msgId: message.id, 
                groupJid: message.from 
            }, '🚫 GA: Ignoring message from unconfigured group. Group not linked to any school.');
            
            // Return silent no-op - don't respond in this group
            return {
                agent: 'GA',
                reply_text: '',  // Empty response
                action_required: 'NONE',
                action_payload: {},
                confidence_score: 0,
                moderation_flag: 'CLEAN'
            };
        }
        
        // Use the configured schoolId from the group registration
        const effectiveSchoolId = configuredSchoolId;
        
        logger.info({ 
            msgId: message.id, 
            groupJid: message.from,
            schoolId: effectiveSchoolId 
        }, '✅ GA: Processing message from configured school group');
        
        const isAdminMessage = (message as any).isAdminMessage || false;
        const senderIdentity = (message as any).senderIdentity;
        
        logger.info({ 
            msgId: message.id, 
            from: message.from, 
            taskType, 
            schoolId,
            isAdminMessage,
            senderRole: senderIdentity?.role
        }, 'GA handling message/event');

        // ============ SPECIAL HANDLING: ADMIN POSTING IN GROUP ============
        if (isAdminMessage && senderIdentity?.role === 'admin') {
            logger.info({ 
                adminName: senderIdentity?.name,
                adminPhone: senderIdentity?.phone,
                message: message.body 
            }, '🔔 [GA] ADMIN DIRECTIVE - Broadcasting to parents');
            
            return {
                agent: 'GA',
                reply_text: `📢 *Message from ${senderIdentity?.name || 'School Admin'}*:\n\n${message.body}\n\n✅ We're here to support you with any questions about this.`,
                action_required: 'SEND_MESSAGE',
                action_payload: {},
                confidence_score: 1.0,
                moderation_flag: 'CLEAN'
            };
        }

        try {
            // ============ STEP 1: LOAD CONTEXT ============
            
            // Get full context memory for this user (last 10 messages + relevant summaries)
            const memResult = await MemoryOrchestrator.getFullContext(
                effectiveSchoolId,
                (message as any).user_id,
                message.from,
                message.body,
                'GA'
            );
            const memData = typeof memResult === 'string' ? { context: memResult, hasPendingResponse: false } : memResult;
            const contextMemory = memData.context;
            const hasPendingAdminResponse = memData.hasPendingResponse;

            // Get school-specific GA context (pulse schedule, emergency mode, etc.)
            const gaContext = await GARepository.getGAContext(effectiveSchoolId);
            
            // ✅ GA FIX 1.2: Load school_type for context-aware communication
            const schoolData: any = await new Promise((resolve) => {
                db.getDB().get(
                    `SELECT school_type FROM schools WHERE id = ?`,
                    [effectiveSchoolId],
                    (err, row: any) => resolve(row || {school_type: 'SECONDARY'})
                );
            });
            
            // ============ STEP 2: BUILD SYSTEM PROMPT ============
            
            const systemPrompt = await PromptEngine.assemble({
                agent: 'ga',
                schoolId: effectiveSchoolId,
                dynamicVars: {
                    school_type: schoolData.school_type || 'SECONDARY',
                    task_type: taskType,
                    current_time: new Date().toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos' }),
                    current_hour: new Date().getHours(),
                    day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()],
                    new_member_name: (message as any).new_member_name || 'Parent',
                    input_text: message.body,
                    is_emergency_mode: gaContext?.isInEmergencyMode ? 'YES' : 'NO',
                    emergency_reason: gaContext?.emergencyReason || 'None',
                    last_pulse_time: gaContext?.lastPulseMorning?.toLocaleString() || 'Never',
                    member_count: gaContext?.memberCount || 0
                }
            });

            // ============ STEP 3: CALL LLM WITH MEMORY CONTEXT ============

            const fullPrompt = `${systemPrompt}\n\n=== USER CONVERSATION HISTORY ===\n${contextMemory}`;
            
            // ENFORCE JSON OUTPUT VIA SYSTEM MESSAGE
            const systemMessage = `You are a JSON response engine. You will ONLY output valid JSON. Nothing else.
Your output MUST be valid JSON that can be parsed by JSON.parse(). 
Do not include any markdown, code blocks, explanations, or preamble.
Start your response with { and end with }
All responses must follow the schema provided in the base prompt.`;
            
            const aiRes = await aiProvider.generateText(GA_CONFIG, message.body, systemMessage + '\n\n' + fullPrompt);
            
            logger.debug({ rawResponse: aiRes.text.substring(0, 200) }, 'GA LLM raw response');
            
            // ============ STEP 4: PARSE RESPONSE (WITH FALLBACKS) ============

            const parseResult = await RobustJsonParser.parse(aiRes.text);
            
            logger.debug({ 
                parseResultKeys: Object.keys(parseResult), 
                hasSuccess: 'success' in parseResult,
                hasData: 'data' in parseResult,
                parseResultType: typeof parseResult
            }, 'Parse result structure');
            
            // RobustJsonParser returns { success: true, data: {...} } - unwrap it
            let parsed: any;
            if (parseResult && typeof parseResult === 'object' && 'success' in parseResult && parseResult.success && parseResult.data) {
                parsed = parseResult.data;
                logger.debug({ unwrapped: true, parsedKeys: Object.keys(parsed) }, 'Unwrapped parse result');
            } else {
                parsed = parseResult as any as GAOutput;
                logger.debug({ unwrapped: false, parsedKeys: Object.keys(parsed || {}) }, 'Using parse result directly');
            }
            
            logger.debug({ parsed, hasReplyText: !!parsed.reply_text, replyText: parsed.reply_text?.substring(0, 100) }, 'GA parsed response');
            
            // Ensure reply_text is LLM-generated (no placeholders)
            if (!parsed.reply_text || parsed.reply_text.length === 0) {
                logger.warn({ schoolId: effectiveSchoolId, from: message.from, parsedAction: parsed.action_required }, 'GA returned empty reply_text, generating fallback');
                parsed.reply_text = await this.generateFallbackReply(taskType, effectiveSchoolId);
                logger.info({ schoolId: effectiveSchoolId, fallbackReply: parsed.reply_text }, 'GA fallback reply generated');
            }

            // ============ STEP 5: ACTION SANITIZER ============
            
            const allowedActions: GAActionType[] = ['DELETE_MESSAGE', 'SEND_MESSAGE', 'GREET_NEW_MEMBER', 'LOG_MODERATION', 'ESCALATE_TO_ADMIN', 'NONE'];
            if (!allowedActions.includes(parsed.action_required)) {
                logger.warn({ leakedAction: parsed.action_required, schoolId: effectiveSchoolId }, 'GA attempted restricted action. Resetting to NONE.');
                parsed.action_required = 'NONE';
            }

            // 🔐 PHASE 1: MASTER AUTHORIZATION CHECK
            // Validate that user can perform the requested action
            if (parsed.action_required !== 'NONE') {
                const authResult = await this.validateActionAuthorization(
                    parsed.action_required,
                    message.from,
                    groupJid,
                    effectiveSchoolId
                );

                if (!authResult.authorized) {
                    logger.error({
                        action: parsed.action_required,
                        userPhone: message.from,
                        groupJid,
                        reason: authResult.reason
                    }, '🔴 ACTION BLOCKED: Authorization failed');
                    
                    parsed.reply_text = `🔒 I cannot perform this action: ${authResult.reason || 'Insufficient permissions'}`;
                    parsed.action_required = 'NONE';
                }

                if (authResult.authorized) {
                    logger.info({
                        action: parsed.action_required,
                        userPhone: message.from,
                        groupJid
                    }, '✅ [GA] Authorization granted - proceeding with action');
                }
            }

            // ============ STEP 6: EXECUTE ACTIONS ============

            // ✅ GA FIX 2.2: Record moderation without hardcoding (LLM-driven via action_payload)
            if (parsed.action_required === 'LOG_MODERATION') {
                await this.executeLogModeration(effectiveSchoolId, message.from, parsed);
            }

            // ✅ GA FIX 2.2: Record new member greeting (LLM-driven via action_payload)
            if (parsed.action_required === 'GREET_NEW_MEMBER') {
                await this.executeGreetNewMember(effectiveSchoolId, message.from, parsed);
            }

            // ✅ GA FIX 2.1: Clean escalation construction
            // LLM sets admin_escalation.required = true when needed
            // No manual escalation_payload construction - use clean admin_escalation field
            if (parsed.action_required === 'ESCALATE_TO_ADMIN' || parsed.admin_escalation?.required) {
                // LLM has already populated admin_escalation with proper context
                // Just log and pass it through - dispatcher will handle escalation
                logger.info({ 
                    schoolId: effectiveSchoolId, 
                    escalationReason: parsed.admin_escalation?.reason,
                    urgency: parsed.admin_escalation?.urgency
                }, '🚨 GA triggering escalation via admin_escalation field');
            }

            // ============ STEP 7: STORE CONVERSATION IN MEMORY ============

            await this.storeConversationInMemory(
                effectiveSchoolId,
                message.from,
                (message as any).user_id,
                message.body,
                parsed.reply_text,
                parsed.action_required,
                parsed.moderation_flag
            );

            // ============ STEP 8: UPDATE GA CONTEXT ============

            await this.updateGAContext(effectiveSchoolId, taskType, parsed);

            return parsed;

        } catch (error) {
            logger.error({ error, schoolId: effectiveSchoolId, from: message.from }, 'GA processing failed');
            
            // Return safe fallback
            return {
                agent: 'GA',
                reply_text: "We're experiencing a technical issue. Please try again or contact the school.",
                action_required: 'NONE',
                confidence_score: 0,
                moderation_flag: 'CLEAN'
            };
        }
    }

    // ============ PRIVATE HELPER METHODS ============

    private async executeLogModeration(schoolId: string, messageAuthor: string, action: GAOutput): Promise<void> {
        try {
            await GARepository.logModeration({
                schoolId,
                messageId: action.action_payload?.message_id || 'unknown',
                messageAuthor: messageAuthor,
                actionType: 'FLAGGED',
                reason: action.action_payload?.reason || 'Content moderation',
                moderationNote: action.reply_text
            });

            logger.info({ schoolId, messageAuthor }, 'Moderation logged successfully');
        } catch (error) {
            logger.error({ error, schoolId }, 'Failed to log moderation');
            // Don't fail - action already executed via LLM response
        }
    }

    private async executeGreetNewMember(schoolId: string, newMemberPhone: string, action: GAOutput): Promise<void> {
        try {
            await GARepository.recordNewMemberGreeting({
                schoolId,
                memberPhone: newMemberPhone,
                greetingText: action.reply_text,
                greetedAt: new Date()
            });

            logger.info({ schoolId, newMemberPhone }, 'New member greeting recorded');
        } catch (error) {
            logger.error({ error, schoolId }, 'Failed to record new member greeting');
        }
    }

    private async storeConversationInMemory(
        schoolId: string,
        userPhone: string,
        userId: string | undefined,
        userMessage: string,
        assistantMessage: string,
        actionPerformed: string,
        moderationFlag: string
    ): Promise<void> {
        try {
            // Store user message
            await GARepository.storeConversationMessage({
                schoolId,
                agent: 'GA',
                userPhone,
                userId: userId || 'unknown',
                messageRole: 'user',
                messageContent: userMessage,
                actionPerformed: null,
                actionStatus: null
            });

            // Store assistant response
            await GARepository.storeConversationMessage({
                schoolId,
                agent: 'GA',
                userPhone,
                userId: userId || 'unknown',
                messageRole: 'assistant',
                messageContent: assistantMessage,
                actionPerformed: actionPerformed,
                actionStatus: 'completed'
            });

            logger.debug({ schoolId, userPhone }, 'Conversation stored in memory');
        } catch (error) {
            logger.error({ error, schoolId }, 'Failed to store conversation in memory');
            // Don't fail - memory storage is non-critical
        }
    }

    private async updateGAContext(schoolId: string, taskType: string, action: GAOutput): Promise<void> {
        try {
            const now = new Date();
            const hour = now.getHours();

            let updateData: any = {};

            // Update pulse times based on current hour
            if (hour >= 6 && hour < 12) {
                updateData.last_pulse_morning = now;
            } else if (hour >= 12 && hour < 18) {
                updateData.last_pulse_afternoon = now;
            } else {
                updateData.last_pulse_evening = now;
            }

            if (taskType === 'NEW_MEMBER') {
                updateData.member_count_increment = 1;
            }

            await GARepository.updateGAContext(schoolId, updateData);
        } catch (error) {
            logger.error({ error, schoolId }, 'Failed to update GA context');
        }
    }

    private async generateFallbackReply(taskType: string, schoolId: string): Promise<string> {
        try {
            // Generate a context-aware fallback using LLM
            const fallbackPrompt = `You are the school group administrator. Generate a brief, warm response for a ${taskType} interaction. Focus on African parent values: community, support, and transparency. Keep it short (2-3 sentences).`;
            
            const response = await aiProvider.generateText(GA_CONFIG, '', fallbackPrompt);
            return response.text.trim();
        } catch (error) {
            logger.warn({ error }, 'Fallback reply generation failed, using default');
            return "Thank you for reaching out. The school appreciates your engagement with our community.";
        }
    }

    /**
     * 🚫 DEPRECATED: Auto group linking disabled for security
     * Groups must be explicitly linked during SA setup via whatsapp_group_link
     * GA will only respond to groups that are properly configured in schools table
     */
    private async captureGroupJidForSchool(groupJid: string, schoolId: string): Promise<void> {
        // This method is deprecated - groups must be configured during SA setup
        // GA now only responds to groups with matching whatsapp_group_jid in schools table
        logger.debug({ groupJid, schoolId }, '🔍 [GA CAPTURE] Auto-linking disabled - groups must be configured during setup');
        return;
    }
}
