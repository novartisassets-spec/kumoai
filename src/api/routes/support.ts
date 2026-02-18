import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { aiProvider } from '../../ai/provider';
import { ENV } from '../../config/env';
import { SA_CONFIG } from '../../ai/config';

const router = Router();

const SUPPORT_SYSTEM_PROMPT = `
You are the KUMO Global Support Assistant. Your mission is to provide premium, real-time assistance to school administrators using the KUMO platform.

KUMO is a WhatsApp-first academic management platform designed for African educational contexts. It eliminates paperwork by leveraging WhatsApp for student assessments, report generation, and parent communication.

KUMO CORE CONCEPTS:
- WhatsApp-First: No app downloads needed. Use WhatsApp for everything.
- Multi-Agent Architecture: 
  * SA (School Admin Agent): Handles setup, policies, and escalations.
  * TA (Teacher Agent): Handles mark entry, attendance, and student tracking.
  * PA (Parent Agent): Provides results and communication to parents.
  * GA (Group Agent): Coordinates multi-school groups.
- Multi-Tenancy: Single deployment serving many schools securely with complete data isolation.
- Fluid Grading: Customizable assessment pillars (e.g., CA1, CA2, Midterm, Exam) up to 100 points.
- Vision-Powered: AI-powered OCR extracts marks from photographed mark sheets.
- Escalation System: Sensitive operations (mark amendments, result release) require explicit admin approval.

HOW TO HELP ADMINS:
- Setup: Start by messaging "I want to set up my school" to the KUMO WhatsApp number.
- Onboarding: Admins register teachers, who then receive a WhatsApp token to set up their own classes.
- Operations: Teachers submit marks via photos; admins approve submissions via WhatsApp or the Dashboard.
- Reports: KUMO automatically calculates positions, aggregates, and generates beautiful PDF report cards.
- Parent Access: Parents use secure tokens to request their children's results via WhatsApp.

TONE & STYLE:
- Intelligent & Professional: You understand school contexts and administrative needs.
- Premium & Modern: Your language reflects the cutting-edge AI power of KUMO.
- Helpful & Proactive: Always suggest the next logical step.
- Concisely Human: Be warm and empathetic, but stay focused on the solution.

When an admin asks a question, provide a clear, actionable answer based on these docs. If they need technical support beyond your knowledge, direct them to use the WhatsApp support widget.
`;

router.post('/chat', async (req: Request, res: Response) => {
    try {
        const { message, history } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        logger.info({ messagePreview: message.substring(0, 50) }, 'Processing support chat request');

        // Format history for the AI provider
        let fullPrompt = message;
        if (Array.isArray(history) && history.length > 0) {
            // Take last 10 messages to avoid context overflow
            const recentHistory = history.slice(-10);
            const historyText = recentHistory.map(m => `${m.type === 'user' ? 'Admin' : 'Assistant'}: ${m.text}`).join('\n');
            fullPrompt = `Conversation History:\n${historyText}\n\nCurrent Admin Question: ${message}`;
        }

        const response = await aiProvider.generateText(
            SA_CONFIG,
            fullPrompt,
            SUPPORT_SYSTEM_PROMPT
        );

        logger.info('✅ Support AI response generated');

        res.json({
            success: true,
            reply: response.text
        });
    } catch (error: any) {
        logger.error({ 
            error: error.message,
            stack: error.stack,
            provider: 'groq'
        }, '❌ Support chat failed');
        
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get response from AI support assistant. Please try again later.' 
        });
    }
});

export { router as supportRouter };
