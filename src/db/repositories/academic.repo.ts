import { db } from '..';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface Subject {
    id: string;
    schoolId: string;
    name: string;
    code?: string;
    aliases: string[];
}

export interface StudentMark {
    id: string;
    studentId: string;
    subjectId: string;
    termId: string;
    marksJson: Record<string, number>;
    total: number;
}

export class AcademicRepository {
    static async getSubjects(schoolId: string): Promise<Subject[]> {
        const sql = `SELECT * FROM subjects WHERE school_id = ?`;
        return new Promise((resolve, reject) => {
            db.getDB().all(sql, [schoolId], (err, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows.map(r => ({
                    id: r.id,
                    schoolId: r.school_id,
                    name: r.name,
                    code: r.code,
                    aliases: JSON.parse(r.aliases || '[]')
                })));
            });
        });
    }

    static async getStudentMarks(studentId: string, termId: string): Promise<StudentMark[]> {
        const sql = `SELECT * FROM student_marks_indexed WHERE student_id = ? AND term_id = ?`;
        return new Promise((resolve, reject) => {
            db.getDB().all(sql, [studentId, termId], (err, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows.map(r => ({
                    id: r.id,
                    studentId: r.student_id,
                    subjectId: r.subject, // Now using subject name/string
                    termId: r.term_id,
                    marksJson: JSON.parse(r.marks_json || '{}'),
                    total: r.total_score
                })));
            });
        });
    }

    static async updateMark(studentId: string, subject: string, termId: string, component: string, value: number, schoolId: string, teacherId: string, studentName: string, classLevel: string): Promise<void> {
        // Fetch existing marks first to merge
        const existing: any = await new Promise((resolve) => {
            db.getDB().get(`SELECT marks_json FROM student_marks_indexed WHERE student_id = ? AND subject = ? AND term_id = ?`, 
                [studentId, subject, termId], (err, row) => {
                    resolve(row);
                });
        });

        const marks = existing ? JSON.parse(existing.marks_json || '{}') : {};
        marks[component] = value;

        // Calculate total
        const total = Object.values(marks).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);

        // Map standard components to columns for SQL analytics
        const updates: string[] = ['marks_json = excluded.marks_json', 'total_score = excluded.total_score', 'updated_at = CURRENT_TIMESTAMP'];
        const params: any[] = [uuidv4(), schoolId, studentId, studentName, teacherId, classLevel, subject, termId, JSON.stringify(marks), total];

        // Helper to check for standard column mapping
        const colMap: Record<string, string> = {
            'ca1': 'ca1', 'ca 1': 'ca1', 'hw': 'ca1', 'assignment': 'ca1',
            'ca2': 'ca2', 'ca 2': 'ca2', 'cw': 'ca2', 'classwork': 'ca2', 'test': 'ca2',
            'midterm': 'midterm', 'mid': 'midterm', 'mid-term': 'midterm',
            'exam': 'exam', 'final': 'exam', 'finals': 'exam'
        };

        // If we can map this component to a standard column, update it
        // Note: For fluid grading, we mainly rely on JSON, but filling columns helps legacy queries
        const targetCol = colMap[component.toLowerCase()] || colMap[component.replace(/[^a-z0-9]/gi, '').toLowerCase()];
        
        let insertCols = `(id, school_id, student_id, student_name, teacher_id, class_level, subject, term_id, marks_json, total_score, confirmed_by_teacher`;
        let insertVals = `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1`;

        if (targetCol) {
            insertCols += `, ${targetCol}`;
            insertVals += `, ?`;
            updates.push(`${targetCol} = excluded.${targetCol}`);
            params.push(value);
        }

        insertCols += `)`;
        insertVals += `)`;

        const sql = `
            INSERT INTO student_marks_indexed ${insertCols}
            ${insertVals}
            ON CONFLICT(school_id, student_id, subject, term_id) 
            DO UPDATE SET ${updates.join(', ')}
        `;
        
        return new Promise((resolve, reject) => {
            db.getDB().run(sql, params, function(err) {
                if (err) {
                    logger.error({ err, studentId, subject }, '❌ updateMark failed');
                    reject(err);
                } else {
                    logger.info({ studentId, subject, total, changes: this.changes }, '✅ updateMark successful');
                    resolve();
                }
            });
        });
    }

    static async getClassMarks(schoolId: string, termId: string, classLevel: string): Promise<any[]> {
        const sql = `
            SELECT student_id, student_name, subject, total_score 
            FROM student_marks_indexed
            WHERE school_id = ? AND class_level = ? AND term_id = ?
        `;
        return new Promise((resolve, reject) => {
            db.getDB().all(sql, [schoolId, classLevel, termId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    static async isResultLocked(studentId: string, termId: string): Promise<boolean> {
        const sql = `SELECT status FROM term_results WHERE student_id = ? AND term_id = ?`;
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, [studentId, termId], (err, row: any) => {
                if (err) reject(err);
                else resolve(row?.status === 'locked');
            });
        });
    }

    static async isResultReleased(studentId: string, termId: string): Promise<boolean> {
        const sql = `SELECT status FROM term_results WHERE student_id = ? AND term_id = ?`;
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, [studentId, termId], (err, row: any) => {
                if (err) reject(err);
                else resolve(row?.status === 'released' || row?.status === 'locked');
            });
        });
    }

    static async getResultStatus(studentId: string, termId: string): Promise<'draft' | 'locked' | 'released' | null> {
        const sql = `SELECT status FROM term_results WHERE student_id = ? AND term_id = ?`;
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, [studentId, termId], (err, row: any) => {
                if (err) reject(err);
                else resolve(row?.status || null);
            });
        });
    }

    static async saveTermResult(studentId: string, termId: string, schoolId: string, classLevel: string, total: number, average: number, position: number, totalStudents: number): Promise<void> {
        const sql = `
            INSERT INTO term_results (id, school_id, student_id, term_id, class_level, total_score, average_score, position, total_students)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id, term_id)
            DO UPDATE SET total_score=excluded.total_score, average_score=excluded.average_score, position=excluded.position, total_students=excluded.total_students
        `;
        return new Promise((resolve, reject) => {
             db.getDB().run(sql, [uuidv4(), schoolId, studentId, termId, classLevel, total, average, position, totalStudents], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}
