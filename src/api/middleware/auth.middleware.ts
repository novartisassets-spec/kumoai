/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user to request
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, isTokenRevoked, UserPayload } from '../../services/auth.service';
import { logger } from '../../utils/logger';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: UserPayload;
            tokenJti?: string;
        }
    }
}

export interface AuthRequest extends Request {
    user?: UserPayload;
    tokenJti?: string;
}

/**
 * Middleware to authenticate JWT token
 * Supports both Authorization header and query parameter (for SSE)
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
    console.log(`\n🔐 AUTH MIDDLEWARE: ${req.method} ${req.path}`);
    console.log(`   Auth header: ${req.headers.authorization ? 'present' : 'MISSING'}`);
    console.log(`   Query params:`, Object.keys(req.query));
    
    try {
        let token: string | undefined;
        
        // Check Authorization header first
        const authHeader = req.headers.authorization;
        console.log(`   Auth header value: "${authHeader}"`);
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
            console.log(`   Token from header: ${token.substring(0, 20)}...`);
        } else if (authHeader) {
            console.log(`   ⚠️  Auth header present but doesn't start with 'Bearer '`, authHeader.substring(0, 30));
        }
        
        // Also check query parameter (for EventSource/SSE which doesn't support headers)
        if (!token && req.query.token) {
            token = req.query.token as string;
            console.log(`   Token from query: ${token.substring(0, 20)}...`);
        }
        
        if (!token) {
            console.log(`   ❌ No token - returning 401`);
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        // Verify token
        const payload = verifyAccessToken(token);

        // Check if token is revoked
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        const isRevoked = await isTokenRevoked(decoded.jti);

        if (isRevoked) {
            console.log(`   ❌ Token revoked - returning 401`);
            return res.status(401).json({
                success: false,
                error: 'Token has been revoked'
            });
        }

        // Attach user and token JTI to request
        req.user = payload;
        req.tokenJti = decoded.jti;
        
        console.log(`   ✅ Authenticated: userId=${payload.userId}, schoolId=${payload.schoolId}`);

        next();
    } catch (error: any) {
        console.log(`   ❌ Auth error: ${error.message}`);
        logger.warn({ error: error.message }, 'Authentication failed');
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
}

/**
 * Middleware to require specific role(s)
 */
export function requireRole(...allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            console.log(`   ❌ Role check failed: user.role=${req.user.role}, required=${allowedRoles.join(' or ')}`);
            logger.warn({
                userId: req.user.userId,
                role: req.user.role,
                requiredRoles: allowedRoles
            }, 'Unauthorized role access attempt');

            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }

        console.log(`   ✅ Role OK: ${req.user.role}`);
        next();
    };
}

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware to require teacher or admin role
 */
export const requireTeacherOrAdmin = requireRole('teacher', 'admin');

/**
 * Optional authentication - attaches user if token valid, doesn't reject if not
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const payload = verifyAccessToken(token);
            
            const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            const isRevoked = await isTokenRevoked(decoded.jti);

            if (!isRevoked) {
                req.user = payload;
                req.tokenJti = decoded.jti;
            }
        }

        next();
    } catch (error) {
        // Invalid token, continue without user
        next();
    }
}
