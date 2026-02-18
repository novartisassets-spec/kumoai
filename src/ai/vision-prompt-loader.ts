/**
 * Vision Prompt Loader
 * 
 * Loads unified vision extraction prompts for each agent from dedicated files.
 * Each agent has ONE vision prompt file containing sections for different image types.
 * The AI auto-detects the image type and responds accordingly.
 * 
 * This replaces hardcoded prompts in agents.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export class VisionPromptLoader {
    private static readonly PROMPT_DIR = path.join(process.cwd(), 'prompts', 'vision');
    private static cache: Map<string, string> = new Map();

    /**
     * Load unified vision prompt for a specific agent
     * 
     * Each agent gets ONE vision prompt file with auto-detection for image types.
     * Example: ta-vision.md contains both marks and attendance sections.
     * 
     * @param agentType - Agent type identifier
     * @returns Vision prompt text that handles all document types
     */
    static loadAgentPrompt(agentType: 'ta' | 'primary-ta' | 'sa' | 'pa' | 'ga'): string {
        const cacheKey = agentType;
        
        // Return from cache if available
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        try {
            const fileName = `${agentType}-vision.md`;
            const filePath = path.join(this.PROMPT_DIR, fileName);

            if (!fs.existsSync(filePath)) {
                logger.warn({ agentType, filePath }, 'Vision prompt file not found, using default');
                return this.getDefaultPrompt(agentType);
            }

            const prompt = fs.readFileSync(filePath, 'utf-8');
            this.cache.set(cacheKey, prompt);
            
            logger.debug({ agentType }, 'Loaded unified vision prompt from file');
            return prompt;

        } catch (error) {
            logger.error({ error, agentType }, 'Failed to load vision prompt');
            return this.getDefaultPrompt(agentType);
        }
    }

    /**
     * Get default prompt if file doesn't exist
     * Provides basic fallback instructions
     */
    private static getDefaultPrompt(agentType: string): string {
        const defaults: Record<string, string> = {
            'ta': `You are analyzing documents for Secondary schools (JSS/SSS). Detect if it's marks sheet (extract CA1, CA2, Midterm, Exam, calculate total and position) or attendance (extract status codes). Return JSON.`,
            'primary-ta': `You are analyzing documents for Primary schools (P1-P6). Detect if it's marks sheet (extract CA1, CA2, Exam ONLY - no midterm, no ranking) or attendance (extract status codes). Return JSON.`,
            'sa': `You are analyzing escalation support documents. Extract issue context, urgency level, and recommended actions. Return JSON.`,
            'pa': `You are analyzing payment receipts and financial documents. Extract payment details, amount, date, and verification info. Return JSON.`,
            'ga': `You are analyzing group management documents. Extract group info, members, activities, and fund tracking. Return JSON.`
        };
        
        return defaults[agentType] || `Analyze image and extract structured data. Return JSON format.`;
    }

    /**
     * Clear cache (useful for testing)
     */
    static clearCache(): void {
        this.cache.clear();
        logger.info('Vision prompt cache cleared');
    }

    /**
     * Preload all prompts on startup
     */
    static preloadAll(): void {
        const agents = ['ta', 'primary-ta', 'sa', 'pa', 'ga'] as const;

        for (const agent of agents) {
            try {
                this.loadAgentPrompt(agent);
                logger.debug({ agent }, 'Preloaded vision prompt');
            } catch (error) {
                logger.warn({ agent, error }, 'Failed to preload vision prompt');
            }
        }
    }
}
