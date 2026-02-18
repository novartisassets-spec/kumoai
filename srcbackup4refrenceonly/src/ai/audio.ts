import Groq from 'groq-sdk';
import fs from 'fs';
import { logger } from '../utils/logger';

import { ENV } from '../config/env';

export class AudioService {
    private groq: Groq;

    constructor() {
        this.groq = new Groq({ apiKey: ENV.PA_GROQ_API_KEY });
    }

    async transcribe(audioPath: string): Promise<string> {
        try {
            const transcription = await this.groq.audio.transcriptions.create({
                file: fs.createReadStream(audioPath),
                model: ENV.GROQ_MODEL_AUDIO,
                response_format: 'json',
                language: 'en', // Can be auto-detected, but forcing EN helps with mixed Pidgin sometimes
            });
            return transcription.text;
        } catch (error) {
            logger.error({ error, audioPath }, 'Transcription failed');
            throw error;
        }
    }

    // Stub for TTS (F5-TTS not standard in basic SDKs yet, using placeholder or external call logic)
    // PRD mentions F5-TTS for outbound voice.
    async synthesize(text: string): Promise<string | null> {
        logger.warn('TTS not fully implemented yet - waiting for Phase 2b or F5-TTS integration details');
        return null; 
    }
}

export const audioService = new AudioService();
