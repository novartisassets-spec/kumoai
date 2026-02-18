import { db } from '../db';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class MarkMigrationService {
    /**
     * Migrates marks from 'student_marks_indexed' to 'student_marks'
     * Called when Admin approves a mark submission workflow.
     */
    static async migrateApprovedMarks(workflowId: string): Promise<number> {
        try {
            logger.info({ workflowId }, '🚀 Starting Mark Migration (Indexed -> Permanent)');

            // 1. Get the submission_id linked to this workflow
            const workflow: any = await new Promise((resolve) => {
                db.getDB().get(
                    `SELECT submission_id, school_id, subject, term_id FROM mark_submission_workflow WHERE id = ?`,
                    [workflowId],
                    (err, row) => resolve(row)
                );
            });

            if (!workflow || !workflow.submission_id) {
                logger.warn({ workflowId }, '⚠️ No submission found for workflow');
                return 0;
            }

            // 2. Fetch all marks from indexed table for this submission
            const indexedMarks: any[] = await new Promise((resolve) => {
                db.getDB().all(
                    `SELECT * FROM student_marks_indexed WHERE submission_id = ?`,
                    [workflow.submission_id],
                    (err, rows) => resolve(rows || [])
                );
            });

            if (indexedMarks.length === 0) {
                logger.warn({ submissionId: workflow.submission_id }, '⚠️ No indexed marks found to migrate');
                return 0;
            }

            // 3. Resolve Subject ID (Admin provides subject name, we need subject ID)
            const subject: any = await new Promise((resolve) => {
                db.getDB().get(
                    `SELECT id FROM subjects WHERE school_id = ? AND (name = ? OR code = ?)`,
                    [workflow.school_id, workflow.subject, workflow.subject],
                    (err, row) => resolve(row)
                );
            });

            if (!subject) {
                throw new Error(`Subject '${workflow.subject}' not found in database for school ${workflow.school_id}`);
            }

            // 4. Batch migrate to student_marks
            let migratedCount = 0;
            const { RemarkGeneratorService } = await import('./remark-generator');

            for (const mark of indexedMarks) {
                // a. Migrate academic marks
                await new Promise<void>((resolve, reject) => {
                    db.getDB().run(
                        `INSERT INTO student_marks 
                        (id, school_id, student_id, subject_id, term_id, ca1_score, ca2_score, midterm_score, exam_score, is_locked)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                        ON CONFLICT(student_id, subject_id, term_id) 
                        DO UPDATE SET 
                            ca1_score = excluded.ca1_score,
                            ca2_score = excluded.ca2_score,
                            midterm_score = excluded.midterm_score,
                            exam_score = excluded.exam_score,
                            is_locked = 1,
                            updated_at = CURRENT_TIMESTAMP`,
                        [
                            uuidv4(), workflow.school_id, mark.student_id, subject.id, workflow.term_id,
                            mark.ca1 || 0, mark.ca2 || 0, mark.midterm || 0, mark.exam || 0
                        ],
                        (err) => err ? reject(err) : resolve()
                    );
                });

                // b. Auto-generate Principal Remark if missing
                let finalPrincipalComment = mark.principal_comment;
                if (!finalPrincipalComment) {
                    finalPrincipalComment = await RemarkGeneratorService.generatePrincipalRemark({
                        name: mark.student_name,
                        scores: {
                            ca1: mark.ca1,
                            ca2: mark.ca2,
                            midterm: mark.midterm,
                            exam: mark.exam
                        },
                        total: (mark.ca1 || 0) + (mark.ca2 || 0) + (mark.midterm || 0) + (mark.exam || 0),
                        subject: mark.subject,
                        classLevel: mark.class_level || 'Unknown'
                    });
                    logger.info({ student: mark.student_name }, '🤖 AI Remark generated for student');
                }

                // c. Migrate holistic data to term_results
                await new Promise<void>((resolve, reject) => {
                    db.getDB().run(
                        `INSERT INTO term_results 
                        (id, school_id, student_id, term_id, class_level, teacher_comment, principal_comment, days_present, days_open)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(student_id, term_id) 
                        DO UPDATE SET 
                            teacher_comment = COALESCE(excluded.teacher_comment, teacher_comment),
                            principal_comment = COALESCE(excluded.principal_comment, principal_comment),
                            days_present = COALESCE(excluded.days_present, days_present),
                            days_open = COALESCE(excluded.days_open, days_open),
                            updated_at = CURRENT_TIMESTAMP`,
                        [
                            uuidv4(), workflow.school_id, mark.student_id, workflow.term_id, workflow.class_level || mark.class_level,
                            mark.teacher_comment, finalPrincipalComment, mark.attendance_present, mark.attendance_total
                        ],
                        (err) => err ? reject(err) : resolve()
                    );
                });
                migratedCount++;
            }

            logger.info({ migratedCount, workflowId }, '✅ Mark Migration Complete');
            return migratedCount;

        } catch (error) {
            logger.error({ error, workflowId }, '❌ Mark Migration Failed');
            throw error;
        }
    }
}
