import { IncomingMessage, RoutedMessage, AgentContext, UserIdentity, UserRole } from '../types';
import { UserRepository } from '../../db/repositories/user.repo';
import { TeacherSessionManager } from '../../services/teacher-session';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { PhoneNormalizer } from '../../utils/phone-normalizer';

export class MessageRouter {

    static async route(msg: IncomingMessage): Promise<RoutedMessage> {
        try {
            const { sessionService } = await import('../../services/session');

            // Normalize sender phone (remove @s.whatsapp.net suffix)
            const normalizedFrom = PhoneNormalizer.normalize(msg.from);
            const normalizedParticipant = msg.participant ? PhoneNormalizer.normalize(msg.participant) : undefined;

            // 1. Establish Master Token & Registry
            let accessToken: string | null = null;
            const tokenRegex = /\b((?:PAT|TEA)-KUMO-[A-Z0-9-]{4,})\b/i;
            const tokenMatch = (msg.body || '').match(tokenRegex);
            if (tokenMatch) {
                accessToken = tokenMatch[1].toUpperCase().replace(/_/g, '-');
            }

            // 2. Determine school context (CRITICAL for multi-tenancy)
            let schoolId: string | null = null;
            
            if (msg.isGroup) {
                schoolId = await this.findSchoolByGroupJid(msg.from);
                
                // 🛡️ GROUP FALLBACK: If group not linked, try bot context
                if (!schoolId) {
                    schoolId = await this.findSchoolByContext(msg);
                }
            } else {
                schoolId = await this.findSchoolByContext(msg);
                
                // 🛡️ SETUP FALLBACK: If school not found by bot number, try sender's number (admin/teacher lookup)
                if (!schoolId) {
                    schoolId = await this.findSchoolByAdminPhone(normalizedFrom);
                    if (!schoolId) {
                        schoolId = await this.findSchoolByTeacherPhone(normalizedFrom);
                    }
                    if (!schoolId) {
                        schoolId = await this.findSchoolByParentPhone(normalizedFrom);
                    }
                }
            }

            // 🛡️ GLOBAL TOKEN RESOLUTION: If school still not found, check the token
            if (!schoolId && accessToken) {
                logger.info({ token: accessToken.substring(0, 8) }, '🔍 [ROUTER] Unknown context - attempting Global Token Resolution');
                const tokenInfo: any = await new Promise((resolve) => {
                    db.getDB().get(
                        `SELECT school_id FROM teacher_access_tokens WHERE token = ? AND is_revoked = 0 AND expires_at > datetime('now')`,
                        [accessToken], (err, row) => resolve(row)
                    );
                });
                if (tokenInfo?.school_id) {
                    schoolId = tokenInfo.school_id;
                    logger.info({ schoolId, token: accessToken.substring(0, 8) }, '✅ [ROUTER] Context resolved via Global Token');
                }
            }

            // 3. Handle Group Messages (PRIORITY ROUTING)
            if (msg.isGroup) {
                const senderPhone = PhoneNormalizer.normalize(msg.participant || msg.from);
                const senderIdentity = schoolId ? await UserRepository.findByPhoneAndSchool(senderPhone, schoolId) : undefined;
                const isAdminInGroup = senderIdentity?.role === 'admin';
                const effectiveRole = (senderIdentity?.role as UserRole) || 'parent';

                return {
                    ...msg,
                    context: 'GA',
                    identity: {
                        phone: senderPhone,
                        role: effectiveRole,
                        schoolId: schoolId || 'unknown',
                        userId: undefined,
                        name: senderIdentity?.name || 'Group Member'
                    },
                    senderIdentity: senderIdentity || undefined,
                    isAdminMessage: isAdminInGroup,
                    schoolId: schoolId || undefined
                };
            }

            if (!schoolId) {
                logger.warn({ from: msg.from, to: msg.to, isGroup: msg.isGroup }, '⚠️ [ROUTER] Could not resolve school context');
                return { ...msg, context: 'PA', identity: undefined, schoolId: undefined };
            }

            // 4. Handle Token-Based Identity Bridging (Priority 1)
            if (accessToken) {
                try {
                    // Check if there's an active session on this device already
                    const activeParentSession = sessionService.getSession(msg.from);
                    const activeTeacherSession = TeacherSessionManager.getSessionByPhone(msg.from);
                    const activeBefore = activeParentSession || activeTeacherSession;

                    const identity = await UserRepository.findUserByToken(accessToken, schoolId);
                    if (identity) {
                        logger.info({ role: identity.role, token: accessToken.substring(0, 8) }, '✅ [ROUTER] Valid token - bridging identity');
                        
                        let sessionId: string | undefined;
                        let isUserSwitch = false;

                        if (activeBefore) {
                            const oldUserId = (activeBefore as any).userId || (activeBefore as any).teacher_id;
                            if (oldUserId !== identity.userId) {
                                isUserSwitch = true;
                                logger.info({ phone: msg.from, oldUser: oldUserId, newUser: identity.userId }, '🔄 [ROUTER] User switch detected on device');
                            }
                        }

                        if (identity.role === 'teacher') {
                            sessionId = await TeacherSessionManager.createSession(
                                identity.userId,
                                accessToken,
                                schoolId,
                                normalizedFrom,
                                identity.name || 'Teacher'
                            );
                        } else if (identity.role === 'parent') {
                            sessionId = await sessionService.createSession(
                                identity.userId,
                                normalizedFrom,
                                'parent',
                                180,
                                { parent_name: identity.name }
                            );
                        }

                        return {
                            ...msg,
                            context: identity.role === 'teacher' ? 'TA' : 'PA',
                            identity: { ...identity, phone: normalizedFrom },
                            sessionId,
                            accessToken,
                            isTokenAuthenticated: true,
                            isUserSwitch,
                            schoolId
                        };
                    } else {
                        logger.warn({ token: accessToken.substring(0, 8) }, '⚠️ [ROUTER] Invalid or expired token');
                    }
                } catch (err) {
                    logger.error({ err, token: accessToken.substring(0, 8) }, 'Token validation failed');
                }
            }

            // 5. Resolve Identity by Phone and School (Priority 2)
            let identity = await UserRepository.findByPhoneAndSchool(normalizedFrom, schoolId);
            
            // 🛡️ SETUP WIZARD OVERRIDE: If school is in setup and sender is the admin phone, force SA context
            if (!identity && schoolId) {
                const isAdmin = await this.isAdminPhone(normalizedFrom, schoolId);
                if (isAdmin) {
                    logger.info({ phone: normalizedFrom, schoolId }, '🛡️ [ROUTER] Admin detected during setup - forcing SA context');
                    identity = {
                        userId: undefined,
                        phone: normalizedFrom,
                        role: 'admin',
                        schoolId: schoolId,
                        name: 'School Admin'
                    };
                }
            }

            // ✅ SHARED DEVICE LOCK: If there's an active session, it takes priority over the phone owner
            const activeParentSession = sessionService.getSession(normalizedFrom);
            const activeTeacherSession = TeacherSessionManager.getSessionByPhone(normalizedFrom);
            const activeSession = activeParentSession || activeTeacherSession;

            if (activeSession) {
                const s = activeSession as any;
                const userId = s.userId || s.teacher_id;
                const role = s.role || 'teacher';
                const name = s.context?.temporary_name || s.teacher_name || s.context?.parent_name || 'Authenticated User';

                logger.debug({ phone: normalizedFrom, userId, role }, '✅ [ROUTER] Device locked to active session');
                identity = {
                    userId,
                    phone: normalizedFrom,
                    role: role as UserRole,
                    schoolId: schoolId,
                    name
                };
            }

            const isIdentifiedParent = await this.isIdentifiedParent(normalizedFrom, schoolId);

            let context: AgentContext = 'PA';
            if (identity) {
                switch (identity.role) {
                    case 'admin': context = 'SA'; break;
                    case 'teacher': context = 'TA'; break;
                    case 'parent': context = 'PA'; break;
                }
            }

            // FINAL FALLBACK: Check if we've learned a name in an unauthenticated session
            let learnedName = 'Unknown User';
            const session = sessionService.getSession(normalizedFrom);
            if (session?.context?.temporary_name) {
                learnedName = session.context.temporary_name;
            }

            return {
                ...msg,
                context,
                identity: identity || {
                    phone: normalizedFrom,
                    role: 'parent',
                    schoolId: schoolId,
                    userId: undefined,
                    name: learnedName
                },
                schoolId,
                isIdentifiedParent,
                sessionId: identity ? (session?.id) : undefined
            };

        } catch (error) {
            logger.error({ error, msg }, 'Routing failed');
            throw error;
        }
    }

    private static async findSchoolByContext(msg: IncomingMessage): Promise<string | null> {
        if (!msg.to) return null;
        
        const normalizedTo = msg.to.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');
        
        return new Promise((resolve) => {
            db.getDB().get(
                `SELECT id FROM schools WHERE connected_whatsapp_jid = ? OR connected_whatsapp_jid LIKE ?`,
                [msg.to, `${normalizedTo}%@s.whatsapp.net`],
                (err, row: any) => resolve(row?.id || null)
            );
        });
    }

    private static async isIdentifiedParent(phone: string, schoolId: string): Promise<boolean> {
        return new Promise((resolve) => {
            db.getDB().get(
                `SELECT parent_id FROM parent_registry WHERE parent_phone = ? AND school_id = ? AND is_active = 1`,
                [phone, schoolId],
                (err, row: any) => resolve(!!row)
            );
        });
    }

    private static async findSchoolByGroupJid(groupJid: string): Promise<string | null> {
        const jidVariants = [groupJid, groupJid.replace('@g.us', ''), `${groupJid}@g.us`];
        const uniqueVariants = Array.from(new Set(jidVariants));
        
        for (const variant of uniqueVariants) {
            const row: any = await new Promise((resolve) => {
                db.getDB().get(`SELECT id FROM schools WHERE whatsapp_group_jid = ?`, [variant], (err, row) => resolve(row));
            });
            if (row?.id) return row.id;
        }
        return null;
    }

    private static async isAdminPhone(phone: string, schoolId: string): Promise<boolean> {
        return new Promise((resolve) => {
            db.getDB().get(
                `SELECT id FROM schools WHERE admin_phone = ? AND id = ?`,
                [phone, schoolId],
                (err, row) => resolve(!!row)
            );
        });
    }

    private static async findSchoolByAdminPhone(phone: string): Promise<string | null> {
        return new Promise((resolve) => {
            db.getDB().get(
                `SELECT id FROM schools WHERE admin_phone = ? LIMIT 1`,
                [phone],
                (err, row: any) => resolve(row?.id || null)
            );
        });
    }

    private static async findSchoolByTeacherPhone(phone: string): Promise<string | null> {
        return new Promise((resolve) => {
            db.getDB().get(
                `SELECT school_id FROM users WHERE phone = ? AND role = 'teacher' LIMIT 1`,
                [phone],
                (err, row: any) => resolve(row?.school_id || null)
            );
        });
    }

    private static async findSchoolByParentPhone(phone: string): Promise<string | null> {
        return new Promise((resolve) => {
            db.getDB().get(
                `SELECT school_id FROM parent_registry WHERE parent_phone = ? AND is_active = 1 LIMIT 1`,
                [phone],
                (err, row: any) => resolve(row?.school_id || null)
            );
        });
    }
}
