/**
 * Token Hashing Utility
 * Securely hash and verify tokens using bcrypt
 */

import bcrypt from 'bcryptjs';
import { CONSTANTS } from '../config/constants';
import { logger } from './logger';

export class TokenHasher {
    /**
     * Hash a token before storing in database
     */
    static async hashToken(token: string): Promise<string> {
        try {
            const hashed = await bcrypt.hash(token, CONSTANTS.TOKEN.SALT_ROUNDS);
            return hashed;
        } catch (error) {
            logger.error({ error }, 'Failed to hash token');
            throw new Error('Token hashing failed');
        }
    }

    /**
     * Verify a provided token against a stored hash
     */
    static async verifyToken(providedToken: string, storedHash: string): Promise<boolean> {
        try {
            const isValid = await bcrypt.compare(providedToken, storedHash);
            return isValid;
        } catch (error) {
            logger.error({ error }, 'Failed to verify token');
            return false;
        }
    }

    /**
     * Generate a secure random token
     */
    static generateToken(prefix: string = 'KUMO'): string {
        const randomPart = Math.random().toString(36).substring(2, 15).toUpperCase();
        const timestamp = Date.now().toString(36).toUpperCase();
        return `${prefix}-${randomPart}-${timestamp}`;
    }
}

