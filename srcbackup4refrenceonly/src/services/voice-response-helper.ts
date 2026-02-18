/**
 * VOICE RESPONSE HELPER
 * Utility for all agents to acknowledge and process voice messages
 */

import { RoutedMessage } from '../core/types/index';
import { VoiceTranscriptionService, TranscriptionResult } from './voice-transcription';
import { logger } from '../utils/logger';

export class VoiceResponseHelper {
    /**
     * Check if message is voice
     */
    static isVoiceMessage(message: RoutedMessage): boolean {
        return (message as any).isVoiceMessage === true;
    }

    /**
     * Get voice transcription if available
     */
    static getTranscription(message: RoutedMessage): TranscriptionResult | undefined {
        return (message as any).voiceTranscription;
    }

    /**
     * Get voice context for system prompt
     */
    static getVoiceContext(message: RoutedMessage): string {
        const context = (message as any).voiceContext;
        return context ? `\n${context}\n` : '';
    }

    /**
     * Wrap response with voice acknowledgment
     * Every agent should call this to prepend voice acknowledgment
     */
    static wrapWithVoiceAcknowledgment(
        message: RoutedMessage,
        agentRole: string,
        baseResponse: string
    ): string {
        if (!this.isVoiceMessage(message)) {
            return baseResponse;
        }

        const transcription = this.getTranscription(message);
        if (!transcription) {
            return baseResponse;
        }

        const ackText = VoiceTranscriptionService.formatVoiceAcknowledgment(transcription, agentRole);
        return `${ackText}\n\n${baseResponse}`;
    }

    /**
     * Log voice message to audit trail
     */
    static async logVoiceToAudit(
        schoolId: string,
        userPhone: string,
        message: RoutedMessage,
        transcription?: TranscriptionResult
    ): Promise<void> {
        try {
            if (!this.isVoiceMessage(message)) {
                return;
            }

            logger.info(
                {
                    schoolId,
                    from: userPhone,
                    messageId: message.id,
                    transcriptionLength: transcription?.transcriptionText.length || 0,
                    confidence: transcription?.confidence || 0,
                    duration: transcription?.durationSeconds || 0
                },
                'Voice message logged to audit'
            );
        } catch (error) {
            logger.error({ error }, 'Failed to log voice message to audit');
        }
    }

    /**
     * Prepare voice data for memory storage
     * All agents store voice context in conversation memory
     */
    static prepareVoiceMemoryData(message: RoutedMessage): any {
        if (!this.isVoiceMessage(message)) {
            return null;
        }

        const transcription = this.getTranscription(message);
        if (!transcription) {
            return null;
        }

        return {
            messageType: 'voice',
            transcriptionText: transcription.transcriptionText,
            duration: transcription.durationSeconds,
            language: transcription.language,
            confidence: transcription.confidence,
            isNoise: transcription.isNoise,
            originalAudioPath: (message as any).originalAudioPath
        };
    }

    /**
     * Build voice-aware system prompt context
     * Agents should include this in their prompt assembly
     */
    static buildVoiceSystemContext(message: RoutedMessage): string {
        if (!this.isVoiceMessage(message)) {
            return '';
        }

        const transcription = this.getTranscription(message);
        if (!transcription) {
            return '';
        }

        return `
=== USER INPUT SOURCE: VOICE NOTE ===
The user's message was provided via voice transcription. 
Original transcription: "${transcription.transcriptionText}"
Duration: ${transcription.durationSeconds}s

IMPORTANT: 
1. Treat this as a normal text input. Do NOT explicitly mention that you "heard" a voice message or repeat the transcription back to the user unless it is absolutely necessary for clarification.
2. If the transcription contains minor typos or phonetic errors (especially with student names or local terms), use the surrounding context to determine the user's intent.
3. Respond naturally and directly to the request.
=== END VOICE CONTEXT ===
`;
    }
}
