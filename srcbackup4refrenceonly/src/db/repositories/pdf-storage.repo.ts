import { db } from '..';
import { logger } from '../../utils/logger';
import crypto from 'crypto';
import fs from 'fs';

export interface PDFDocumentRecord {
    id: string;
    school_id: string;
    teacher_id?: string;
    document_type: 'attendance' | 'marks_sheet' | 'registration' | 'batch_report_cards' | 'student_report_card' | 'broadsheet';
    file_path: string;
    file_name: string;
    file_size: number;
    status: 'generated' | 'sent' | 'confirmed' | 'rejected';
    sent_to_phone?: string;
    sent_at?: string;
    confirmed_by_teacher?: boolean;
    confirmation_notes?: string;
}

export class PDFStorageRepository {
    /**
     * Store PDF document metadata
     */
    static async storePDFDocument(
        schoolId: string,
        teacherId: string,
        documentType: 'attendance' | 'marks_sheet' | 'registration' | 'batch_report_cards' | 'student_report_card' | 'broadsheet',
        filePath: string,
        fileName: string
    ): Promise<string> {
        const documentId = require('uuid').v4();

        try {
            const stats = fs.statSync(filePath);
            const fileContent = fs.readFileSync(filePath);
            const documentHash = crypto.createHash('sha256').update(fileContent).digest('hex');

            return new Promise((resolve, reject) => {
                db.getDB().run(
                    `INSERT INTO pdf_documents (id, school_id, teacher_id, document_type, file_path, file_name, file_size, document_hash, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generated')`,
                    [documentId, schoolId, teacherId, documentType, filePath, fileName, stats.size, documentHash],
                    (err) => {
                        if (err) {
                            logger.error({ error: err, documentId }, 'Failed to store PDF document metadata');
                            reject(err);
                        } else {
                            logger.info({ documentId, fileName, fileSize: stats.size }, 'PDF document metadata stored');
                            resolve(documentId);
                        }
                    }
                );
            });
        } catch (error) {
            logger.error({ error, filePath }, 'Failed to calculate PDF hash');
            throw error;
        }
    }

    /**
     * Mark PDF as sent to teacher
     */
    static async markPDFAsSent(documentId: string, phoneNumber: string): Promise<void> {
        return new Promise((resolve, reject) => {
            db.getDB().run(
                `UPDATE pdf_documents SET status = 'sent', sent_to_phone = ?, sent_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [phoneNumber, documentId],
                (err) => {
                    if (err) {
                        logger.error({ error: err, documentId }, 'Failed to mark PDF as sent');
                        reject(err);
                    } else {
                        logger.info({ documentId, sentTo: phoneNumber }, 'PDF marked as sent');
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Confirm PDF content (teacher verified it's correct)
     */
    static async confirmPDFContent(documentId: string, notes?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            db.getDB().run(
                `UPDATE pdf_documents SET status = 'confirmed', confirmed_by_teacher = 1, confirmed_at = CURRENT_TIMESTAMP, confirmation_notes = ?
                 WHERE id = ?`,
                [notes || '', documentId],
                (err) => {
                    if (err) {
                        logger.error({ error: err, documentId }, 'Failed to confirm PDF');
                        reject(err);
                    } else {
                        logger.info({ documentId }, 'PDF confirmed by teacher');
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Get PDF document by ID
     */
    static async getPDFDocument(documentId: string): Promise<PDFDocumentRecord | null> {
        return new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT * FROM pdf_documents WHERE id = ?`,
                [documentId],
                (err, row: any) => {
                    if (err) {
                        logger.error({ error: err, documentId }, 'Failed to fetch PDF document');
                        reject(err);
                    } else {
                        resolve(row || null);
                    }
                }
            );
        });
    }

    /**
     * Store marks data entry (with subject info)
     */
    static async createMarksDataEntry(
        schoolId: string,
        teacherId: string,
        subjectId: string,
        subjectName: string,
        classLevel: string,
        termId: string,
        assessmentTotal: number = 20,
        midtermTotal: number = 20,
        examTotal: number = 60
    ): Promise<string> {
        const entryId = require('uuid').v4();

        return new Promise((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO marks_data_entry 
                 (id, school_id, teacher_id, subject_id, subject_name, class_level, term_id, assessment_total, midterm_total, exam_total, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
                [entryId, schoolId, teacherId, subjectId, subjectName, classLevel, termId, assessmentTotal, midtermTotal, examTotal],
                (err) => {
                    if (err) {
                        logger.error({ error: err, entryId }, 'Failed to create marks data entry');
                        reject(err);
                    } else {
                        logger.info({ entryId, subject: subjectName }, 'Marks data entry created');
                        resolve(entryId);
                    }
                }
            );
        });
    }

    /**
     * Add individual student mark
     */
    static async addStudentMark(
        marksDataEntryId: string,
        studentId: string,
        studentName: string,
        ca1: number,
        ca2: number,
        midterm: number,
        exam: number
    ): Promise<string> {
        const markId = require('uuid').v4();

        return new Promise((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO student_mark_entry 
                 (id, marks_data_entry_id, student_id, student_name, ca1, ca2, midterm_score, exam_score, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
                [markId, marksDataEntryId, studentId, studentName, ca1, ca2, midterm, exam],
                (err) => {
                    if (err) {
                        logger.error({ error: err, markId }, 'Failed to add student mark');
                        reject(err);
                    } else {
                        logger.info({ markId, student: studentName }, 'Student mark added');
                        resolve(markId);
                    }
                }
            );
        });
    }

    /**
     * Link marks data entry to PDF document
     */
    static async linkPDFToMarksEntry(marksDataEntryId: string, pdfDocumentId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            db.getDB().run(
                `UPDATE marks_data_entry SET pdf_document_id = ? WHERE id = ?`,
                [pdfDocumentId, marksDataEntryId],
                (err) => {
                    if (err) {
                        logger.error({ error: err, marksDataEntryId }, 'Failed to link PDF to marks entry');
                        reject(err);
                    } else {
                        logger.info({ marksDataEntryId, pdfDocumentId }, 'PDF linked to marks entry');
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Confirm marks entry (finalize all student marks)
     */
    static async confirmMarksEntry(marksDataEntryId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            db.getDB().run(
                `UPDATE marks_data_entry SET status = 'confirmed', submission_date = CURRENT_TIMESTAMP WHERE id = ?`,
                [marksDataEntryId],
                (err) => {
                    if (err) {
                        logger.error({ error: err, marksDataEntryId }, 'Failed to confirm marks entry');
                        reject(err);
                    } else {
                        // Also update all related student marks
                        db.getDB().run(
                            `UPDATE student_mark_entry SET status = 'confirmed' WHERE marks_data_entry_id = ?`,
                            [marksDataEntryId],
                            (err2) => {
                                if (err2) {
                                    logger.error({ error: err2, marksDataEntryId }, 'Failed to confirm student marks');
                                    reject(err2);
                                } else {
                                    logger.info({ marksDataEntryId }, 'Marks entry and all student marks confirmed');
                                    resolve();
                                }
                            }
                        );
                    }
                }
            );
        });
    }
}
