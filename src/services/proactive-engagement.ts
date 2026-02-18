/**
 * AGENT BRIDGE SERVICE
 * Bridges School Admin (SA) decisions to proactive actions by:
 * - Parent Agent (PA) -> Parent Checkups
 * - Group Agent (GA) -> Group Announcements
 * - Teacher Agent (TA/PrimaryTA) -> Teacher Notifications
 */

import { db } from '../db';
import { logger } from '../utils/logger';
import { messenger } from './messenger';
import { ParentAgent } from '../agents/pa';
import { SchoolGroupAgent } from '../agents/ga';
import { TeacherAgent } from '../agents/ta';
import { PrimaryTeacherAgent } from '../agents/primary-ta';
import { v4 as uuidv4 } from 'uuid';
import { HistoryManager } from '../core/memory/history-manager';

import { SchoolAdminAgent } from '../agents/sa';

export interface WorkReport {
    success: boolean;
    agentFeedback: string; // The synthesized work report from the agent
    summary: string; // Short summary for Admin
}

export class AgentBridgeService {
    /**
     * RELAY REPORT: Route a work report from an agent (PA/TA/GA) back to SA (Admin) and Teacher
     */
    static async relayAgentReport(
        schoolId: string,
        agentType: string,
        reportContent: string,
        originalMessage: any
    ): Promise<void> {
        try {
            logger.info({ schoolId, agentType }, '🔄 Bridge: Relaying agent report');
            
            // 1. Notify SA (Admin)
            const sa = new SchoolAdminAgent();
            const adminSystemMsg = {
                ...originalMessage,
                context: 'SA',
                from: 'SYSTEM_EVENT',
                body: `SYSTEM EVENT: RECEIVE_AGENT_REPORT\nSource Agent: ${agentType}\nReport Content: ${reportContent}\n\nTask: Inform the admin about this update conversationally.`,
                identity: {
                    ...originalMessage.identity,
                    role: 'system_bridge',
                    schoolId: schoolId
                }
            };
            
            const saRes = await sa.handle(adminSystemMsg);
            
            if (saRes.reply_text) {
                const adminPhone: string | null = await new Promise((resolve) => {
                     db.getDB().get(`SELECT admin_phone FROM schools WHERE id = ?`, [schoolId], (err, row: any) => resolve(row?.admin_phone || null));
                });
                
                if (adminPhone) {
                    await messenger.sendPush(schoolId, adminPhone, saRes.reply_text);
                    logger.info({ adminPhone }, '✅ Bridge: Delivered report to admin');
                    await HistoryManager.recordMessage(schoolId, undefined, adminPhone, 'SA',
                        { type: 'text', body: saRes.reply_text, timestamp: Date.now(), source: 'system' },
                        { action: 'DELIVER_REPORT', status: 'COMPLETED' }
                    );
                }
            }

            // 2. Notify Teacher (if student context available)
            const studentId = originalMessage.identity?.userId; // For PA, userId is studentId
            if (agentType === 'PA' && studentId) {
                const teacher: any = await new Promise((resolve) => {
                    const sql = `
                        SELECT u.id, u.phone, u.name, u.school_type
                        FROM users u
                        JOIN students s ON u.assigned_class = s.class_level AND u.school_id = s.school_id
                        WHERE s.student_id = ? AND u.role = 'teacher'
                        LIMIT 1
                    `;
                    db.getDB().get(sql, [studentId], (err, row) => resolve(row));
                });

                if (teacher) {
                    const ta = teacher.school_type === 'PRIMARY' ? new PrimaryTeacherAgent() : new TeacherAgent();
                    const teacherMsg = {
                        ...originalMessage,
                        context: 'TA',
                        from: 'SYSTEM_EVENT',
                        body: `SYSTEM EVENT: PARENT_FEEDBACK\nStudent: ${originalMessage.identity?.studentName || 'Your student'}\nFeedback: ${reportContent}\n\nTask: Inform the teacher professionally.`,
                        identity: { schoolId, role: 'teacher', phone: teacher.phone, name: teacher.name }
                    };

                    const taRes = await ta.handle(teacherMsg as any);
                    await messenger.sendPush(schoolId, teacher.phone, taRes.reply_text);
                    logger.info({ teacherPhone: teacher.phone }, '✅ Bridge: Delivered report to teacher');

                    // 🧠 MEMORY: Record in teacher history
                    await HistoryManager.recordMessage(schoolId, teacher.id, teacher.phone, 'TA',
                        { type: 'text', body: `[PARENT FEEDBACK] ${reportContent}\n\n${taRes.reply_text}`, timestamp: Date.now(), source: 'system' },
                        { action: 'RECEIVE_FEEDBACK', status: 'COMPLETED' }
                    );
                }
            }
            
        } catch (error) {
            logger.error({ error }, '❌ Bridge: Failed to relay agent report');
        }
    }

    /**
     * WAKE UP PA: Engage a parent about a student's absence
     */
    static async engageParentOnAbsence(
        schoolId: string,
        studentName: string,
        reason: string,
        adminPhone: string
    ): Promise<WorkReport> {
        try {
            logger.info({ schoolId, studentName }, '🔍 [BRIDGE] Resolving parent for proactive checkup');

            // 1. Resolve student and parent phone
            // We search BOTH the master students table and the class_student_mapping from TA setup
            const mapping: any = await new Promise((resolve) => {
                const sql = `
                    SELECT 
                        s.student_id, 
                        pr.parent_phone, 
                        pr.parent_name, 
                        s.class_level,
                        EXISTS(SELECT 1 FROM parent_registry WHERE parent_phone IS NOT NULL AND parent_id = pr.parent_id) as has_parent
                    FROM students s
                    LEFT JOIN parent_children_mapping pcm ON s.student_id = pcm.student_id
                    LEFT JOIN parent_registry pr ON pcm.parent_id = pr.parent_id
                    WHERE (s.name LIKE ? OR s.student_id = ?) AND s.school_id = ?
                    LIMIT 1
                `;
                db.getDB().get(sql, [`%${studentName}%`, studentName, schoolId], (err, row) => {
                    if (err) logger.error({ err }, '❌ [BRIDGE] Parent lookup query failed');
                    resolve(row);
                });
            });

            if (!mapping) {
                logger.warn({ studentName, schoolId }, '⚠️ [BRIDGE] Student not found in master students table');
                
                // Fallback: Check if student exists in TA setup mappings
                const setupMapping: any = await new Promise((resolve) => {
                    db.getDB().get(
                        `SELECT student_name, class_level FROM class_student_mapping WHERE (student_name LIKE ? OR student_id = ?) AND school_id = ? LIMIT 1`,
                        [`%${studentName}%`, studentName, schoolId],
                        (err, row) => resolve(row)
                    );
                });

                if (setupMapping) {
                    return { 
                        success: false, 
                        agentFeedback: `I found ${setupMapping.student_name} in the ${setupMapping.class_level} register, but no parent is linked yet.`,
                        summary: `Student found in register but lacks parent contact info.` 
                    };
                }

                return { success: false, agentFeedback: 'Student lookup failed.', summary: `Could not find any student named "${studentName}".` };
            }

            if (!mapping.parent_phone) {
                logger.warn({ studentName, studentId: mapping.student_id }, '⚠️ [BRIDGE] Student found but no parent phone linked');
                return { 
                    success: false, 
                    agentFeedback: `I found ${studentName} (${mapping.class_level}), but his parent's contact information is missing from the registry.`,
                    summary: `No parent phone number linked for ${studentName}.` 
                };
            }

            const { student_id, parent_phone, parent_name } = mapping;
            logger.info({ student_id, parent_phone, parent_name }, '✅ [BRIDGE] Parent resolved');

            // 2. Fetch student performance data for personalization
            const topSubject: any = await new Promise((resolve) => {
                const sql = `
                    SELECT subject_id, MAX(total_score) as total
                    FROM student_marks
                    WHERE student_id = ? AND school_id = ?
                    GROUP BY subject_id ORDER BY total DESC LIMIT 1
                `;
                db.getDB().get(sql, [student_id, schoolId], (err, row) => resolve(row));
            });

            let subjectName = 'their studies';
            if (topSubject) {
                const sub: any = await new Promise((resolve) => {
                    db.getDB().get(`SELECT name FROM subjects WHERE id = ?`, [topSubject.subject_id], (err, row) => resolve(row));
                });
                if (sub) subjectName = sub.name;
            }

            // 3. Invoke PA
            const pa = new ParentAgent();
            const ghostMsg = {
                id: uuidv4(),
                from: parent_phone,
                body: `SYSTEM COMMAND: PROACTIVE_CHECKUP\nStudent: ${studentName}\nReason: ${reason}\nStrengths: Excelling in ${subjectName}\nTask: Reach out to parent ${parent_name} and provide a formal Work Report.`,
                context: 'PA',
                identity: { schoolId, userId: student_id, role: 'parent', name: parent_name }
            };

            const paRes = await pa.handle(ghostMsg as any);
            const checkupMessage = paRes.reply_text;
            const agentReport = (paRes.action_payload as any)?.report || 'Checkup message sent successfully.';

            // 4. Deliver & Record
            await messenger.sendPush(schoolId, parent_phone, checkupMessage);
            await HistoryManager.recordMessage(schoolId, student_id, parent_phone, 'PA', 
                { type: 'text', body: `[PROACTIVE CHECKUP] ${checkupMessage}`, timestamp: Date.now(), source: 'system' },
                { action: 'PROACTIVE_ENGAGEMENT', status: 'COMPLETED' });

            return { 
                success: true, 
                agentFeedback: agentReport,
                summary: `Checkup sent to ${parent_name}.` 
            };

        } catch (error) {
            logger.error({ error }, '❌ Bridge: Parent engagement failed');
            return { success: false, agentFeedback: 'Error in PA communication.', summary: 'Internal error during checkup.' };
        }
    }

    /**
     * WAKE UP GA: Broadcast an announcement to the school group
     */
    static async announceToGroup(
        schoolId: string,
        content: string,
        adminPhone: string
    ): Promise<WorkReport> {
        try {
            logger.info({ schoolId }, '📢 Bridge: Preparing group announcement');

            // 1. Get school group JID
            const school: any = await new Promise((resolve) => {
                db.getDB().get(`SELECT whatsapp_group_jid, name FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
            });

            if (!school || !school.whatsapp_group_jid) {
                return { success: false, agentFeedback: 'Group JID not found.', summary: 'The school WhatsApp group is not yet linked.' };
            }

            // 2. Invoke GA to craft announcement
            const ga = new SchoolGroupAgent();
            const ghostMsg = {
                id: uuidv4(),
                from: school.whatsapp_group_jid,
                body: `SYSTEM COMMAND: GROUP_ANNOUNCEMENT\nContent: ${content}\nTask: Post this announcement to the group using a warm, community-focused tone. Provide a Work Report on your tone.`,
                context: 'GA',
                identity: { schoolId, role: 'group_admin', name: 'System' }
            };

            const gaRes = await ga.handle(ghostMsg as any);
            const announcement = gaRes.reply_text;
            const agentReport = (gaRes.action_payload as any)?.report || `Announcement posted to group.`;

            // 3. Deliver & Record
            await messenger.sendPush(schoolId, school.whatsapp_group_jid, announcement);
            await HistoryManager.recordMessage(schoolId, undefined, school.whatsapp_group_jid, 'GA',
                { type: 'text', body: `[OFFICIAL ANNOUNCEMENT] ${announcement}`, timestamp: Date.now(), source: 'system' },
                { action: 'ANNOUNCE_TO_GROUP', status: 'COMPLETED' });

            return {
                success: true,
                agentFeedback: agentReport,
                summary: 'Announcement posted to group.'
            };

        } catch (error) {
            logger.error({ error }, '❌ Bridge: Group announcement failed');
            return { success: false, agentFeedback: 'Error in GA communication.', summary: 'Internal error during announcement.' };
        }
    }

    /**
     * WAKE UP TA: Notify teachers based on school type
     */
    static async notifyTeachers(
        schoolId: string,
        content: string,
        targetType: 'PRIMARY' | 'SECONDARY' | 'BOTH' | 'ALL',
        adminPhone: string
    ): Promise<WorkReport> {
        try {
            logger.info({ schoolId, targetType }, '👨‍🏫 Bridge: Notifying teachers');

            // 1. Fetch matching teachers
            let sql = `SELECT * FROM users WHERE school_id = ? AND role = 'teacher'`;
            const params: any[] = [schoolId];
            
            if (targetType === 'PRIMARY') { sql += ` AND school_type = 'PRIMARY'`; }
            else if (targetType === 'SECONDARY') { sql += ` AND school_type = 'SECONDARY'`; }

            const teachers: any[] = await new Promise((resolve) => {
                db.getDB().all(sql, params, (err, rows) => resolve(rows || []));
            });

            if (teachers.length === 0) {
                return { success: false, agentFeedback: 'No matching teachers found.', summary: `No ${targetType.toLowerCase()} teachers registered.` };
            }

            const ta = new TeacherAgent();
            const primaryTA = new PrimaryTeacherAgent();
            let primaryCount = 0;
            let secondaryCount = 0;

            // 2. Iterate and notify
            let lastReport = '';
            for (const teacher of teachers) {
                const agent = teacher.school_type === 'PRIMARY' ? primaryTA : ta;
                const ghostMsg = {
                    id: uuidv4(),
                    from: teacher.phone,
                    body: `SYSTEM COMMAND: TEACHER_NOTIFICATION\nContent: ${content}\nTask: Inform the teacher professionally. Provide a formal Work Report.`,
                    context: 'TA',
                    identity: { schoolId, userId: teacher.id, role: 'teacher', name: teacher.name, assignedClass: teacher.assigned_class }
                };

                const taRes = await agent.handle(ghostMsg as any);
                await messenger.sendPush(schoolId, teacher.phone, taRes.reply_text);
                lastReport = (taRes as any).action_payload?.report || 'Notification delivered.';
                
                // 🧠 MEMORY: Record in teacher history
                await HistoryManager.recordMessage(schoolId, teacher.id, teacher.phone, 'TA',
                    { type: 'text', body: `[OFFICIAL NOTIFICATION] ${content}`, timestamp: Date.now(), source: 'system' },
                    { action: 'RECEIVE_NOTIFICATION', status: 'COMPLETED' }
                );

                if (teacher.school_type === 'PRIMARY') primaryCount++; else secondaryCount++;
            }

            return {
                success: true,
                agentFeedback: `Delivered to ${teachers.length} staff. Example: ${lastReport}`,
                summary: `Notified ${teachers.length} teachers.`
            };

        } catch (error) {
            logger.error({ error }, '❌ Bridge: Teacher notification failed');
            return { success: false, agentFeedback: 'Error in TA communication.', summary: 'Internal error during notification.' };
        }
    }
}
