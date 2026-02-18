import { db } from '../db';
import { logger } from '../utils/logger';
import { pdfGenerator } from './pdf-generator';
import { aiProvider } from '../ai/provider';
import { SA_TA_CONFIG } from '../ai/config';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

export interface ReportGenerationOptions {
    schoolId: string;
    classLevel: string;
    termId: string;
    workflowId?: string; // Optional link to existing workflow
    generateRemarks?: boolean;
    includeSignature?: boolean;
    generatedBy: string;
}

export class ReportService {
    /**
     * Proactively generate batch report cards for a class
     */
    static async generateBatchReports(options: ReportGenerationOptions): Promise<any> {
        const { schoolId, classLevel, termId, workflowId, generateRemarks, generatedBy } = options;
        
        logger.info({ schoolId, classLevel, termId, workflowId }, '🚀 [REPORT_SERVICE] Starting proactive batch report generation');

        try {
            const school: any = await new Promise((resolve) => {
                db.getDB().get(`SELECT name, school_type, grading_config, config_json FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
            });

            if (!school) throw new Error('School not found');
            
            let gradingConfig = JSON.parse(school.grading_config || '{}');
            
            // 🚨 MANDATORY: Admin must define custom grading pillars during setup
            // NO FALLBACKS - Each school has unique pillars
            if (!gradingConfig.pillars || gradingConfig.pillars.length === 0) {
                logger.error({ schoolId, schoolType: school.school_type }, '❌❌❌ CRITICAL: Cannot generate reports - no grading_config found!');
                throw new Error(
                    `School ${schoolId} has no grading configuration. ` +
                    `Admin MUST define custom grading pillars during setup. ` +
                    `Reports cannot be generated without custom pillars.`
                );
            }

            const pillars = gradingConfig.pillars || [];
            const showPosition = gradingConfig.rank_students !== false;

            // 1. Fetch ALL marks for this class/term to calculate relative positions
            const allRows: any[] = await new Promise((resolve) => {
                db.getDB().all(
                    `SELECT * FROM student_marks_indexed 
                     WHERE school_id = ? AND class_level = ? AND term_id = ? AND confirmed_by_teacher = 1`,
                    [schoolId, classLevel, termId],
                    (err, rows) => resolve(rows || [])
                );
            });

            logger.info({ rowCount: allRows.length, classLevel }, '📊 [REPORT_SERVICE] Rows fetched from DB');

            if (allRows.length === 0) {
                logger.warn({ classLevel }, '⚠️ No marks found for class, cannot generate reports');
                return null;
            }

            // 2. Group data by Student and by Subject
            const studentMap: Record<string, any> = {};
            const subjectMap: Record<string, any[]> = {};
            const distinctSubjects = new Set<string>();

            for (const r of allRows) {
                distinctSubjects.add(r.subject);
                if (!studentMap[r.student_id]) {
                    studentMap[r.student_id] = {
                        student_name: r.student_name,
                        student_id: r.student_id,
                        class_level: r.class_level,
                        term: r.term_id,
                        marks: [],
                        total_aggregate: 0,
                        subject_count: 0,
                        days_present: 0,
                        days_open: 0
                    };
                }
                
                const marksJson = JSON.parse(r.marks_json || '{}');
                const totalScore = Number(r.total_score) || 0; // ✅ Ensure numeric
                
                const markEntry = {
                    subject: r.subject,
                    total: totalScore,
                    ...marksJson
                };
                studentMap[r.student_id].marks.push(markEntry);
                studentMap[r.student_id].total_aggregate += totalScore;
                studentMap[r.student_id].subject_count++;

                if (!subjectMap[r.subject]) subjectMap[r.subject] = [];
                subjectMap[r.subject].push({ student_id: r.student_id, total: totalScore });
            }

            // 3. Calculate Subject Positions
            for (const subject in subjectMap) {
                subjectMap[subject].sort((a, b) => b.total - a.total);
                subjectMap[subject].forEach((entry, index) => {
                    const student = studentMap[entry.student_id];
                    const mark = student.marks.find((m: any) => m.subject === subject);
                    if (mark) mark.subject_position = ReportService.ordinal(index + 1);
                });
            }

            // 3.5 Fetch Attendance Data
            const attendanceRows: any[] = await new Promise((resolve) => {
                db.getDB().all(
                    `SELECT student_id, SUM(present) as present_count, COUNT(DISTINCT marked_date) as total_days 
                     FROM student_attendance_records 
                     WHERE school_id = ? AND class_level = ? AND term_id = ?
                     GROUP BY student_id`,
                    [schoolId, classLevel, termId],
                    (err, rows) => resolve(rows || [])
                );
            });

            // Get total days open for the class
            const daysOpenRow: any = await new Promise((resolve) => {
                db.getDB().get(
                    `SELECT COUNT(DISTINCT marked_date) as class_days FROM student_attendance_records 
                     WHERE school_id = ? AND class_level = ? AND term_id = ?`,
                    [schoolId, classLevel, termId],
                    (err, row) => resolve(row)
                );
            });
            const classDaysOpen = daysOpenRow?.class_days || 0;

            for (const att of attendanceRows) {
                if (studentMap[att.student_id]) {
                    studentMap[att.student_id].days_present = att.present_count;
                    studentMap[att.student_id].days_open = classDaysOpen;
                }
            }

            // 4. Calculate Class Positions & Sort Students
            const students = Object.values(studentMap);
            students.sort((a: any, b: any) => b.total_aggregate - a.total_aggregate);
            
            students.forEach((s: any, idx: number) => {
                s.average = s.subject_count > 0 ? (s.total_aggregate / s.subject_count).toFixed(1) : '0.0';
                s.position = ReportService.ordinal(idx + 1);
                s.total_students = students.length;
                s.show_position = showPosition;
                s.pillars = pillars;
            });

            logger.info({ studentCount: students.length, subjects: Array.from(distinctSubjects) }, '📦 [REPORT_SERVICE] Data assembly complete');

            // 5. Synthesize Remarks (Optional)
            if (generateRemarks) {
                logger.info({ count: students.length }, '🧠 [REPORT_SERVICE] Synthesizing intelligent remarks');
                for (const student of students) {
                    const remark = await this.synthesizeRemark(student, pillars);
                    student.teacher_remark = remark;

                    // 💾 Persist synthesis to DB (including attendance)
                    await new Promise<void>((resolve) => {
                        db.getDB().run(
                            `INSERT OR REPLACE INTO terminal_reports 
                             (id, school_id, student_id, class_level, term_id, total_aggregate, average_score, teacher_remarks, days_present, days_open, status, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RELEASED', CURRENT_TIMESTAMP)`,
                            [uuidv4(), schoolId, student.student_id, classLevel, termId, student.total_aggregate, Number(student.average), remark, student.days_present || 0, student.days_open || 0],
                            () => resolve()
                        );
                    });
                }
            }

            // 6. Generate the PDF
            const pdfResult = await pdfGenerator.generatePDF({
                schoolId,
                schoolName: school.name,
                templateType: 'batch_report_cards',
                templateData: {
                    class_level: classLevel,
                    term: termId,
                    students: students
                },
                timestamp: Date.now(),
                generatedBy
            });

            // Persist to Storage
            const { PDFStorageRepository } = await import('../db/repositories/pdf-storage.repo');
            const docId = await PDFStorageRepository.storePDFDocument(
                schoolId,
                generatedBy || 'SYSTEM',
                'batch_report_cards', 
                pdfResult.filePath,
                pdfResult.fileName
            );

            return {
                documentId: docId,
                filePath: pdfResult.filePath,
                studentCount: students.length
            };

        } catch (error) {
            logger.error({ error }, '❌ [REPORT_SERVICE] Failed to generate proactive reports');
            throw error;
        }
    }

    /**
     * Generate Class Broadsheet (Landscape Summary)
     */
    static async generateBroadsheet(options: ReportGenerationOptions): Promise<any> {
        const { schoolId, classLevel, termId, generatedBy } = options;
        
        logger.info({ schoolId, classLevel, termId }, '📊 [REPORT_SERVICE] Generating Class Broadsheet');

        try {
            const school: any = await new Promise((resolve) => {
                db.getDB().get(`SELECT name, school_type, grading_config FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
            });

            if (!school) throw new Error('School not found');
            
            let gradingConfig = JSON.parse(school.grading_config || '{}');

            // ✅ FALLBACK: If no config, use standard defaults
            if (!gradingConfig.pillars) {
                if (school.school_type === 'PRIMARY') {
                    gradingConfig = {
                        pillars: [
                            { id: 'ca1', name: 'CA 1', max_score: 20 },
                            { id: 'ca2', name: 'CA 2', max_score: 20 },
                            { id: 'exam', name: 'Exam', max_score: 60 }
                        ]
                    };
                } else {
                    gradingConfig = {
                        pillars: [
                            { id: 'ca1', name: 'CA 1', max_score: 10 },
                            { id: 'ca2', name: 'CA 2', max_score: 10 },
                            { id: 'midterm', name: 'Midterm', max_score: 20 },
                            { id: 'exam', name: 'Exam', max_score: 60 }
                        ]
                    };
                }
            }

            const pillars = gradingConfig.pillars || [];

            const allRows: any[] = await new Promise((resolve) => {
                db.getDB().all(
                    `SELECT * FROM student_marks_indexed 
                     WHERE school_id = ? AND class_level = ? AND term_id = ? AND confirmed_by_teacher = 1`,
                    [schoolId, classLevel, termId],
                    (err, rows) => resolve(rows || [])
                );
            });

            if (allRows.length === 0) {
                logger.warn({ classLevel }, '⚠️ No confirmed marks for broadsheet');
                return null;
            }

            const studentMap: Record<string, any> = {};
            const subjectSet = new Set<string>();

            for (const r of allRows) {
                subjectSet.add(r.subject);
                if (!studentMap[r.student_id]) {
                    studentMap[r.student_id] = {
                        student_name: r.student_name,
                        student_id: r.student_id,
                        marks: {}, // Keyed by subject
                        total_aggregate: 0,
                        subject_count: 0
                    };
                }
                
                const marksJson = JSON.parse(r.marks_json || '{}');
                const totalScore = Number(r.total_score) || 0; // ✅ Ensure numeric

                studentMap[r.student_id].marks[r.subject] = {
                    total: totalScore,
                    pillars: marksJson
                };
                studentMap[r.student_id].total_aggregate += totalScore;
                studentMap[r.student_id].subject_count++;
            }

            const students = Object.values(studentMap);
            students.sort((a: any, b: any) => b.total_aggregate - a.total_aggregate);
            
            students.forEach((s: any, idx: number) => {
                s.position = ReportService.ordinal(idx + 1);
                // Accuracy: Use fixed decimal for average
                s.average = s.subject_count > 0 ? (s.total_aggregate / s.subject_count).toFixed(1) : '0.0';
            });

            const distinctSubjects = Array.from(subjectSet);

            const pdfResult = await pdfGenerator.generatePDF({
                schoolId,
                schoolName: school.name,
                templateType: 'broadsheet',
                templateData: {
                    class_level: classLevel,
                    term: termId,
                    subjects: distinctSubjects,
                    pillars: pillars, // Include pillars for column sub-division
                    students: students
                },
                timestamp: Date.now(),
                generatedBy,
                orientation: 'landscape'
            });

            const { PDFStorageRepository } = await import('../db/repositories/pdf-storage.repo');
            const docId = await PDFStorageRepository.storePDFDocument(
                schoolId,
                generatedBy,
                'broadsheet', 
                pdfResult.filePath,
                pdfResult.fileName
            );

            return { documentId: docId, filePath: pdfResult.filePath };

        } catch (error) {
            logger.error({ error }, '❌ [REPORT_SERVICE] Broadsheet generation failed');
            throw error;
        }
    }

    /**
     * Use LLM to generate a personalized pedagogical remark
     */
    private static async synthesizeRemark(student: any, pillars: any[]): Promise<string> {
        try {
            const performanceSummary = student.marks.map((m: any) => 
                `${m.subject}: ${m.total}% (Pillars: ${JSON.stringify(m)})`
            ).join('\n');

            const prompt = `
You are a senior academic supervisor. Write a concise, personalized, and encouraging pedagogical remark for a student based on their terminal performance.
STUDENT: ${student.student_name}
PERFORMANCE:
${performanceSummary}

GRADING PILLARS: ${JSON.stringify(pillars)}

TASK: 
- Summarize their strengths.
- Gently note areas for improvement if scores are low in specific pillars (e.g. poor homework but good exams).
- Sound like a human teacher who cares, not an AI.
- Keep it under 3 sentences.
`;

            const res = await aiProvider.generateText(SA_TA_CONFIG, prompt);
            return res.text.trim();
        } catch (e) {
            return "Good performance this term. Keep up the hard work.";
        }
    }

    private static ordinal(n: number): string {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    /**
     * Get released results for a single student (Parent Access)
     */
    static async getStudentReleasedResult(studentId: string, termId: string): Promise<any | null> {
        logger.info({ studentId, termId }, '🔍 [REPORT_SERVICE] Fetching released result for student');
        
        try {
            const rows: any[] = await new Promise((resolve) => {
                db.getDB().all(
                    `SELECT * FROM student_marks_indexed 
                     WHERE student_id = ? AND term_id = ? AND (status = 'RELEASED' OR status = 'CONFIRMED')`,
                    [studentId, termId],
                    (err, rows) => resolve(rows || [])
                );
            });

        if (rows.length === 0) return null;

        const first = rows[0];
        const studentData: any = {
            student_name: first.student_name,
            student_id: first.student_id,
            class_level: first.class_level,
            term: first.term_id,
            total_aggregate: 0,
            subject_count: 0,
            marks: [] as any[]
        };

        rows.forEach(r => {
            const marksJson = JSON.parse(r.marks_json || '{}');
            studentData.marks.push({
                subject: r.subject,
                total: r.total_score,
                ...marksJson
            });
            studentData.total_aggregate += r.total_score;
            studentData.subject_count++;
        });

        studentData.average = (studentData.total_aggregate / studentData.subject_count).toFixed(1);

        // Fetch position from aggregated term_results if available
        const aggregate: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT position, total_students, average_score, teacher_remarks 
                 FROM terminal_reports WHERE student_id = ? AND term_id = ?`,
                [studentId, termId],
                (err, row) => resolve(row)
            );
        });

        // Fetch attendance data
        const schoolId = first.school_id;
        const classLevel = first.class_level;
        const attendance: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT SUM(present) as present_count, COUNT(DISTINCT marked_date) as total_days
                 FROM student_attendance_records 
                 WHERE school_id = ? AND student_id = ? AND term_id = ?`,
                [schoolId, studentId, termId],
                (err, row) => resolve(row)
            );
        });

        const classDays: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT COUNT(DISTINCT marked_date) as class_days
                 FROM student_attendance_records 
                 WHERE school_id = ? AND class_level = ? AND term_id = ?`,
                [schoolId, classLevel, termId],
                (err, row) => resolve(row)
            );
        });

        return {
            ...studentData,
            position: aggregate?.position || 'N/A',
            total_students: aggregate?.total_students || 'N/A',
            teacher_remark: aggregate?.teacher_remarks || 'No remark provided.',
            days_present: attendance?.present_count || 0,
            days_open: classDays?.class_days || 0,
            show_position: true
        };
        } catch (error) {
            logger.error({ error, studentId }, '❌ Failed to fetch released result');
            return null;
        }
    }
}
