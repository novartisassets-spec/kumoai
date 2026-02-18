import { db } from '..';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface SubmissionMark {
    id: string;
    submissionId: string;
    studentId: string;
    ca1?: number;
    ca2?: number;
    midterm?: number;
    exam?: number;
    total?: number;
    status: 'DRAFT' | 'CONFIRMED' | 'CORRECTED';
}

export interface MarkSubmission {
    id: string;
    schoolId: string;
    teacherId: string;
    subjectId: string;
    classLevel: string;
    termId: string;
    status: 'DRAFT' | 'PENDING_TEACHER_CONFIRMATION' | 'CONFIRMED' | 'REJECTED';
    rawImagePath?: string;
}

export class MarkSubmissionRepository {
    
    static async createSubmission(
        schoolId: string,
        teacherId: string,
        subjectId: string,
        classLevel: string,
        termId: string,
        rawImagePath?: string
    ): Promise<string> {
        const id = uuidv4();
        const sql = `
            INSERT INTO mark_submissions (id, school_id, teacher_id, subject_id, class_level, term_id, raw_image_path, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT')
        `;
        
        return new Promise((resolve, reject) => {
            db.getDB().run(sql, [id, schoolId, teacherId, subjectId, classLevel, termId, rawImagePath || null], (err) => {
                if (err) {
                    logger.error({ error: err, schoolId, teacherId }, 'Failed to create submission');
                    reject(err);
                } else {
                    logger.info({ submissionId: id }, 'Mark submission created');
                    resolve(id);
                }
            });
        });
    }

    static async addMarkToSubmission(
        submissionId: string,
        studentId: string,
        ca1?: number,
        ca2?: number,
        midterm?: number,
        exam?: number
    ): Promise<string> {
        const id = uuidv4();
        const total = (ca1 || 0) + (ca2 || 0) + (midterm || 0) + (exam || 0);
        const sql = `
            INSERT INTO submission_marks (id, submission_id, student_id, ca1, ca2, midterm, exam, total, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')
        `;
        
        return new Promise((resolve, reject) => {
            db.getDB().run(sql, [id, submissionId, studentId, ca1 || null, ca2 || null, midterm || null, exam || null, total], (err) => {
                if (err) {
                    logger.error({ error: err, submissionId, studentId }, 'Failed to add mark to submission');
                    reject(err);
                } else {
                    logger.info({ markId: id, submissionId }, 'Mark added to submission');
                    resolve(id);
                }
            });
        });
    }

    static async getSubmissionMarks(submissionId: string): Promise<SubmissionMark[]> {
        const sql = `SELECT * FROM submission_marks WHERE submission_id = ?`;
        
        return new Promise((resolve, reject) => {
            db.getDB().all(sql, [submissionId], (err, rows: any[]) => {
                if (err) {
                    logger.error({ error: err, submissionId }, 'Failed to fetch submission marks');
                    reject(err);
                } else {
                    resolve(rows.map(r => ({
                        id: r.id,
                        submissionId: r.submission_id,
                        studentId: r.student_id,
                        ca1: r.ca1,
                        ca2: r.ca2,
                        midterm: r.midterm,
                        exam: r.exam,
                        total: r.total,
                        status: r.status
                    })));
                }
            });
        });
    }

    static async confirmSubmission(submissionId: string, teacherId: string): Promise<void> {
        const sql = `UPDATE mark_submissions SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        const teacherAuditSql = `INSERT INTO teacher_confirmation_logs (submission_id, teacher_id, action, details) VALUES (?, ?, 'CONFIRMED', ?)`;
        const auditLogSql = `INSERT INTO audit_logs (actor_phone, action, target_resource, details) VALUES (?, 'CONFIRM_MARKS', ?, ?)`;
        
        return new Promise((resolve, reject) => {
            db.getDB().serialize(() => {
                db.getDB().run(sql, [submissionId], (err) => {
                    if (err) {
                        logger.error({ error: err, submissionId }, 'Failed to confirm submission');
                        reject(err);
                    }
                });
                db.getDB().run(teacherAuditSql, [submissionId, teacherId, JSON.stringify({ confirmed_at: new Date().toISOString() })], (err) => {
                    if (err) {
                        logger.error({ error: err, submissionId }, 'Failed to log teacher confirmation');
                        reject(err);
                    }
                });
                db.getDB().run(auditLogSql, [teacherId, `mark_submission:${submissionId}`, JSON.stringify({ action: 'CONFIRMED', submission_id: submissionId })], (err) => {
                    if (err) {
                        logger.error({ error: err, submissionId }, 'Failed to log to audit_logs');
                        reject(err);
                    } else {
                        logger.info({ submissionId, teacherId }, 'Submission confirmed by teacher with audit trail');
                        resolve();
                    }
                });
            });
        });
    }

    static async rejectSubmission(submissionId: string, teacherId: string, reason: string): Promise<void> {
        const sql = `UPDATE mark_submissions SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        const teacherAuditSql = `INSERT INTO teacher_confirmation_logs (submission_id, teacher_id, action, details) VALUES (?, ?, 'REJECTED', ?)`;
        const auditLogSql = `INSERT INTO audit_logs (actor_phone, action, target_resource, details) VALUES (?, 'REJECT_MARKS', ?, ?)`;
        
        return new Promise((resolve, reject) => {
            db.getDB().serialize(() => {
                db.getDB().run(sql, [submissionId], (err) => {
                    if (err) {
                        logger.error({ error: err, submissionId }, 'Failed to reject submission');
                        reject(err);
                    }
                });
                db.getDB().run(teacherAuditSql, [submissionId, teacherId, JSON.stringify({ rejection_reason: reason })], (err) => {
                    if (err) {
                        logger.error({ error: err, submissionId }, 'Failed to log teacher rejection');
                        reject(err);
                    }
                });
                db.getDB().run(auditLogSql, [teacherId, `mark_submission:${submissionId}`, JSON.stringify({ action: 'REJECTED', reason, submission_id: submissionId })], (err) => {
                    if (err) {
                        logger.error({ error: err, submissionId }, 'Failed to log to audit_logs');
                        reject(err);
                    } else {
                        logger.info({ submissionId, teacherId, reason }, 'Submission rejected by teacher with audit trail');
                        resolve();
                    }
                });
            });
        });
    }

    static async updateMarkStatus(markId: string, status: 'DRAFT' | 'CONFIRMED' | 'CORRECTED'): Promise<void> {
        const sql = `UPDATE submission_marks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        
        return new Promise((resolve, reject) => {
            db.getDB().run(sql, [status, markId], (err) => {
                if (err) {
                    logger.error({ error: err, markId }, 'Failed to update mark status');
                    reject(err);
                } else {
                    logger.info({ markId, newStatus: status }, 'Mark status updated');
                    resolve();
                }
            });
        });
    }

    static async getSubmissionById(submissionId: string): Promise<MarkSubmission | null> {
        const sql = `SELECT * FROM mark_submissions WHERE id = ?`;
        
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, [submissionId], (err, row: any) => {
                if (err) {
                    logger.error({ error: err, submissionId }, 'Failed to fetch submission');
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve({
                        id: row.id,
                        schoolId: row.school_id,
                        teacherId: row.teacher_id,
                        subjectId: row.subject_id,
                        classLevel: row.class_level,
                        termId: row.term_id,
                        status: row.status,
                        rawImagePath: row.raw_image_path
                    });
                }
            });
        });
    }

    static async getPendingSubmissionsForTeacher(teacherId: string): Promise<MarkSubmission[]> {
        const sql = `
            SELECT * FROM mark_submissions 
            WHERE teacher_id = ? AND status IN ('DRAFT', 'PENDING_TEACHER_CONFIRMATION')
            ORDER BY created_at DESC
        `;
        
        return new Promise((resolve, reject) => {
            db.getDB().all(sql, [teacherId], (err, rows: any[]) => {
                if (err) {
                    logger.error({ error: err, teacherId }, 'Failed to fetch pending submissions');
                    reject(err);
                } else {
                    resolve(rows.map(r => ({
                        id: r.id,
                        schoolId: r.school_id,
                        teacherId: r.teacher_id,
                        subjectId: r.subject_id,
                        classLevel: r.class_level,
                        termId: r.term_id,
                        status: r.status,
                        rawImagePath: r.raw_image_path
                    })));
                }
            });
        });
    }
}
