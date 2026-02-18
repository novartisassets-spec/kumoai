import { v4 as uuidv4 } from 'uuid';
import { SessionRepository } from '../db/repositories/session.repo';
import { logger } from '../utils/logger';

interface Session {
    id: string;
    userId: string;
    phone?: string;
    role: 'parent' | 'teacher' | 'admin';
    expiresAt: number;
    context: any;
}

export class SessionService {
    // CRITICAL FIX: Sessions keyed by PHONE (not userId) for reliable lookup
    // Reason: PA passes message.from (phone) to getSession(), not userId
    // This was causing authenticated parents to not be recognized (session key mismatch)
    private memorySessions: Map<string, Session> = new Map();

    async createSession(userId: string, phone: string, role: 'parent' | 'teacher' | 'admin', ttlMinutes: number = 120, context: any = {}): Promise<string> {
        const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
        const id = uuidv4();
        
        // CRITICAL FIX: Store by PHONE as key (not userId)
        // This allows lookup by message.from (phone) to work correctly
        this.memorySessions.set(phone, {
            id,
            userId,  // Keep userId in context
            phone,
            role,
            expiresAt,
            context
        });

        // Also persist to database
        try {
            await SessionRepository.createSession(userId, phone, role, ttlMinutes, context);
        } catch (error) {
            logger.error({ error, userId }, 'Failed to persist session to database');
            // Don't fail - memory session is still functional
        }

        return id;
    }

    // CRITICAL FIX: Lookup by PHONE (not userId)
    getSession(phone: string): Session | null {
        const memSession = this.memorySessions.get(phone);
        
        if (memSession && Date.now() < memSession.expiresAt) {
            // Refresh TTL on access
            memSession.expiresAt = Date.now() + 2 * 60 * 60 * 1000;
            return memSession;
        }

        // Session expired or doesn't exist in memory
        if (memSession) {
            this.memorySessions.delete(phone);
        }

        return null;
    }

    async getSessionFromDB(userId: string): Promise<Session | null> {
        try {
            const dbSession = await SessionRepository.getSession(userId);
            if (!dbSession) return null;

            return {
                id: dbSession.id,
                userId: dbSession.userId,
                phone: dbSession.phone,
                role: dbSession.role,
                expiresAt: dbSession.expiresAt.getTime(),
                context: dbSession.context
            };
        } catch (error) {
            logger.error({ error, userId }, 'Failed to fetch session from DB');
            return null;
        }
    }

    updateContext(phone: string, key: string, value: any) {
        const session = this.getSession(phone);  // FIX: Use phone, not userId
        if (session) {
            session.context[key] = value;
            // Async update to DB - use userId from session context
            SessionRepository.updateContext(session.userId, key, value).catch(err => {
                logger.error({ error: err, userId: session.userId }, 'Failed to persist context update');
            });
        }
    }

    async clearSession(phone: string) {
        const session = this.memorySessions.get(phone);
        const userId = session?.userId;  // FIX: Get userId from session if exists
        
        this.memorySessions.delete(phone);
        
        if (userId) {
            try {
                await SessionRepository.clearSession(userId);
            } catch (error) {
                logger.error({ error, userId }, 'Failed to clear session from DB');
            }
        }
    }

    // Enforce token expiration
    async validateTokenExpiration(token: string): Promise<boolean> {
        try {
            return await SessionRepository.isTokenValid(token);
        } catch (error) {
            logger.error({ error }, 'Failed to validate token expiration');
            return false;
        }
    }

    // Cleanup routine (call periodically)
    async cleanupExpiredSessions() {
        try {
            await SessionRepository.cleanupExpiredSessions();
        } catch (error) {
            logger.error({ error }, 'Failed to cleanup expired sessions');
        }
    }
}

export const sessionService = new SessionService();

