import axios from 'axios';
import { logger } from '../utils/logger';
import { ENV } from '../config/env';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface VoiceSessionOptions {
    agentId: string;
    schoolId: string;
    userId: string;
    fromPhone: string;
    userName?: string;
    dynamicVars?: Record<string, any>;
    systemPromptOverride?: string;
    initialMessageOverride?: string;
}

export class VoiceOrchestrator {
    private static BASE_URL = 'https://api.elevenlabs.io/v1/convai';

    /**
     * Generates a signed URL for a real-time conversational session
     * Extensible for any agent (PA, Order Agent, etc.)
     */
    static async initiateSession(options: VoiceSessionOptions): Promise<string> {
        const { agentId, schoolId, userId, fromPhone, userName, dynamicVars, systemPromptOverride, initialMessageOverride } = options;

        try {
            logger.info({ agentId, userId, userName }, '🎙️ Initiating ElevenLabs Voice Session');

            // ElevenLabs Signed URL endpoint is a GET request
            const response = await axios.get(
                `${this.BASE_URL}/conversation/get-signed-url?agent_id=${agentId}`,
                {
                    headers: {
                        'xi-api-key': ENV.ELEVENLABS_API_KEY,
                    }
                }
            );

            const signedUrl = response.data.signed_url;
            const sessionId = uuidv4();

            // Store the session initiation in DB
            await new Promise<void>((resolve, reject) => {
                db.getDB().run(
                    `INSERT INTO voice_sessions (id, school_id, user_id, from_phone, status) VALUES (?, ?, ?, ?, ?)`,
                    [sessionId, schoolId, userId, fromPhone, 'initiated'],
                    (err) => err ? reject(err) : resolve()
                );
            });
            
            logger.info({ sessionId, signedUrl: 'REDACTED' }, '✅ Voice Session URL Generated and Recorded');
            
            // NOTE: Dynamic variables and overrides must be handled by the client 
            // when connecting to this signed URL via the ElevenLabs Web SDK.
            // HOWEVER, we can store these in the DB so that if we had a middle-layer 
            // or if we use the ElevenLabs Agent API to update the agent config 
            // before the call starts, we could.
            
            // For now, we'll return the signedUrl.
            // IF we were using the ElevenLabs SDK or a custom WebSocket bridge, 
            // we'd send the initiation frame with these variables.
            
            return signedUrl;
        } catch (error: any) {
            logger.error({ 
                error: error.message, 
                response: error.response?.data 
            }, '❌ Failed to initiate voice session');
            throw new Error('Voice session initiation failed');
        }
    }

    /**
     * Map agent types to their ElevenLabs Agent IDs
     */
    static getAgentId(agentType: 'PA' | 'ORDER' | string): string {
        switch (agentType) {
            case 'PA': return ENV.ELEVENLABS_AGENT_ID_PA;
            case 'ORDER': return ENV.ELEVENLABS_AGENT_ID_ORDER;
            default: return ENV.ELEVENLABS_AGENT_ID_PA; // Fallback
        }
    }
}
