import { aiProvider } from '../../ai/provider';
import { SA_TA_CONFIG } from '../../ai/config';
import { ActionAwareMessage } from './types';
import { logger } from '../../utils/logger';

export class SummarizerService {
    static async summarizeBlock(messages: ActionAwareMessage[], schoolType: 'PRIMARY' | 'SECONDARY' = 'SECONDARY'): Promise<string> {
        const historyText = messages.map(m => 
            `[${m.timestamp}] ${m.sender_role}: ${m.content} (Action: ${m.action_performed || 'None'}, Status: ${m.action_status || 'N/A'})`
        ).join('\n');

        const contextGuide = schoolType === 'PRIMARY' 
            ? "Use primary school terminology (pupils, foundations, foundations of learning)." 
            : "Use secondary school terminology (students, exams, subjects).";

        const prompt = `
        You are a High-Density Information Mapping Agent for a School Management System.
        Your goal is to compress a conversation into a "State Record" that preserves 100% of technical and factual value while eliminating 100% of conversational filler.

        STRICT QUALITY RULES:
        1. NO VERBOSITY: Eliminate phrases like "The admin decided to...", "The conversation then moved to...", "It was mentioned that...".
        2. DENSE MAPPING: Use a log-like format. (e.g., "[ACTION] REGISTER_STUDENT: Musa Ibrahim (JSS 1). parent_phone: 234...").
        3. FACT LOCK: Exact names, exact classes, exact IDs only.
        4. TERMINOLOGY: ${contextGuide}
        5. NO FILLER: Do not summarize greetings, "How are you", or small talk.
        6. STATE TRACKING: Explicitly record transitions (e.g., "Results: DRAFT -> LOCKED").

        Conversation Block to Compress:
        ${historyText}
        
        Output only the dense summary. No preamble.
        `;

        try {
            const aiRes = await aiProvider.generateText(SA_TA_CONFIG, prompt, "You are a factual recording agent. You summarize school records with 100% precision. You never guess or drift.");
            return aiRes.text;
        } catch (error) {
            logger.error({ error }, 'Failed to summarize memory block');
            throw error;
        }
    }
}
