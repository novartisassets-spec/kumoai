/**
 * VOICE TRANSCRIPTION SERVICE
 * Converts audio messages to text using Groq Whisper API
 * Integrated with all agents for voice message awareness
 */

import { aiProvider } from '../ai/provider';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface VoiceMessage {
    messageId: string;
    schoolId: string;
    fromPhone: string;
    userId?: string;
    audioBuffer: Buffer;
    mimeType: string; // audio/ogg, audio/mpeg, etc.
    durationSeconds: number;
    language?: string; // Detected language
}

export interface TranscriptionResult {
    messageId: string;
    originalAudioPath?: string;
    transcriptionText: string;
    confidence: number; // 0-1
    language: string;
    durationSeconds: number;
    isNoise: boolean; // True if only background noise detected
    detectedSpeaker?: string; // Optional speaker identification
    transcribedAt: Date;
}

export class VoiceTranscriptionService {
    /**
     * Transcribe voice message using Groq Whisper
     * All agents receive text + metadata about voice origin
     */
    static async transcribeVoiceMessage(voiceMsg: VoiceMessage): Promise<TranscriptionResult> {
        try {
            logger.info(
                { 
                    messageId: voiceMsg.messageId,
                    schoolId: voiceMsg.schoolId,
                    fromPhone: voiceMsg.fromPhone,
                    durationSeconds: voiceMsg.durationSeconds,
                    audioSize: voiceMsg.audioBuffer.length
                },
                'Starting voice transcription'
            );

            // Validate audio
            if (voiceMsg.audioBuffer.length === 0) {
                throw new Error('Audio buffer is empty');
            }

            if (voiceMsg.durationSeconds === 0 || voiceMsg.durationSeconds > 300) {
                // Audio longer than 5 minutes is suspicious
                logger.warn(
                    { messageId: voiceMsg.messageId, durationSeconds: voiceMsg.durationSeconds },
                    'Audio duration unusual'
                );
            }

            // Call Groq Whisper API
            // Whisper supports: mp3, mp4, mpeg, mpga, m4a, ogg, opus, flac, wav, webm
            const transcription = await this.callGroqWhisper(voiceMsg.audioBuffer, voiceMsg.language);

            // Check if transcription is valid (not just noise)
            const isNoise = this.isNoisyTranscription(transcription.text);

            const result: TranscriptionResult = {
                messageId: voiceMsg.messageId,
                transcriptionText: transcription.text.trim(),
                confidence: transcription.confidence || 0.95,
                language: transcription.language || 'en',
                durationSeconds: voiceMsg.durationSeconds,
                isNoise,
                detectedSpeaker: voiceMsg.userId || voiceMsg.fromPhone,
                transcribedAt: new Date()
            };

            logger.info(
                {
                    messageId: voiceMsg.messageId,
                    transcriptionLength: result.transcriptionText.length,
                    confidence: result.confidence,
                    isNoise: result.isNoise
                },
                'Voice transcription completed'
            );

            return result;
        } catch (error) {
            logger.error(
                { error, messageId: voiceMsg.messageId, schoolId: voiceMsg.schoolId },
                'Voice transcription failed'
            );
            throw error;
        }
    }

    /**
     * Convert transcription to agent-friendly context
     * Agents should acknowledge this in their response
     */
    static buildVoiceContext(transcription: TranscriptionResult): string {
        return `[Voice Message from ${transcription.detectedSpeaker}]
Duration: ${transcription.durationSeconds} seconds
Language: ${transcription.language}
Confidence: ${(transcription.confidence * 100).toFixed(1)}%
${transcription.isNoise ? '⚠️ Primarily background noise detected\n' : ''}
Transcription: "${transcription.transcriptionText}"`;
    }

    /**
     * Format response acknowledgment for voice input
     * Every agent should include this in their response to voice messages
     */
    static formatVoiceAcknowledgment(transcription: TranscriptionResult, agentRole: string): string {
        if (transcription.isNoise) {
            return `I heard a voice message but couldn't make out the words clearly due to background noise. Could you please send it again or text me instead?`;
        }

        return `I heard your voice message (${transcription.durationSeconds}s). Understanding: "${transcription.transcriptionText.substring(0, 50)}${transcription.transcriptionText.length > 50 ? '...' : ''}". Let me help you with that.`;
    }

    /**
     * Prepare voice metadata for memory storage
     */
    static prepareVoiceMemory(transcription: TranscriptionResult): {
        messageRole: 'user';
        messageContent: string;
        voiceMetadata: {
            isVoice: true;
            duration: number;
            language: string;
            confidence: number;
            originalText: string;
        };
    } {
        return {
            messageRole: 'user',
            messageContent: transcription.transcriptionText,
            voiceMetadata: {
                isVoice: true,
                duration: transcription.durationSeconds,
                language: transcription.language,
                confidence: transcription.confidence,
                originalText: transcription.transcriptionText
            }
        };
    }

    // ============ PRIVATE METHODS ============

    /**
     * Call Groq Whisper API for transcription
     */
    private static async callGroqWhisper(
        audioBuffer: Buffer,
        language?: string
    ): Promise<{ text: string; confidence: number; language: string }> {
        try {
            const Groq = (await import('groq-sdk')).default;
            const { ENV } = await import('../config/env');
            const groq = new Groq({ apiKey: ENV.SA_GROQ_API_KEY || ENV.PA_GROQ_API_KEY });

            // 1. Create a temporary file for the buffer (Groq SDK expects a File object or Stream)
            const tempPath = path.join(process.cwd(), 'media_cache', `transcription_${Date.now()}.ogg`);
            if (!fs.existsSync(path.dirname(tempPath))) fs.mkdirSync(path.dirname(tempPath), { recursive: true });
            fs.writeFileSync(tempPath, audioBuffer);

            logger.info({ model: 'whisper-large-v3' }, 'Calling Groq Whisper V3 for high-precision transcription');

            // 2. High-precision prompt for African school context
            const prompt = "This is an audio message from a parent or teacher in an African school. It may contain educational terminology, student names, and occasional West African Pidgin English. Transcribe accurately, maintaining the original sentiment.";

            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: 'whisper-large-v3',
                prompt: prompt,
                response_format: 'json',
                language: language === 'en' ? 'en' : undefined // Auto-detect if not explicitly EN
            });

            // Cleanup
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

            return {
                text: transcription.text,
                confidence: 0.99, // Whisper V3 Large is extremely reliable
                language: language || 'en'
            };
        } catch (error) {
            logger.error({ error }, 'Groq Whisper V3 API call failed');
            throw new Error('Failed to transcribe voice message with high precision');
        }
    }

    /**
     * Check if transcription is just noise/silence
     */
    private static isNoisyTranscription(text: string): boolean {
        // Indicators of noise-only audio
        const noisyPatterns = [
            /^[\s\-\*]*$/,  // Empty or just whitespace
            /^[aeiou\s\*\-]{0,5}$/i,  // Just vowels/sounds
            /^(uh|um|hmm|shh|ss|ff|zzz)[\s\-]*$/i,  // Filler sounds only
            /^(background|noise|silence)$/i  // Groq marking
        ];

        return noisyPatterns.some(pattern => pattern.test(text)) || text.length < 3;
    }
}

export const voiceTranscriptionService = new VoiceTranscriptionService();
