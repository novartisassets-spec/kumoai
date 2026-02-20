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
            // 1. Fetch School Specific Data from DB
            const schoolData = await this.getSchoolData(data.schoolId);
            
            // 1.5 Fetch Setup Draft Data (if in setup mode)
            let setupDraftData = {};
            if (data.agent.includes('setup')) {
                setupDraftData = await this.getSetupDraftData(data.schoolId);
            }

            // 1.8 Fetch Recent Context (PDFs, Logs)
            const recentContext = await this.getRecentContext(data.schoolId);

            // 2. Map Variables (Priority: Dynamic > Setup Draft > School Data > Defaults)
            const vars = {
                school_name: 'Our School', // Default fallback
                ...schoolData,
                // ✅ Fix: Map school data to prompt-specific universe keys
                classes_universe: schoolData.school_classes,
                subjects_universe: schoolData.school_subjects,
                ...setupDraftData, // Overlay draft data
                ...data.dynamicVars, // Overlay dynamic vars (highest priority)
                recent_context: recentContext
            };

            // 3. Load Templates
            let assembledPrompt = '';
            
            // ✅ For ta_setup: Use ONLY setup.md (merged base + setup)
            if (data.agent === 'ta_setup') {
                const setupPath = path.join(this.PROMPT_DIR, data.agent, 'setup.md');
                if (fs.existsSync(setupPath)) {
                    assembledPrompt = fs.readFileSync(setupPath, 'utf-8');
                } else {
                    throw new Error(`setup.md not found for agent ${data.agent}`);
                }
            } else {
                // For other agents: Combine base.md + main.md as before
                const basePrompt = fs.readFileSync(path.join(this.PROMPT_DIR, data.agent, 'base.md'), 'utf-8');
                const templateFile = data.agent.includes('setup') ? 'setup.md' : 'main.md';
                const templatePath = path.join(this.PROMPT_DIR, data.agent, templateFile);
                
                let assembledBase = basePrompt;
                let assembledMain = '';
                
                if (fs.existsSync(templatePath)) {
                    assembledMain = fs.readFileSync(templatePath, 'utf-8');
                } else {
                    // Fallback to main.md if specialized template doesn't exist
                    const mainPath = path.join(this.PROMPT_DIR, data.agent, 'main.md');
                    if (fs.existsSync(mainPath)) {
                        assembledMain = fs.readFileSync(mainPath, 'utf-8');
                    }
                }
                
                // Inject variables into both parts
                for (const [key, value] of Object.entries(vars)) {
                    const placeholder = new RegExp(`{{${key}}}`, 'g');
                    const replacement = value !== undefined && value !== null ? String(value) : '';
                    assembledBase = assembledBase.replace(placeholder, replacement);
                    assembledMain = assembledMain.replace(placeholder, replacement);
                }
                
                assembledPrompt = [assembledBase, assembledMain].filter(Boolean).join('\n\n');
            }
            
            // Inject variables into ta_setup prompt
            if (data.agent === 'ta_setup') {
                for (const [key, value] of Object.entries(vars)) {
                    const placeholder = new RegExp(`{{${key}}}`, 'g');
                    const replacement = value !== undefined && value !== null ? String(value) : '';
                    assembledPrompt = assembledPrompt.replace(placeholder, replacement);
                }
            }
            
            // 3.5 Voice Context Injection
            const voiceContext = (data.dynamicVars as any)?.voice_context || '';
            
            logger.debug({ agent: data.agent, schoolId: data.schoolId, varCount: Object.keys(vars).length }, '🔍 Assembling prompt with variables');

            // 4. Return: prompt + voice
            return [assembledPrompt, voiceContext].filter(Boolean).join('\n\n');

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

                const classes = row.classes_json ? JSON.parse(row.classes_json) : [];
                const subjects = row.subjects_json ? JSON.parse(row.subjects_json) : [];

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
                    agent_setup: config.agent_setup?.[row.id] || 'Default Configuration',
                    // Admin name from user table (most reliable)
                    admin_name: row.admin_name || 'Admin',
                    // Universe Context for Verification
                    school_classes: classes.length > 0 ? classes.join(', ') : 'Not Configured',
                    school_subjects: subjects.length > 0 ? subjects.join(', ') : 'Not Configured'
                });
            });
        });
    }

    private static async getSetupDraftData(schoolId: string): Promise<Record<string, any>> {
        return new Promise((resolve) => {
            db.getDB().get(`SELECT config_draft FROM setup_state WHERE school_id = ?`, [schoolId], (err, row: any) => {
                if (!row || !row.config_draft) return resolve({});
                try {
                    const draft = JSON.parse(row.config_draft);
                    // Map draft fields to prompt variables
                    resolve({
                        draft_school_name: draft.name,
                        draft_address: draft.address,
                        draft_phone: draft.phone,
                        draft_admin_name: draft.admin_name,
                        draft_school_type: draft.school_type || '',
                        draft_country: draft.country || '',
                        draft_classes: draft.classes?.join(', ') || '',
                        draft_subjects: draft.subjects?.join(', ') || ''
                    });
                } catch (e) {
                    resolve({});
                }
            });
        });
    }

    private static async getRecentContext(schoolId: string): Promise<string> {
        return new Promise((resolve) => {
            const contextParts: string[] = [];

            // 1. Fetch Recent PDFs (Last 24 hours)
            db.getDB().all(
                `SELECT file_name, document_type, created_at FROM pdf_documents 
                 WHERE school_id = ? AND created_at > datetime('now', '-1 day') 
                 ORDER BY created_at DESC LIMIT 5`,
                [schoolId],
                (err, rows: any[]) => {
                    if (rows && rows.length > 0) {
                        const docs = rows.map(r => `- [${r.document_type}] ${r.file_name} (Generated: ${r.created_at})`).join('\n');
                        contextParts.push(`**RECENTLY GENERATED DOCUMENTS**:\n${docs}`);
                    }

                    // 2. Fetch Recent Audit Logs (Last 5 actions)
                    db.getDB().all(
                        `SELECT action, target_resource, timestamp FROM audit_logs 
                         WHERE details LIKE ? 
                         ORDER BY timestamp DESC LIMIT 5`,
                        [`%${schoolId}%`], // Rough filter, better if school_id column exists in audit_logs
                        (err, logs: any[]) => {
                            if (logs && logs.length > 0) {
                                const actions = logs.map(l => `- ${l.action} on ${l.target_resource} (${l.timestamp})`).join('\n');
                                contextParts.push(`**RECENT SYSTEM ACTIONS**:\n${actions}`);
                            }
                            
                            resolve(contextParts.length > 0 ? contextParts.join('\n\n') : 'No recent system activity.');
                        }
                    );
                }
            );
        });
    }
}