import { ENV } from '../config/env';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import axios from 'axios';
import { logger } from '../utils/logger';
import { getLLMRateLimiter } from '../middleware/llm-rate-limiter';
import { AgentContext } from '../core/types';

export interface AIResponse {
    text: string;
    raw: any;
}

export interface ModelConfig {
    provider: 'gemini' | 'groq' | 'openrouter';
    model: string;
    apiKey: string;
    fallback?: ModelConfig;
}

export class AIProvider {
    public mockGenerator?: (config: ModelConfig, prompt: string) => Promise<AIResponse>;

    constructor() {}

    async generateText(
        config: ModelConfig, 
        prompt: string, 
        systemInstruction?: string, 
        retries: number = 2,
        agentContext?: AgentContext,
        phoneNumber?: string
    ): Promise<AIResponse> {
        // LLM Rate Limiting - check before making API call
        if (agentContext && phoneNumber) {
            const llmRateLimiter = getLLMRateLimiter();
            const rateLimitResult = llmRateLimiter.checkLimit(phoneNumber, agentContext);
            
            if (!rateLimitResult.allowed) {
                logger.warn({ 
                    phone: phoneNumber, 
                    agent: agentContext,
                    resetAt: new Date(rateLimitResult.resetAt).toLocaleTimeString()
                }, 'LLM rate limit exceeded');
                throw new Error(rateLimitResult.errorMessage || 'Rate limit exceeded');
            }
        }

        if (this.mockGenerator) {
            return this.mockGenerator(config, (systemInstruction || '') + '\n' + prompt);
        }
        try {
            if (config.provider === 'gemini') {
                return await this.callGemini(config, prompt, systemInstruction);
            } else if (config.provider === 'groq') {
                return await this.callGroq(config, prompt, systemInstruction);
            } else if (config.provider === 'openrouter') {
                return await this.callOpenRouter(config, prompt, systemInstruction);
            }
            throw new Error(`Unknown provider: ${config.provider}`);
        } catch (error: any) {
            if (error?.status === 429 && retries > 0) {
                const waitTime = (3 - retries) * 5000;
                logger.warn({ waitTime, provider: config.provider, model: config.model }, 'Rate limit hit, retrying...');
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this.generateText(config, prompt, systemInstruction, retries - 1);
            }

            logger.error({ 
                status: (error as any).response?.status,
                message: error.message,
                data: (error as any).response?.data,
                provider: config.provider,
                model: config.model
            }, '❌ AI Provider call failed');

            // Trigger fallback on auth errors (403, 401) or after retries exhausted
            if (config.fallback && (error?.status === 403 || error?.status === 401 || retries === 0)) {
                logger.warn({ fallback: config.fallback.provider, errorStatus: error?.status }, 'Triggering configured fallback');
                return this.generateText(config.fallback, prompt, systemInstruction, 1);
            }
            throw error;
        }
    }

    private async callGemini(config: ModelConfig, prompt: string, systemInstruction?: string): Promise<AIResponse> {
        const keySnippet = config.apiKey ? config.apiKey.substring(0, 6) + '...' : 'MISSING';
        logger.debug({ model: config.model, keySnippet }, 'Initiating direct Gemini API call');
        
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const model = genAI.getGenerativeModel({
            model: config.model,
            systemInstruction: systemInstruction
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return {
            text: response.text(),
            raw: response
        };
    }

    private async callGroq(config: ModelConfig, prompt: string, systemInstruction?: string, groqRetryIndex: number = 0): Promise<AIResponse> {
        // Resolve the key to use: original or one of the 5 retries
        let currentApiKey = config.apiKey;
        if (groqRetryIndex > 0) {
            const retryKeyName = `GROQ_RETRY_KEY_${groqRetryIndex}` as keyof typeof ENV;
            currentApiKey = (ENV as any)[retryKeyName] || config.apiKey;
            logger.info({ retryIndex: groqRetryIndex }, `🔄 [GROQ] Retrying with secondary key ${groqRetryIndex}`);
        }

        const keySnippet = currentApiKey ? currentApiKey.substring(0, 6) + '...' : 'MISSING';
        logger.debug({ model: config.model, keySnippet, retryIndex: groqRetryIndex }, 'Initiating direct Groq API call');

        try {
            const groq = new Groq({ apiKey: currentApiKey });
            const messages: any[] = [];
            
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            messages.push({ role: 'user', content: prompt });

            const chatCompletion = await groq.chat.completions.create({
                messages: messages,
                model: config.model,
            });

            const rawText = chatCompletion.choices[0]?.message?.content || '';
            logger.info({ model: config.model, rawLength: rawText.length, rawText: rawText.substring(0, 500) }, '🔍 [GROQ] Raw LLM Response');

            return {
                text: rawText,
                raw: chatCompletion
            };
        } catch (error: any) {
            // If we hit a rate limit and haven't exhausted our 5 retry keys
            if (error?.status === 429 && groqRetryIndex < 5) {
                logger.warn({ groqRetryIndex, nextIndex: groqRetryIndex + 1 }, '🛑 [GROQ] Rate limit hit on current key, rotating to next secondary key...');
                return await this.callGroq(config, prompt, systemInstruction, groqRetryIndex + 1);
            }
            throw error;
        }
    }

    private async callOpenRouter(config: ModelConfig, prompt: string, systemInstruction?: string): Promise<AIResponse> {
        const keySnippet = config.apiKey ? config.apiKey.substring(0, 6) + '...' : 'MISSING';
        logger.debug({ model: config.model, keySnippet }, 'Initiating direct OpenRouter API call');

        const messages: any[] = [];
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: config.model,
                messages: messages
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'HTTP-Referer': 'https://kumo.local',
                    'X-Title': 'Kumo'
                }
            }
        );

        if (!response.data || !response.data.choices || response.data.choices.length === 0) {
            throw new Error(`OpenRouter returned an empty or invalid response: ${JSON.stringify(response.data)}`);
        }

        return {
            text: response.data.choices[0]?.message?.content || '',
            raw: response.data
        };
    }
}

export const aiProvider = new AIProvider();