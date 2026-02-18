/**
 * VOICE MESSAGE HANDLER
 * Detects voice messages from all message types
 * Transcribes and passes to agents with voice context
 */

import { RoutedMessage } from '../core/types/index';
import { VoiceTranscriptionService, VoiceMessage, TranscriptionResult } from './voice-transcription';
import { logger } from '../utils/logger';
import fs from 'fs';

export interface MessageWithVoice extends RoutedMessage {
    isVoiceMessage: boolean;
    voiceTranscription?: TranscriptionResult;
    originalAudioPath?: string;
    audioBuffer?: Buffer;
    voiceContext?: string;
}

export class VoiceMessageHandler {
    /**
     * Check if message is voice and transcribe if needed
     * Called before routing to agents
     */
    static async processMessageForVoice(message: RoutedMessage): Promise<MessageWithVoice> {
        const extendedMessage = message as MessageWithVoice;

        // Check if this is a voice message
        const isVoice = this.isVoiceMessage(message);
        extendedMessage.isVoiceMessage = isVoice;

        if (!isVoice) {
            return extendedMessage;
        }

        try {
            // Extract audio buffer from message
            const audioBuffer = await this.extractAudioBuffer(message);
            const durationSeconds = this.estimateDuration(audioBuffer, message);

            // Validate schoolId is present
            const schoolId = message.identity?.schoolId;
            if (!schoolId) {
                logger.warn({ messageId: message.id }, 'Voice message missing schoolId - skipping transcription');
                return extendedMessage;
            }

            // Prepare voice message for transcription
            const voiceMsg: VoiceMessage = {
                messageId: message.id,
                schoolId: schoolId,
                fromPhone: message.from,
                userId: (message as any).user_id,
                audioBuffer,
                mimeType: this.detectMimeType(message),
                durationSeconds,
                language: message.identity?.preferredLanguage || 'en'
            };

            // Transcribe
            logger.info({ messageId: message.id, durationSeconds }, 'Transcribing voice message');
            const transcription = await VoiceTranscriptionService.transcribeVoiceMessage(voiceMsg);

            // Attach transcription to message
            extendedMessage.voiceTranscription = transcription;
            extendedMessage.body = transcription.transcriptionText;
            extendedMessage.voiceContext = VoiceTranscriptionService.buildVoiceContext(transcription);
            extendedMessage.originalAudioPath = (message as any).media_path;

            logger.info(
                { messageId: message.id, transcriptionLength: transcription.transcriptionText.length },
                'Voice message processed and transcribed'
            );

            return extendedMessage;
        } catch (error) {
            logger.error({ error, messageId: message.id }, 'Failed to process voice message');

            // Return original message with error flag
            extendedMessage.isVoiceMessage = false;
            extendedMessage.body = '[Voice message could not be transcribed. Please text instead.]';
            return extendedMessage;
        }
    }

    /**
     * Check if message contains voice
     * Supports: audio attachments, voice notes, WhatsApp voice messages
     */
    static isVoiceMessage(message: RoutedMessage): boolean {
        // WhatsApp voice message indicator
        if ((message as any).type === 'audio' || (message as any).type === 'voice') {
            return true;
        }

        // Audio file attachment
        const mediaPath = (message as any).media_path || '';
        const audioExtensions = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.ogg', '.opus', '.flac', '.wav', '.webm'];
        if (audioExtensions.some(ext => mediaPath.toLowerCase().endsWith(ext))) {
            return true;
        }

        // Check media type
        const mediaType = (message as any).media_type || '';
        return mediaType.startsWith('audio/');
    }

    /**
     * Extract audio buffer from message
     */
    static async extractAudioBuffer(message: RoutedMessage): Promise<Buffer> {
        const buffer = (message as any).audioBuffer;

        if (buffer && buffer.length > 0) {
            return buffer;
        }

        const mediaPath = (message as any).media_path || '';
        if (mediaPath && fs.existsSync(mediaPath)) {
            const fs = await import('fs');
            return fs.readFileSync(mediaPath);
        }

        throw new Error('Audio buffer or file path not found in message');
    }

    /**
     * Estimate audio duration from buffer
     * More accurate methods would use file headers
     */
    static estimateDuration(buffer: Buffer, message: RoutedMessage): number {
        // Check if duration is explicitly provided
        const providedDuration = (message as any).duration || (message as any).durationSeconds;
        if (providedDuration) {
            return Math.min(providedDuration, 300); // Cap at 5 minutes
        }

        // Rough estimate: assume ~24 kbps average for audio
        // buffer.length (bytes) / 3000 ≈ seconds
        const estimatedSeconds = Math.round(buffer.length / 3000);
        return Math.min(estimatedSeconds, 300);
    }

    /**
     * Detect MIME type from message or buffer
     */
    static detectMimeType(message: RoutedMessage): string {
        const provided = (message as any).media_type || (message as any).mimeType || '';
        if (provided.startsWith('audio/')) {
            return provided;
        }

        const mediaPath = (message as any).media_path || '';
        const lowerPath = mediaPath.toLowerCase();

        if (lowerPath.endsWith('.mp3') || lowerPath.endsWith('.mpeg')) return 'audio/mpeg';
        if (lowerPath.endsWith('.mp4') || lowerPath.endsWith('.m4a')) return 'audio/mp4';
        if (lowerPath.endsWith('.ogg')) return 'audio/ogg';
        if (lowerPath.endsWith('.opus')) return 'audio/opus';
        if (lowerPath.endsWith('.flac')) return 'audio/flac';
        if (lowerPath.endsWith('.wav')) return 'audio/wav';
        if (lowerPath.endsWith('.webm')) return 'audio/webm';

        // Default to OGG (WhatsApp's typical format)
        return 'audio/ogg';
    }

    /**
     * Prepare voice acknowledgment text for agent response
     * Agents should prepend this to their response
     */
    static getVoiceAcknowledgment(message: MessageWithVoice, agentRole: string): string {
        if (!message.isVoiceMessage || !message.voiceTranscription) {
            return '';
        }

        return VoiceTranscriptionService.formatVoiceAcknowledgment(
            message.voiceTranscription,
            agentRole
        ) + '\n\n';
    }
}

export const voiceMessageHandler = new VoiceMessageHandler();
