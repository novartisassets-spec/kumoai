import { aiProvider } from './provider';
import { SA_TA_CONFIG } from './config';

export class IntentAnalyzer {
    static async analyzeSAApproval(adminText: string): Promise<{
        intent_clear: boolean;
        approved: boolean;
        confidence: number;
        reasoning: string;
    }> {
        const prompt = `
        You are a strict intent analyzer for a School Admin system.
        The admin has replied to a payment request.
        
        Analyze this text: "${adminText}"

        Determine if it is an EXPLICIT APPROVAL or REJECTION.
        Ambiguous replies (e.g., "Ok", "Noted", "Reviewing") MUST be marked as unclear.
        
        Return JSON:
        {
            "intent_clear": boolean,
            "approved": boolean, // true if approved, false if rejected or unclear
            "confidence": number, // 0-1
            "reasoning": "Why you decided this"
        }
        `;

        const response = await aiProvider.generateText(SA_TA_CONFIG, prompt);
        try {
            const cleaned = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (e) {
            return { intent_clear: false, approved: false, confidence: 0, reasoning: "JSON Parse Error" };
        }
    }
}
