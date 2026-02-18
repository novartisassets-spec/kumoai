/**
 * GA PULSE SERVICE
 * Generates and sends automated pulse messages to school groups
 * Handles: Morning, Afternoon, Evening pulse messages with LLM-generated content
 */

import { aiProvider } from '../ai/provider';
import { GA_CONFIG } from '../ai/config';
import { PromptEngine } from '../core/prompt-engine';
import { logger } from '../utils/logger';
import { GARepository } from '../db/repositories/ga.repo';
import { messenger } from './messenger';
import { db } from '../db';

export interface PulseGenerationContext {
    schoolId: string;
    pulseType: 'MORNING' | 'AFTERNOON' | 'EVENING';
    schoolName?: string;
    studentCount?: number;
    recentAnnouncements?: string[];
}

export class GAPulseService {
    /**
     * Generate an automated pulse message based on time of day
     * - MORNING: Warm greeting + attendance reminder + day preview
     * - AFTERNOON: School out soon + parent encouragement
     * - EVENING: Gratitude message + goodnight
     */
    static async generatePulseMessage(context: PulseGenerationContext): Promise<string> {
        try {
            const { schoolId, pulseType, schoolName, studentCount, recentAnnouncements } = context;

            // Get school info if not provided
            let school: any = null;
            if (!schoolName) {
                school = await new Promise((resolve) => {
                    db.getDB().get(`SELECT name FROM schools WHERE id = ?`, [schoolId], (err, row) => {
                        resolve(row);
                    });
                });
            }

            // Get recent class schedule/announcements for context
            const announcements = recentAnnouncements || await this.getRecentAnnouncements(schoolId);

            // Build dynamic prompt based on pulse type
            let pulsePrompt = '';
            let pulseTheme = '';

            switch (pulseType) {
                case 'MORNING':
                    pulseTheme = 'MORNING_GREETING';
                    pulsePrompt = `Generate a warm, energetic morning greeting for school parents at 7 AM. 
Include:
1. Enthusiastic greeting (different from previous mornings)
2. Quick reminder about today's learning activities
3. Encouragement for parents to check their children's uniforms/bags
4. Emphasis on community care

Keep it 3-4 sentences, warm and authentic Nigerian/African English tone.
Make it feel personal, not robotic.`;
                    break;

                case 'AFTERNOON':
                    pulseTheme = 'AFTERNOON_CHECK_IN';
                    pulsePrompt = `Generate an afternoon check-in message for school parents at 3 PM.
Include:
1. Acknowledgment that children will be leaving school soon
2. Reminder for parents to prepare to receive their children
3. A learning tip parents can discuss with children today
4. Appreciation for their partnership

Keep it 3-4 sentences, supportive and practical.
Different tone from morning - more reflective and focused on parent-child connection.`;
                    break;

                case 'EVENING':
                    pulseTheme = 'EVENING_GRATITUDE';
                    pulsePrompt = `Generate a heartfelt evening message for school parents at 8 PM.
Include:
1. Deep gratitude for their sacrifice and commitment to their children's education
2. Acknowledgment of their hard work during the day
3. Encouragement for quality time with children tonight
4. Goodnight blessing appropriate for African cultural context

Keep it 3-4 sentences, emotionally resonant and deeply appreciative.
This should make parents feel seen, valued, and part of the school family.
Use phrases that celebrate African parental values.`;
                    break;
            }

            // Build system prompt
            const systemPrompt = await PromptEngine.assemble({
                agent: 'ga',
                schoolId,
                dynamicVars: {
                    school_name: schoolName || school?.name || 'Our School',
                    pulse_type: pulseType,
                    pulse_theme: pulseTheme,
                    student_count: studentCount?.toString() || 'hundreds',
                    recent_announcements: announcements.slice(0, 2).join(' | ') || 'None today',
                    current_hour: new Date().getHours()
                }
            });

            logger.info({ schoolId, pulseType }, `[GA PULSE] Generating ${pulseType} message`);

            // Call LLM to generate unique pulse message
            const aiRes = await aiProvider.generateText(
                GA_CONFIG,
                pulsePrompt,
                systemPrompt
            );

            let pulseMessage = aiRes.text.trim();

            // Clean up any markdown formatting
            pulseMessage = pulseMessage
                .replace(/```/g, '')
                .replace(/\*\*/g, '*')
                .trim();

            logger.info({ schoolId, pulseType, messageLength: pulseMessage.length }, `[GA PULSE] Message generated successfully`);

            return pulseMessage;

        } catch (error) {
            logger.error({ error, context }, '[GA PULSE] Failed to generate pulse message');
            throw error;
        }
    }

    /**
     * Send pulse message to all school groups
     */
    static async sendPulseToGroups(pulseType: 'MORNING' | 'AFTERNOON' | 'EVENING'): Promise<number> {
        try {
            // Get all active schools with groups
            const schools: any[] = await new Promise((resolve) => {
                db.getDB().all(
                    `SELECT id, name, whatsapp_group_link FROM schools 
                     WHERE whatsapp_group_link IS NOT NULL AND is_active = 1`,
                    [],
                    (err, rows) => resolve(rows || [])
                );
            });

            logger.info({ count: schools.length, pulseType }, `[GA PULSE] Sending ${pulseType} to ${schools.length} schools`);

            let successCount = 0;

            for (const school of schools) {
                try {
                    // Generate pulse message
                    const pulseMessage = await this.generatePulseMessage({
                        schoolId: school.id,
                        pulseType,
                        schoolName: school.name
                    });

                    // Send to group
                    await messenger.sendPush(school.id, school.whatsapp_group_link, pulseMessage);

                    // Update GA context with pulse timestamp
                    const updateKey = `lastPulse${pulseType.charAt(0).toUpperCase()}${pulseType.slice(1).toLowerCase()}`;
                    const updateData: any = {};
                    updateData[updateKey] = new Date();

                    await GARepository.updateGAContext(school.id, updateData);

                    successCount++;
                    logger.info({ schoolId: school.id, pulseType }, `[GA PULSE] Sent to ${school.name}`);

                } catch (schoolError) {
                    logger.error({ schoolId: school.id, error: schoolError, pulseType }, `[GA PULSE] Failed for school`);
                    // Continue with next school
                }
            }

            logger.info({ successCount, total: schools.length, pulseType }, `[GA PULSE] Batch complete`);
            return successCount;

        } catch (error) {
            logger.error({ error, pulseType }, '[GA PULSE] Batch send failed');
            throw error;
        }
    }

    /**
     * Get recent school announcements for context
     */
    private static async getRecentAnnouncements(schoolId: string): Promise<string[]> {
        try {
            const announcements: any[] = await new Promise((resolve) => {
                db.getDB().all(
                    `SELECT message_content FROM conversation_memory 
                     WHERE school_id = ? AND agent = 'GA' AND message_role = 'assistant'
                     ORDER BY message_timestamp DESC LIMIT 5`,
                    [schoolId],
                    (err, rows) => resolve(rows || [])
                );
            });

            return announcements.map(a => a.message_content).slice(0, 2);

        } catch (error) {
            logger.warn({ error, schoolId }, '[GA PULSE] Failed to get recent announcements');
            return [];
        }
    }

    /**
     * Check if pulse is needed now (handles edge cases like missed pulses)
     */
    static shouldTriggerPulse(hour: number): 'MORNING' | 'AFTERNOON' | 'EVENING' | null {
        // Morning: 7-8 AM
        if (hour === 7) return 'MORNING';
        // Afternoon: 3-4 PM
        if (hour === 15) return 'AFTERNOON';
        // Evening: 8-9 PM
        if (hour === 20) return 'EVENING';

        return null;
    }
}
