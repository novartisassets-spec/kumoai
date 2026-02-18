/**
 * GA REPOSITORY
 * Database layer for Group Agent operations
 */

import { db } from '../index';
import { logger } from '../../utils/logger';

export interface GAContextRecord {
    schoolId: string;
    lastPulseMorning?: Date;
    lastPulseAfternoon?: Date;
    lastPulseEvening?: Date;
    memberCount: number;
    isInEmergencyMode: boolean;
    emergencyReason?: string;
    emergencyStartedAt?: Date;
    updatedAt: Date;
}

export interface ModerationLogRecord {
    schoolId: string;
    messageId?: string;
    messageAuthor: string;
    messageContent?: string;
    actionType: 'DELETED' | 'WARNED' | 'FLAGGED' | 'ESCALATED';
    reason: string;
    moderationNote?: string;
    timestamp?: Date;
}

export interface ConversationMessageRecord {
    schoolId: string;
    agent: string;
    userPhone: string;
    userId: string;
    messageRole: 'user' | 'assistant';
    messageContent: string;
    actionPerformed?: string | null;
    actionStatus?: string | null;
    timestamp?: Date;
}

export class GARepository {
    /**
     * Get GA context for a school
     */
    static async getGAContext(schoolId: string): Promise<GAContextRecord | null> {
        return new Promise<GAContextRecord | null>((resolve, reject) => {
            const sql = `SELECT * FROM ga_context WHERE school_id = ?`;

            db.getDB().get(sql, [schoolId], (err: any, row: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    resolve(null);
                    return;
                }

                resolve({
                    schoolId: row.school_id,
                    lastPulseMorning: row.last_pulse_morning ? new Date(row.last_pulse_morning) : undefined,
                    lastPulseAfternoon: row.last_pulse_afternoon ? new Date(row.last_pulse_afternoon) : undefined,
                    lastPulseEvening: row.last_pulse_evening ? new Date(row.last_pulse_evening) : undefined,
                    memberCount: row.member_count || 0,
                    isInEmergencyMode: row.is_in_emergency_mode === 1,
                    emergencyReason: row.emergency_reason,
                    emergencyStartedAt: row.emergency_started_at ? new Date(row.emergency_started_at) : undefined,
                    updatedAt: new Date(row.updated_at)
                });
            });
        });
    }

    /**
     * Update GA context
     */
    static async updateGAContext(schoolId: string, updates: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // Build dynamic UPDATE query
            const keys = Object.keys(updates);
            const setClause = keys.map(k => {
                const dbKey = k
                    .replace(/([A-Z])/g, '_$1')
                    .toLowerCase()
                    .replace(/^_/, '');
                return `${dbKey} = ?`;
            }).join(', ');

            const values = keys.map(k => {
                const val = updates[k];
                if (typeof val === 'boolean') return val ? 1 : 0;
                if (val instanceof Date) return val.toISOString();
                return val;
            });

            values.push(schoolId);

            const sql = `UPDATE ga_context SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE school_id = ?`;

            db.getDB().run(sql, values, (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Initialize GA context for a new school
     */
    static async initializeGAContext(schoolId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sql = `
                INSERT OR IGNORE INTO ga_context (school_id, member_count, is_in_emergency_mode)
                VALUES (?, 0, 0)
            `;

            db.getDB().run(sql, [schoolId], (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Log moderation action
     */
    static async logModeration(record: ModerationLogRecord): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sql = `
                INSERT INTO moderation_logs (
                    school_id, message_id, message_author, message_content,
                    action_type, reason, moderation_note, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

            db.getDB().run(
                sql,
                [
                    record.schoolId,
                    record.messageId || null,
                    record.messageAuthor,
                    record.messageContent || null,
                    record.actionType,
                    record.reason,
                    record.moderationNote || null
                ],
                (err: any) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Get moderation history for a school
     */
    static async getModerationHistory(schoolId: string, limit: number = 50): Promise<ModerationLogRecord[]> {
        return new Promise<ModerationLogRecord[]>((resolve, reject) => {
            const sql = `
                SELECT * FROM moderation_logs
                WHERE school_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `;

            db.getDB().all(sql, [schoolId, limit], (err: any, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }

                const records = (rows || []).map(row => ({
                    schoolId: row.school_id,
                    messageId: row.message_id,
                    messageAuthor: row.message_author,
                    messageContent: row.message_content,
                    actionType: row.action_type,
                    reason: row.reason,
                    moderationNote: row.moderation_note,
                    timestamp: new Date(row.timestamp)
                }));

                resolve(records);
            });
        });
    }

    /**
     * Store conversation message in memory
     */
    static async storeConversationMessage(record: ConversationMessageRecord): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sql = `
                INSERT INTO conversation_memory (
                    school_id, agent, user_phone, user_id, message_role,
                    message_content, action_performed, action_status, message_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

            db.getDB().run(
                sql,
                [
                    record.schoolId,
                    record.agent,
                    record.userPhone,
                    record.userId,
                    record.messageRole,
                    record.messageContent,
                    record.actionPerformed || null,
                    record.actionStatus || null
                ],
                (err: any) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Get recent conversation history for a user
     */
    static async getConversationHistory(
        schoolId: string,
        agent: string,
        userPhone: string,
        limit: number = 20
    ): Promise<ConversationMessageRecord[]> {
        return new Promise<ConversationMessageRecord[]>((resolve, reject) => {
            const sql = `
                SELECT * FROM conversation_memory
                WHERE school_id = ? AND agent = ? AND user_phone = ?
                ORDER BY message_timestamp DESC
                LIMIT ?
            `;

            db.getDB().all(sql, [schoolId, agent, userPhone, limit], (err: any, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }

                const records = (rows || []).map(row => ({
                    schoolId: row.school_id,
                    agent: row.agent,
                    userPhone: row.user_phone,
                    userId: row.user_id,
                    messageRole: row.message_role,
                    messageContent: row.message_content,
                    actionPerformed: row.action_performed,
                    actionStatus: row.action_status,
                    timestamp: new Date(row.message_timestamp)
                }));

                resolve(records);
            });
        });
    }

    /**
     * Record new member greeting
     * ✅ GA FIX 2.2: Records greeting for audit trail (LLM-driven)
     */
    static async recordNewMemberGreeting(data: {
        schoolId: string;
        groupJid?: string;
        memberPhone: string;
        greetingText: string;
        greetedAt: Date;
    }): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sql = `
                INSERT INTO conversation_memory (
                    school_id, agent, user_phone, message_role,
                    message_content, action_performed, message_timestamp
                ) VALUES (?, 'GA', ?, 'assistant', ?, 'GREET_NEW_MEMBER', ?)
            `;

            db.getDB().run(
                sql,
                [data.schoolId, data.memberPhone, data.greetingText, data.greetedAt.toISOString()],
                (err: any) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Create memory snapshot for compression
     */
    static async createMemorySnapshot(data: {
        schoolId: string;
        agent: string;
        userPhone: string;
        userId: string;
        summaryContent: string;
        messageCountIncluded: number;
        timePeriodStart: Date;
        timePeriodEnd: Date;
    }): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sql = `
                INSERT INTO agent_memory_snapshots (
                    school_id, agent, user_phone, user_id, summary_content,
                    message_count_included, time_period_start, time_period_end
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.getDB().run(
                sql,
                [
                    data.schoolId,
                    data.agent,
                    data.userPhone,
                    data.userId,
                    data.summaryContent,
                    data.messageCountIncluded,
                    data.timePeriodStart.toISOString(),
                    data.timePeriodEnd.toISOString()
                ],
                (err: any) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Get recent memory snapshots
     */
    static async getRecentSnapshots(
        schoolId: string,
        agent: string,
        userPhone: string,
        limit: number = 5
    ): Promise<any[]> {
        return new Promise<any[]>((resolve, reject) => {
            const sql = `
                SELECT * FROM agent_memory_snapshots
                WHERE school_id = ? AND agent = ? AND user_phone = ?
                ORDER BY created_at DESC
                LIMIT ?
            `;

            db.getDB().all(sql, [schoolId, agent, userPhone, limit], (err: any, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Delete old conversation messages (retention policy)
     */
    static async cleanupOldConversations(olderThanDays: number = 90): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            const sql = `
                DELETE FROM conversation_memory
                WHERE message_timestamp < datetime('now', ? || ' days')
            `;

            db.getDB().run(sql, [olderThanDays * -1], function(err: any) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    /**
     * ✅ GA FIX 1.1: Validate group registration for multi-tenant safety
     * Checks if a group JID is properly linked to a school
     * Returns: {valid: boolean, schoolId?: string, error?: string}
     */
    static async validateGroupRegistration(
        groupJid: string
    ): Promise<{valid: boolean; schoolId?: string; isNewGroup?: boolean; error?: string}> {
        try {
            const groupRecord: any = await new Promise((resolve) => {
                db.getDB().get(
                    `SELECT school_id FROM group_registrations WHERE group_jid = ?`,
                    [groupJid],
                    (err, row) => resolve(row)
                );
            });

            if (!groupRecord) {
                return {valid: false, isNewGroup: true, error: 'Group not yet registered in system'};
            }

            return {valid: true, schoolId: groupRecord.school_id};
        } catch (err) {
            logger.error({ error: err, groupJid }, '❌ Error validating group registration');
            return {valid: false, error: 'Database error during validation'};
        }
    }

    /**
     * ✅ GA FIX 1.1: Register or update group JID to school mapping
     * Ensures multi-tenant isolation - group can only belong to one school
     * Called when GA receives first message from unregistered group
     */
    static async registerGroupToSchool(
        groupJid: string,
        schoolId: string
    ): Promise<{success: boolean; message: string}> {
        try {
            // Check if this group is already registered to a DIFFERENT school
            const existing: any = await new Promise((resolve) => {
                db.getDB().get(
                    `SELECT school_id FROM group_registrations WHERE group_jid = ?`,
                    [groupJid],
                    (err, row) => resolve(row)
                );
            });

            if (existing && existing.school_id !== schoolId) {
                return {
                    success: false,
                    message: `Multi-tenant violation: Group ${groupJid} already registered to different school`
                };
            }

            // Register or update
            await new Promise<void>((resolve, reject) => {
                db.getDB().run(
                    `INSERT OR REPLACE INTO group_registrations 
                    (group_jid, school_id, registered_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)`,
                    [groupJid, schoolId],
                    (err) => err ? reject(err) : resolve()
                );
            });

            logger.info({ groupJid, schoolId }, '✅ Group registered to school');
            return {success: true, message: 'Group registered successfully'};
        } catch (err) {
            logger.error({ error: err, groupJid, schoolId }, 'Failed to register group');
            return {success: false, message: 'Registration failed'};
        }
    }

    /**
     * ✅ GA FIX 2.2: Record message moderation decision (LLM-driven)
     * Backend stores moderation without forcing action - LLM decides what to do
     * Records: flagged messages, deletion requests, warnings for audit trail
     */
    static async recordMessageModeration(
        schoolId: string,
        groupJid: string,
        messageAuthor: string,
        messageId: string,
        messageContent: string,
        moderationFlag: 'CLEAN' | 'HURTFUL' | 'ABUSIVE',
        action?: 'FLAGGED' | 'DELETED' | 'WARNED'
    ): Promise<void> {
        try {
            await new Promise<void>((resolve, reject) => {
                db.getDB().run(
                    `INSERT INTO moderation_logs 
                    (school_id, group_jid, message_id, message_author, message_content, flag, action, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [schoolId, groupJid, messageId, messageAuthor, messageContent, moderationFlag, action || 'FLAGGED'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            logger.info({ schoolId, messageId, flag: moderationFlag }, '✅ Message moderation recorded');
        } catch (err) {
            logger.error({ error: err }, 'Failed to record message moderation');
            // Don't fail - moderation already communicated by LLM
        }
    }
}
