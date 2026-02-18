/**
 * Authentication API Routes
 * Handles login, signup, token refresh, logout
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
    login,
    signup,
    refreshTokens,
    logout,
    changePassword,
    requestPasswordReset,
    resetPassword,
    UserPayload
} from '../../services/auth.service';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { logger } from '../../utils/logger';
import { db } from '../../db';

const router = Router();

// Validation schemas
const loginSchema = z.object({
    phone: z.string().min(10).max(15),
    password: z.string().min(6),
    schoolId: z.string().optional()
});

const signupSchema = z.object({
    schoolName: z.string().min(2).max(100),
    adminPhone: z.string().min(10).max(15),
    email: z.string().email().optional(),
    password: z.string().min(8),
    schoolType: z.enum(['PRIMARY', 'SECONDARY', 'BOTH']).optional(),
    address: z.string().optional()
});

const refreshSchema = z.object({
    refreshToken: z.string()
});

const changePasswordSchema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8)
});

const passwordResetRequestSchema = z.object({
    phone: z.string().min(10).max(15)
});

const passwordResetSchema = z.object({
    token: z.string(),
    newPassword: z.string().min(8)
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        // Validate input
        const result = loginSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input data',
                details: result.error.issues
            });
        }

        const { phone, password, schoolId } = result.data;

        // Attempt login
        const authResult = await login({ phone, password, schoolId });

        // Set HTTP-only cookie with refresh token
        res.cookie('refreshToken', authResult.tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        logger.info({ userId: authResult.user.userId }, 'User logged in');

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: authResult.user,
                accessToken: authResult.tokens.accessToken,
                expiresIn: authResult.tokens.expiresIn
            }
        });
    } catch (error: any) {
        logger.warn({ error: error.message }, 'Login failed');
        res.status(401).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/auth/signup
 * Register new school and admin
 */
router.post('/signup', async (req: Request, res: Response) => {
    try {
        // Validate input
        const result = signupSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input data',
                details: result.error.issues
            });
        }

        const { schoolName, adminPhone, email, password, schoolType, address } = result.data;

        // Create school and admin
        const authResult = await signup({
            schoolName,
            adminPhone,
            email,
            password,
            schoolType,
            address
        });

        // Set HTTP-only cookie with refresh token
        res.cookie('refreshToken', authResult.tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        logger.info({
            userId: authResult.user.userId,
            schoolId: authResult.user.schoolId
        }, 'New school registered');

        res.status(201).json({
            success: true,
            message: 'School registered successfully',
            data: {
                user: authResult.user,
                accessToken: authResult.tokens.accessToken,
                expiresIn: authResult.tokens.expiresIn
            }
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Signup failed');
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        // Get refresh token from cookie or body
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                error: 'Refresh token required'
            });
        }

        // Validate input if from body
        if (req.body?.refreshToken) {
            const result = refreshSchema.safeParse(req.body);
            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid input data'
                });
            }
        }

        // Refresh tokens
        const tokens = await refreshTokens(refreshToken);

        // Update refresh token cookie
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                expiresIn: tokens.expiresIn
            }
        });
    } catch (error: any) {
        logger.warn({ error: error.message }, 'Token refresh failed');
        res.status(401).json({
            success: false,
            error: 'Invalid refresh token'
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout user and revoke session
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { user, tokenJti } = req;

        if (user && tokenJti) {
            await logout(user.userId, tokenJti);
        }

        // Clear refresh token cookie
        res.clearCookie('refreshToken');

        logger.info({ userId: user?.userId }, 'User logged out');

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Logout failed');
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 */
router.post('/logout-all', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { user } = req;

        if (user) {
            const { logoutAll } = await import('../../services/auth.service');
            await logoutAll(user.userId);
        }

        // Clear refresh token cookie
        res.clearCookie('refreshToken');

        logger.info({ userId: user?.userId }, 'User logged out from all devices');

        res.json({
            success: true,
            message: 'Logged out from all devices'
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Logout all failed');
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user info with full profile data from database
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }

        // Fetch full user data from database
        const user: any = await new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT id, phone, name, email, role, school_id FROM users WHERE id = ?`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                userId: user.id,
                phone: user.phone,
                name: user.name || '',
                email: user.email || '',
                role: user.role,
                schoolId: user.school_id
            }
        });
    } catch (error: any) {
        logger.error({ error }, 'Failed to get user info');
        res.status(500).json({
            success: false,
            error: 'Failed to get user info'
        });
    }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticateToken, async (req: Request, res: Response) => {
    try {
        const result = changePasswordSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input data',
                details: result.error.issues
            });
        }

        const { currentPassword, newPassword } = result.data;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }

        await changePassword(userId, currentPassword, newPassword);

        // Clear refresh token cookie (force re-login)
        res.clearCookie('refreshToken');

        logger.info({ userId }, 'Password changed');

        res.json({
            success: true,
            message: 'Password changed successfully. Please log in again.'
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Password change failed');
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/auth/profile
 * Update user profile
 */
router.post('/profile', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }

        const { name, email } = req.body;

        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?`,
                [name || null, email || null, userId],
                (err) => err ? reject(err) : resolve()
            );
        });

        logger.info({ userId, name, email }, 'Profile updated');

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Profile update failed');
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update profile'
        });
    }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
    try {
        const result = passwordResetRequestSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number'
            });
        }

        const { phone } = result.data;

        // Request reset (sends WhatsApp message)
        const message = await requestPasswordReset(phone);

        // Always return same message for security (don't reveal if user exists)
        res.json({
            success: true,
            message
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Password reset request failed');
        res.status(500).json({
            success: false,
            error: 'Failed to process request'
        });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
    try {
        const result = passwordResetSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input data',
                details: result.error.issues
            });
        }

        const { token, newPassword } = result.data;

        await resetPassword(token, newPassword);

        res.json({
            success: true,
            message: 'Password reset successful. Please log in with your new password.'
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Password reset failed');
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

export { router as authRouter };
