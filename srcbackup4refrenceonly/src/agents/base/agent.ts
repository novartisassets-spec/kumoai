import { RoutedMessage } from '../../core/types';
import { aiProvider } from '../../ai/provider';
import { logger } from '../../utils/logger';

export abstract class BaseAgent {
    abstract handle(message: RoutedMessage): Promise<any>;

    /**
     * 🧠 HANDOVER TURN: Acknowledge a user switch on a shared device.
     */
    protected async synthesizeHandover(
        newUserName: string,
        oldUserName: string | undefined,
        contextPrompt: string,
        systemPrompt: string,
        modelConfig: any
    ): Promise<string> {
        try {
            const handoverPrompt = `
=== USER SWITCH DETECTED ===
New User: ${newUserName}
Previous User: ${oldUserName || 'Unknown'}

=== TASK ===
The device owner has changed or another person has logged in with a token. 
Write a natural, human-like handover message.
1. Acknowledge the new user (${newUserName}) warmly.
2. If there was a previous user (${oldUserName}), mention that you've safely "parked" or "paused" their session so the new user can work.
3. Be professional and reassuring about privacy.
4. Keep it concise (1-2 sentences).

Example: "Welcome, Mr. Chima! I've safely paused Mrs. Blessing's session so you can access your records. How can I help you today?"
`;
            const response = await aiProvider.generateText(modelConfig, contextPrompt + "\n\n" + handoverPrompt, systemPrompt);
            let synthesizedText = response.text.trim();
            
            // Clean up: Remove JSON markdown or accidental JSON structure
            synthesizedText = synthesizedText.replace(/```json/g, '').replace(/```/g, '').trim();
            if (synthesizedText.startsWith('{') && synthesizedText.endsWith('}')) {
                try {
                    const parsed = JSON.parse(synthesizedText);
                    if (parsed.reply_text) synthesizedText = parsed.reply_text;
                    else if (parsed.message) synthesizedText = parsed.message;
                } catch (e) {
                    logger.warn({ error: e, synthesizedText }, 'Failed to parse JSON from synthesized text');
                }
            }
            
            return synthesizedText;
        } catch (error) {
            return `Welcome, ${newUserName}! I've switched to your account. How can I help?`;
        }
    }

    /**
     * 🧠 SYNTHESIS TURN: Convert a technical backend result into a natural conversational response.
     */
    protected async synthesizeActionResult(
        action: string,
        result: any,
        originalReply: string,
        contextPrompt: string,
        systemPrompt: string,
        modelConfig: any
    ): Promise<string> {
        try {
            const synthesisPrompt = `
=== SYSTEM ACTION RESULT ===
Action: ${action}
Result Data: ${JSON.stringify(result, null, 2)}

=== YOUR ORIGINAL PLAN ===
"${originalReply}"

=== TASK ===
The system has attempted to execute the action you decided on.
Your task is to write the FINAL response to the user.

1. Analyze the Result Data. Did it succeed or fail?
   - If SUCCESS: Acknowledge it warmly and professionally.
   - If FAILURE (success: false, or error present): Explain the issue clearly but politely. Ask for the missing info or suggest the next step. Do NOT say "Error: ..." or be robotic.
2. Seamlessly include any important information from the Result Data (like IDs, Tokens, or missing fields).
3. Maintain your persona (warm, professional, helpful).

Respond only with the natural message text.
`;
            logger.debug({ action }, '🧠 Starting synthesis turn for human-like response');
            const response = await aiProvider.generateText(modelConfig, contextPrompt + "\n\n" + synthesisPrompt, systemPrompt);
            let synthesizedText = response.text.trim();
            
            synthesizedText = synthesizedText.replace(/```json/g, '').replace(/```/g, '').trim();
            if (synthesizedText.startsWith('{') && synthesizedText.endsWith('}')) {
                try {
                    const parsed = JSON.parse(synthesizedText);
                    if (parsed.reply_text) synthesizedText = parsed.reply_text;
                    else if (parsed.message) synthesizedText = parsed.message;
                } catch (e) {
                    logger.warn({ error: e, synthesizedText }, 'Failed to parse JSON from synthesized text');
                }
            }
            
            return synthesizedText;
        } catch (error) {
            logger.error({ error, action }, '❌ Synthesis turn failed');
            return originalReply;
        }
    }
}