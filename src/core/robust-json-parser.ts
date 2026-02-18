/**
 * Robust JSON Parser with multiple fallback strategies
 * Handles malformed JSON from LLM outputs gracefully
 */

import { logger } from '../utils/logger';

export interface ParseResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    fallbackUsed?: string;
}

export class RobustJsonParser {
    /**
     * Parse JSON with multiple fallback strategies
     * 1. Direct parse
     * 2. Remove markdown code blocks
     * 3. Extract JSON object/array from text
     * 4. Attempt repair of common JSON issues
     */
    static parse<T>(text: string, context?: string): ParseResult<T> {
        const trimmed = text.trim();

        // Strategy 1: Direct parse
        try {
            const parsed = JSON.parse(trimmed);
            return { success: true, data: parsed };
        } catch (e) {
            // Continue to next strategy
        }

        // Strategy 2: Remove markdown code blocks
        try {
            const cleaned = trimmed
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();
            
            // If it still has markdown blocks inside, try to extract the first one
            const deeperClean = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
            const target = deeperClean ? deeperClean[1] : cleaned;
            
            const parsed = JSON.parse(target);
            return { success: true, data: parsed, fallbackUsed: 'markdown_cleanup' };
        } catch (e) {
            // Continue to next strategy
        }

        // Strategy 3: Extract first JSON object or array
        try {
            const jsonMatch = trimmed.match(/[\{\[]/);
            if (jsonMatch) {
                const startIdx = jsonMatch.index || 0;
                const substring = trimmed.substring(startIdx);
                
                // Try to find matching bracket
                let depth = 0;
                let endIdx = 0;
                for (let i = 0; i < substring.length; i++) {
                    if (substring[i] === '{' || substring[i] === '[') depth++;
                    if (substring[i] === '}' || substring[i] === ']') depth--;
                    if (depth === 0) {
                        endIdx = i + 1;
                        break;
                    }
                }
                
                if (endIdx > 0) {
                    const extracted = substring.substring(0, endIdx);
                    const parsed = JSON.parse(extracted);
                    return { success: true, data: parsed, fallbackUsed: 'extraction' };
                }
            }
        } catch (e) {
            // Continue to next strategy
        }

        // Strategy 4: Try to repair common issues
        try {
            let repaired = trimmed;
            
            // Remove trailing commas
            repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
            
            // Fix missing quotes on keys (very common from LLMs)
            repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
            
            // Fix single quotes to double quotes (for string values)
            repaired = repaired.replace(/:\s*'([^']*)'/g, ': "$1"');
            
            // Remove comments
            repaired = repaired.replace(/\/\/.*$/gm, '');
            repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, '');
            
            const parsed = JSON.parse(repaired);
            return { success: true, data: parsed, fallbackUsed: 'repair' };
        } catch (e) {
            // Continue to error case
        }

        // All strategies failed
        const errorMsg = `Failed to parse JSON. Context: ${context || 'unknown'}. Text: ${trimmed.substring(0, 100)}...`;
        logger.error({ text: trimmed.substring(0, 200), context }, 'JSON parse failed after all strategies');
        return {
            success: false,
            error: errorMsg
        };
    }

    /**
     * Extract and validate a specific field from potentially malformed JSON
     */
    static extractField<T>(text: string, fieldName: string, defaultValue?: T): T | undefined {
        const parseResult = this.parse<any>(text);
        
        if (!parseResult.success) {
            return defaultValue;
        }

        return parseResult.data?.[fieldName] || defaultValue;
    }

    /**
     * Safely parse JSON array
     */
    static parseArray<T>(text: string, context?: string): T[] {
        const result = this.parse<T[]>(text, context);
        
        if (!result.success || !Array.isArray(result.data)) {
            logger.warn({ context, text: text.substring(0, 100) }, 'Failed to parse as array');
            return [];
        }

        return result.data;
    }
}

export default RobustJsonParser;
