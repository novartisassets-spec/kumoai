/**
 * LLM Rate Limiter
 * Limits LLM API calls to 3 per minute per agent per phone number
 */

import { logger } from '../utils/logger';
import { CONSTANTS } from '../config/constants';
import { AgentContext } from '../core/types';

interface LLMRateLimitEntry {
    count: number;
    resetAt: number;
}

export class LLMRateLimiter {
    private limits: Map<string, LLMRateLimitEntry> = new Map();
    private readonly maxCallsPerMinute: number = CONSTANTS.RATE_LIMIT.LLM_CALLS_PER_MINUTE;
    private readonly windowMs: number = CONSTANTS.RATE_LIMIT.WINDOW_MS;

    constructor() {
        // Cleanup old entries every 2 minutes
        setInterval(() => this.cleanup(), 2 * 60 * 1000);
    }

    /**
     * Check if an LLM call is allowed for a specific agent and phone
     * Returns true if allowed, false if rate limited
     */
    checkLimit(phone: string, agent: AgentContext): { 
        allowed: boolean; 
        remaining: number; 
        resetAt: number;
        errorMessage?: string;
    } {
        const key = `${agent}:${phone}`;
        const now = Date.now();
        const entry = this.limits.get(key);

        if (entry && now < entry.resetAt) {
            // Within window, check count
            if (entry.count >= this.maxCallsPerMinute) {
                const resetTime = new Date(entry.resetAt).toLocaleTimeString();
                logger.warn({ 
                    phone, 
                    agent, 
                    count: entry.count,
                    resetAt: resetTime
                }, 'LLM rate limit exceeded');
                return {
                    allowed: false,
                    remaining: 0,
                    resetAt: entry.resetAt,
                    errorMessage: `You've reached the limit of ${this.maxCallsPerMinute} AI requests per minute. Please wait until ${resetTime} to try again.`
                };
            }
            // Increment count
            entry.count++;
        } else {
            // Create new entry or reset expired one
            this.limits.set(key, {
                count: 1,
                resetAt: now + this.windowMs
            });
        }

        const currentEntry = this.limits.get(key)!;
        return {
            allowed: true,
            remaining: Math.max(0, this.maxCallsPerMinute - currentEntry.count),
            resetAt: currentEntry.resetAt
        };
    }

    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.limits.entries()) {
            if (now >= entry.resetAt) {
                this.limits.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug({ cleaned }, 'LLM rate limiter cleanup completed');
        }
    }

    /**
     * Get current status for a phone/agent combination
     */
    getStatus(phone: string, agent: AgentContext): { count: number; limit: number; resetAt: number } {
        const key = `${agent}:${phone}`;
        const entry = this.limits.get(key);
        
        if (!entry || Date.now() >= entry.resetAt) {
            return { count: 0, limit: this.maxCallsPerMinute, resetAt: Date.now() + this.windowMs };
        }

        return {
            count: entry.count,
            limit: this.maxCallsPerMinute,
            resetAt: entry.resetAt
        };
    }
}

// Singleton instance
let llmRateLimiterInstance: LLMRateLimiter | null = null;

export function getLLMRateLimiter(): LLMRateLimiter {
    if (!llmRateLimiterInstance) {
        llmRateLimiterInstance = new LLMRateLimiter();
    }
    return llmRateLimiterInstance;
}

