/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting messages per time window
 */

import { logger } from '../utils/logger';
import { CONSTANTS } from '../config/constants';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

export class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private readonly maxMessagesPerMinute: number;
    private readonly maxMessagesPerHour: number;
    private readonly windowMs: number;

    constructor(
        maxPerMinute: number = CONSTANTS.RATE_LIMIT.MESSAGES_PER_MINUTE,
        maxPerHour: number = CONSTANTS.RATE_LIMIT.MESSAGES_PER_HOUR,
        windowMs: number = CONSTANTS.RATE_LIMIT.WINDOW_MS
    ) {
        this.maxMessagesPerMinute = maxPerMinute;
        this.maxMessagesPerHour = maxPerHour;
        this.windowMs = windowMs;

        // Cleanup old entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Check if a phone number is within rate limits
     * Returns true if allowed, false if rate limited
     */
    checkLimit(phone: string): { allowed: boolean; remaining: number; resetAt: number } {
        const now = Date.now();
        const minuteKey = `minute:${phone}`;
        const hourKey = `hour:${phone}`;

        // Check minute limit
        const minuteEntry = this.limits.get(minuteKey);
        if (minuteEntry && now < minuteEntry.resetAt) {
            if (minuteEntry.count >= this.maxMessagesPerMinute) {
                logger.warn({ phone, count: minuteEntry.count }, 'Rate limit exceeded (per minute)');
                return {
                    allowed: false,
                    remaining: 0,
                    resetAt: minuteEntry.resetAt
                };
            }
            minuteEntry.count++;
        } else {
            // Reset or create new entry
            this.limits.set(minuteKey, {
                count: 1,
                resetAt: now + this.windowMs
            });
        }

        // Check hour limit
        const hourEntry = this.limits.get(hourKey);
        if (hourEntry && now < hourEntry.resetAt) {
            if (hourEntry.count >= this.maxMessagesPerHour) {
                logger.warn({ phone, count: hourEntry.count }, 'Rate limit exceeded (per hour)');
                return {
                    allowed: false,
                    remaining: 0,
                    resetAt: hourEntry.resetAt
                };
            }
            hourEntry.count++;
        } else {
            // Reset or create new entry (1 hour window)
            this.limits.set(hourKey, {
                count: 1,
                resetAt: now + (60 * 60 * 1000)
            });
        }

        const currentMinuteEntry = this.limits.get(minuteKey)!;
        return {
            allowed: true,
            remaining: Math.max(0, this.maxMessagesPerMinute - currentMinuteEntry.count),
            resetAt: currentMinuteEntry.resetAt
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
            logger.debug({ cleaned }, 'Rate limiter cleanup completed');
        }
    }

    /**
     * Get current rate limit status for a phone
     */
    getStatus(phone: string): { minute: { count: number; limit: number }; hour: { count: number; limit: number } } {
        const minuteKey = `minute:${phone}`;
        const hourKey = `hour:${phone}`;

        const minuteEntry = this.limits.get(minuteKey);
        const hourEntry = this.limits.get(hourKey);

        return {
            minute: {
                count: minuteEntry?.count || 0,
                limit: this.maxMessagesPerMinute
            },
            hour: {
                count: hourEntry?.count || 0,
                limit: this.maxMessagesPerHour
            }
        };
    }
}

// Singleton instance
let rateLimiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
    if (!rateLimiterInstance) {
        rateLimiterInstance = new RateLimiter();
    }
    return rateLimiterInstance;
}

