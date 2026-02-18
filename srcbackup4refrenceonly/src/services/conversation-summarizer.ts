import { logger } from '../utils/logger';
import { aiProvider } from '../ai/provider';
import { SA_TA_CONFIG } from '../ai/config';

/**
 * ConversationSummarizer - Creates long-term memory summaries of conversations
 * 
 * Purpose:
 * - Summarizes conversation history when it exceeds word count threshold (~250 words)
 * - Creates condensed "long-term memory" for retrieval
 * - Helps LLM focus on relevant context without being overwhelmed
 * - Stores summaries for future reference
 */

export interface ConversationSummary {
    id: string;
    schoolId: string;
    conversationPeriodStart: Date;
    conversationPeriodEnd: Date;
    wordCount: number;
    summary: string;
    keyPoints: string[];
    escalations: string[];
    decisions: string[];
    timestamp: Date;
}

export class ConversationSummarizer {
    private static readonly WORD_THRESHOLD = 250;  // Summarize at 250 words
    
    /**
     * Count words in a conversation text
     */
    static countWords(text: string): number {
        return text.trim().split(/\s+/).length;
    }
    
    /**
     * Check if conversation has reached summary threshold
     */
    static shouldSummarize(conversationText: string): boolean {
        const wordCount = this.countWords(conversationText);
        return wordCount >= this.WORD_THRESHOLD;
    }
    
    /**
     * Generate a summary of conversation using LLM
     */
    static async summarizeConversation(
        conversationText: string,
        context: {
            schoolId: string;
            originAgent?: string;
            escalationId?: string;
        }
    ): Promise<ConversationSummary> {
        logger.info({ 
            schoolId: context.schoolId,
            wordCount: this.countWords(conversationText),
            hasEscalation: !!context.escalationId
        }, '📝 [SUMMARIZER] Starting conversation summarization');
        
        const wordCount = this.countWords(conversationText);
        
        const summaryPrompt = `You are creating a long-term memory summary of a school conversation.

CONVERSATION TO SUMMARIZE:
${conversationText}

YOUR TASK:
Create a concise summary capturing:
1. Key issues discussed
2. Decisions made
3. Any escalations
4. Important context for future reference
5. Patterns or concerns

Format as JSON:
{
  "summary": "2-3 sentence overview of what happened",
  "key_points": ["point 1", "point 2", "point 3"],
  "escalations": ["escalation ID if any", "what was the issue"],
  "decisions": ["decision 1: what was approved/rejected", "decision 2: ..."],
  "patterns": ["pattern observed", "concern noted"]
}

Keep summaries CONCISE. This will be stored for future reference, not shown to users.`;

        try {
            const summaryResponse = await aiProvider.generateText(
                SA_TA_CONFIG,
                summaryPrompt,
                'Create a structured summary of conversation history for long-term memory.'
            );
            
            const summaryData = JSON.parse(summaryResponse.text);
            
            const summary: ConversationSummary = {
                id: `SUM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                schoolId: context.schoolId,
                conversationPeriodStart: new Date(),
                conversationPeriodEnd: new Date(),
                wordCount: wordCount,
                summary: summaryData.summary || '',
                keyPoints: summaryData.key_points || [],
                escalations: summaryData.escalations || [],
                decisions: summaryData.decisions || [],
                timestamp: new Date()
            };
            
            logger.info({ 
                schoolId: context.schoolId,
                summaryId: summary.id,
                wordCount: wordCount,
                keyPoints: summary.keyPoints.length,
                escalations: summary.escalations.length
            }, '✅ [SUMMARIZER] Conversation summarized successfully');
            
            logger.debug({ 
                schoolId: context.schoolId,
                summary: summary.summary,
                keyPoints: summary.keyPoints
            }, '📋 [SUMMARIZER] Summary content');
            
            return summary;
            
        } catch (error) {
            logger.error({ 
                schoolId: context.schoolId,
                error: (error as any).message
            }, '❌ [SUMMARIZER] Failed to summarize conversation');
            
            // Return minimal summary on error
            return {
                id: `SUM-${Date.now()}-ERROR`,
                schoolId: context.schoolId,
                conversationPeriodStart: new Date(),
                conversationPeriodEnd: new Date(),
                wordCount: wordCount,
                summary: `Conversation occurred (${wordCount} words). Summary generation failed.`,
                keyPoints: [],
                escalations: [],
                decisions: [],
                timestamp: new Date()
            };
        }
    }
    
    /**
     * Format summary for inclusion in LLM context
     */
    static formatSummaryForContext(summary: ConversationSummary): string {
        return `
---LONG-TERM MEMORY SUMMARY---
Period: ${summary.conversationPeriodStart.toISOString()}
Words: ${summary.wordCount}

SUMMARY:
${summary.summary}

KEY POINTS:
${summary.keyPoints.map(p => `- ${p}`).join('\n')}

${summary.escalations.length > 0 ? `ESCALATIONS:\n${summary.escalations.map(e => `- ${e}`).join('\n')}\n` : ''}

${summary.decisions.length > 0 ? `DECISIONS:\n${summary.decisions.map(d => `- ${d}`).join('\n')}\n` : ''}

---END SUMMARY---
`;
    }
}

export const conversationSummarizer = ConversationSummarizer;
