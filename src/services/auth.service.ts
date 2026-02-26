/**
 * Authentication Service
 * Handles JWT tokens, password hashing, and session management
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// JWT Configuration - Must have environment variables set
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Set it before starting the server.');
}
if (!JWT_REFRESH_SECRET) {
    throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is required. Set it before starting the server.');
}

const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

// Types
export interface UserPayload {
    userId: string;
    phone: string;
    role: 'admin' | 'teacher' | 'parent';
    schoolId: string;
    schoolName?: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface LoginCredentials {
    phone: string;
    password: string;
    schoolId?: string;
}

export interface SignupData {
    schoolName: string;
    adminPhone: string;
    email?: string;
    password: string;
    schoolType?: 'PRIMARY' | 'SECONDARY' | 'BOTH';
    address?: string;
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: UserPayload): string {
    return jwt.sign(payload, JWT_SECRET!, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'kumo-api',
        audience: 'kumo-client'
    });
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(userId: string): string {
    return jwt.sign({ userId, type: 'refresh' }, JWT_REFRESH_SECRET!, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        issuer: 'kumo-api',
        audience: 'kumo-client'
    });
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): UserPayload {
    try {
        return jwt.verify(token, JWT_SECRET!, {
            issuer: 'kumo-api',
            audience: 'kumo-client'
        }) as UserPayload;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): { userId: string } {
    try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET!, {
            issuer: 'kumo-api',
            audience: 'kumo-client'
        }) as { userId: string; type: string };
        
        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }
        
        return { userId: decoded.userId };
    } catch (error) {
        throw new Error('Invalid or expired refresh token');
    }
}

/**
 * Login user with phone and password
 */
export async function login(credentials: LoginCredentials): Promise<{ user: UserPayload; tokens: AuthTokens }> {
    const { phone, password, schoolId } = credentials;

    // Find user by phone
    const user: any = await new Promise((resolve, reject) => {
        let sql = `SELECT u.*, s.name as school_name, s.id as school_id 
                   FROM users u 
                   JOIN schools s ON u.school_id = s.id 
                   WHERE u.phone = ? AND u.is_active = true`;
        
        const params: any[] = [phone];
        
        if (schoolId) {
            sql += ` AND u.school_id = ?`;
            params.push(schoolId);
        }
        
        db.getDB().get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    if (!user) {
        throw new Error('Invalid phone number or password');
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
        throw new Error('Account temporarily locked. Please try again later.');
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
        // Increment failed attempts
        await new Promise<void>((resolve) => {
            db.getDB().run(
                `UPDATE users SET failed_login_attempts = failed_login_attempts + 1 
                 WHERE id = ?`,
                [user.id],
                () => resolve()
            );
        });

        // Lock account after 5 failed attempts
        if (user.failed_login_attempts >= 4) {
            const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
            await new Promise<void>((resolve) => {
                db.getDB().run(
                    `UPDATE users SET locked_until = ? WHERE id = ?`,
                    [lockedUntil.toISOString(), user.id],
                    () => resolve()
                );
            });
            throw new Error('Account locked due to too many failed attempts. Try again in 30 minutes.');
        }

        throw new Error('Invalid phone number or password');
    }

    // Reset failed attempts and update last login
    await new Promise<void>((resolve) => {
        db.getDB().run(
            `UPDATE users SET 
                failed_login_attempts = 0,
                last_login_at = CURRENT_TIMESTAMP,
                locked_until = NULL
             WHERE id = ?`,
            [user.id],
            () => resolve()
        );
    });

    // Generate tokens
    const payload: UserPayload = {
        userId: user.id,
        phone: user.phone,
        role: user.role,
        schoolId: user.school_id,
        schoolName: user.school_name
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(user.id);

    // Store session
    const sessionId = uuidv4();
    const decoded = jwt.decode(accessToken) as { jti?: string } | null;
    const tokenJti = decoded?.jti || uuidv4();
    
    await new Promise<void>((resolve) => {
        db.getDB().run(
            `INSERT INTO user_sessions (id, user_id, school_id, token_jti, expires_at)
             VALUES (?, ?, ?, ?, datetime('now', '+15 minutes'))`,
            [sessionId, user.id, user.school_id, tokenJti],
            () => resolve()
        );
    });

    return {
        user: payload,
        tokens: {
            accessToken,
            refreshToken,
            expiresIn: 900 // 15 minutes in seconds
        }
    };
}

/**
 * Signup new school and admin
 */
export async function signup(data: SignupData): Promise<{ user: UserPayload; tokens: AuthTokens }> {
    const { schoolName, adminPhone, email, password, schoolType, address } = data;

    process.stderr.write('[SIGNUP] ========== STARTING ==========\n');
    process.stderr.write('[SIGNUP] Phone: ' + adminPhone + '\n');

    try {
        // Check if phone already exists
        const existingUser: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT id FROM users WHERE phone = ?`,
                [adminPhone],
                (err, row) => resolve(row)
            );
        });

        if (existingUser) {
            throw new Error('Phone number already registered');
        }

        // Create school
        const schoolId = uuidv4();
        const schoolTypeValue = schoolType || 'SECONDARY';
        process.stderr.write('[SIGNUP] Creating school: ' + schoolId + '\n');
        
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO schools (id, name, admin_phone, school_type, config_json, setup_status)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    schoolId,
                    schoolName,
                    adminPhone,
                    schoolTypeValue,
                    JSON.stringify({ address, email }),
                    'PENDING_SETUP'
                ],
                (err) => {
                    if (err) {
                        process.stderr.write('[SIGNUP] School insert ERROR: ' + err.message + '\n');
                        reject(err);
                    }
                    else {
                        process.stderr.write('[SIGNUP] School created OK\n');
                        resolve();
                    }
                }
            );
        });

        // Create admin user
        const userId = uuidv4();
        const passwordHash = await hashPassword(password);
        
        // Use db.run directly (async) instead of callback wrapper
        // Use ? placeholders and let convertParams handle PostgreSQL conversion
        const userInsertResult = await db.run(
            `INSERT INTO users (id, phone, role, name, school_id, password_hash, email, is_active)
             VALUES (?, ?, 'admin', ?, ?, ?, ?, true)`,
            [userId, adminPhone, 'System Admin', schoolId, passwordHash, email || null]
        );
        
        process.stderr.write('[SIGNUP] User insert result: ' + JSON.stringify(userInsertResult) + '\n');
        
        // Verify user was actually created
        const verifyUser = await db.get(
            `SELECT id, phone, role, school_id FROM users WHERE id = ?`,
            [userId]
        );
        
        if (!verifyUser) {
            throw new Error('User creation failed - insert did not persist');
        }
        process.stderr.write('[SIGNUP] Verified: user created successfully\n');

        // Initialize setup state
        await new Promise<void>((resolve) => {
            db.getDB().run(
                `INSERT INTO setup_state (school_id, current_step, completed_steps, is_active)
                 VALUES (?, 'PENDING_SETUP', '[]', 1)`,
                [schoolId],
                (err) => {
                    if (err) {
                        process.stderr.write('[SIGNUP] Setup state insert ERROR: ' + err.message + '\n');
                    } else {
                        process.stderr.write('[SIGNUP] Setup state created OK\n');
                    }
                    resolve();
                }
            );
        });

        // Generate tokens
        const payload: UserPayload = {
            userId,
            phone: adminPhone,
            role: 'admin',
            schoolId,
            schoolName
        };

        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(userId);

        process.stderr.write('[SIGNUP] ========== SIGNUP COMPLETE ==========\n');

        return {
            user: payload,
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: 900
            }
        };
    } catch (error: any) {
        process.stderr.write('[SIGNUP] ========== SIGNUP FAILED ==========\n');
        process.stderr.write('[SIGNUP] Error: ' + error.message + '\n');
        process.stderr.write('[SIGNUP] Stack: ' + error.stack + '\n');
        throw error;
    }
}

/**
 * Refresh access token
 */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
        const { userId } = verifyRefreshToken(refreshToken);

        // Get user data
        const user: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT u.*, s.name as school_name 
                 FROM users u 
                 JOIN schools s ON u.school_id = s.id 
                 WHERE u.id = ? AND u.is_active = true`,
                [userId],
                (err, row) => resolve(row)
            );
        });

        if (!user) {
            throw new Error('User not found');
        }

        const payload: UserPayload = {
            userId: user.id,
            phone: user.phone,
            role: user.role,
            schoolId: user.school_id,
            schoolName: user.school_name
        };

        return {
            accessToken: generateAccessToken(payload),
            refreshToken: generateRefreshToken(user.id),
            expiresIn: 900
        };
    } catch (error) {
        throw new Error('Invalid refresh token');
    }
}

/**
 * Logout user (revoke session)
 */
export async function logout(userId: string, tokenJti: string): Promise<void> {
    await new Promise<void>((resolve) => {
        db.getDB().run(
            `UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ? AND token_jti = ?`,
            [userId, tokenJti],
            () => resolve()
        );
    });

    logger.info({ userId }, 'User logged out');
}

/**
 * Logout from all devices
 */
export async function logoutAll(userId: string): Promise<void> {
    await new Promise<void>((resolve) => {
        db.getDB().run(
            `UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?`,
            [userId],
            () => resolve()
        );
    });

    logger.info({ userId }, 'User logged out from all devices');
}

/**
 * Check if token is revoked
 */
export async function isTokenRevoked(tokenJti: string): Promise<boolean> {
    const session: any = await new Promise((resolve) => {
        db.getDB().get(
            `SELECT is_revoked FROM user_sessions WHERE token_jti = ?`,
            [tokenJti],
            (err, row) => resolve(row)
        );
    });

    return session?.is_revoked === 1;
}

/**
 * Change password
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Get current password hash
    const user: any = await new Promise((resolve) => {
        db.getDB().get(
            `SELECT password_hash FROM users WHERE id = ?`,
            [userId],
            (err, row) => resolve(row)
        );
    });

    if (!user) {
        throw new Error('User not found');
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
        throw new Error('Current password is incorrect');
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    
    await new Promise<void>((resolve) => {
        db.getDB().run(
            `UPDATE users SET password_hash = ? WHERE id = ?`,
            [newHash, userId],
            () => resolve()
        );
    });

    // Revoke all existing sessions (force re-login)
    await logoutAll(userId);

    logger.info({ userId }, 'Password changed successfully');
}

/**
 * Request password reset
 */
export async function requestPasswordReset(phone: string): Promise<string> {
    const user: any = await new Promise((resolve) => {
        db.getDB().get(
            `SELECT id, email FROM users WHERE phone = ? AND is_active = true`,
            [phone],
            (err, row) => resolve(row)
        );
    });

    if (!user) {
        // Don't reveal if user exists
        return 'If an account exists, a reset link has been sent';
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await new Promise<void>((resolve) => {
        db.getDB().run(
            `INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
             VALUES (?, ?, ?, ?)`,
            [uuidv4(), user.id, token, expiresAt.toISOString()],
            () => resolve()
        );
    });

    // TODO: Send WhatsApp message with reset token
    logger.info({ userId: user.id }, 'Password reset requested');

    return 'If an account exists, a reset link has been sent';
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken: any = await new Promise((resolve) => {
        db.getDB().get(
            `SELECT user_id FROM password_reset_tokens 
             WHERE token = ? AND expires_at > datetime('now') AND used_at IS NULL`,
            [token],
            (err, row) => resolve(row)
        );
    });

    if (!resetToken) {
        throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(newPassword);

    await new Promise<void>((resolve) => {
        db.getDB().run(
            `UPDATE users SET password_hash = ? WHERE id = ?`,
            [passwordHash, resetToken.user_id],
            () => resolve()
        );
    });

    // Mark token as used
    await new Promise<void>((resolve) => {
        db.getDB().run(
            `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE token = ?`,
            [token],
            () => resolve()
        );
    });

    // Revoke all sessions
    await logoutAll(resetToken.user_id);

    logger.info({ userId: resetToken.user_id }, 'Password reset successful');
}
