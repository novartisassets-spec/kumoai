import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { logger } from '../utils/logger';
import { VoiceResponseHelper } from '../services/voice-response-helper';

export interface PromptTemplateData {
    agent: 'pa' | 'ta' | 'sa' | 'sa_setup' | 'ta_setup' | 'ga' | 'primary-ta' | 'primary-ta_setup';
    schoolId: string;
    dynamicVars: Record<string, string | number | boolean>;
}

export class PromptEngine {
    private static readonly PROMPT_DIR = path.join(process.cwd(), 'prompts');

    static async assemble(data: PromptTemplateData): Promise<string> {
        try {
            const basePrompt = fs.readFileSync(path.join(this.PROMPT_DIR, data.agent, 'base.md'), 'utf-8');
            const mainTemplate = fs.readFileSync(path.join(this.PROMPT_DIR, data.agent, 'main.md'), 'utf-8');
            
            // 1. Fetch School Specific Data from DB
            const schoolData = await this.getSchoolData(data.schoolId);
            
            // 2. Map Variables
            const vars = {
                school_name: 'Our School', // Default fallback
                ...schoolData,
                ...data.dynamicVars
            };

            // 3. Inject into Templates
            let assembledBase = basePrompt;
            let assembledMain = mainTemplate;
            
            // 3.5 Voice Context Injection
            const voiceContext = (data.dynamicVars as any)?.voice_context || '';
            
            logger.debug({ agent: data.agent, schoolId: data.schoolId, varCount: Object.keys(vars).length }, '🔍 Assembling prompt with variables');

            for (const [key, value] of Object.entries(vars)) {
                const placeholder = new RegExp(`{{${key}}}`, 'g');
                const replacement = value !== undefined && value !== null ? String(value) : '';
                assembledBase = assembledBase.replace(placeholder, replacement);
                assembledMain = assembledMain.replace(placeholder, replacement);
            }

            // 4. Combine: base + main + voice
            return [assembledBase, assembledMain, voiceContext].filter(Boolean).join('\n\n');

        } catch (error) {
            logger.error({ error, data }, 'Failed to assemble prompt');
            throw error;
        }
    }

    private static async getSchoolData(schoolId: string): Promise<Record<string, any>> {
        return new Promise((resolve, reject) => {
            logger.debug({ schoolId }, '🔍 [PROMPT_ENGINE] Fetching school data');
            db.getDB().get(`SELECT * FROM schools WHERE id = ?`, [schoolId], (err, row: any) => {
                if (err) {
                    logger.error({ err, schoolId }, '❌ [PROMPT_ENGINE] Database error fetching school');
                    return reject(err);
                }
                if (!row) {
                    logger.warn({ schoolId }, '⚠️ [PROMPT_ENGINE] No school found for ID');
                    return resolve({});
                }

                logger.debug({ schoolId, name: row.name }, '✅ [PROMPT_ENGINE] School data loaded');

                const config = JSON.parse(row.config_json || '{}');
                const gradingConfig = row.grading_config ? (typeof row.grading_config === 'string' ? JSON.parse(row.grading_config) : row.grading_config) : null;
                
                let gradingLogicDesc = 'Dynamic Assessment Configuration:';
                if (gradingConfig && gradingConfig.pillars) {
                    const pillarList = gradingConfig.pillars.map((p: any) => `- ${p.name}: Max ${p.max_score} points`).join('\n');
                    gradingLogicDesc = `**Assessment Components (Pillars)**:\n${pillarList}\n\n**Total Maximum**: ${gradingConfig.total_max || 100} points\n**Student Ranking**: ${gradingConfig.rank_students ? 'ENABLED (Positions 1st, 2nd, 3rd, etc.)' : 'DISABLED (No ranking)'}\n**Midterm Exam**: ${gradingConfig.pillars.some((p: any) => /midterm|mid-term/i.test(p.name)) ? 'INCLUDED' : 'NOT INCLUDED'}`;
                }

                resolve({
                    school_name: row.name || 'Our School',
                    school_id: row.id,
                    school_type: row.school_type || config.type || 'Not Set',
                    school_country: config.country || 'Nigeria',
                    school_address: config.address || 'Not Provided',
                    school_policy: config.policy || 'Standard Nigerian Education Policy Applies.',
                    grading_logic: gradingLogicDesc,
                    fee_structure: config.fee_structure || row.fees_config || 'Tuition Based',
                    setup_status: row.setup_status,
                    admin_signature_path: config.admin_signature_path || 'Not Uploaded',
                    agent_setup: config.agent_setup?.[row.id] || 'Default Configuration'
                });
            });
        });
    }
}