import { db } from '../db';
import { logger } from '../utils/logger';
import { TASetupRepository } from '../db/repositories/ta-setup.repo';

export interface SubjectStatus {
    subject: string;
    class_level: string;
    status: 'MISSING' | 'DRAFT' | 'COMPLETED';
    expected_students: number;
    observed_students: number;
    missing_students: string[];
}

export interface TeacherWorkload {
    teacher_id: string;
    school_id: string;
    classes: Record<string, string[]>; // e.g. { "Primary 3": ["Math", "English"] }
}

export class WorkloadService {
    /**
     * Fetch the master list of subjects for a school
     */
    static async getSchoolSubjectsUniverse(schoolId: string): Promise<string[]> {
        const row: any = await new Promise((resolve) => {
            db.getDB().get(`SELECT subjects_json FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
        });
        try {
            return JSON.parse(row?.subjects_json || '[]');
        } catch (e) {
            return [];
        }
    }

    /**
     * Intelligently resolve a subject name against the school's universe
     * Prevents fragmentation (e.g., "Maths" vs "Mathematics")
     */
    static async resolveSubjectName(schoolId: string, inputName: string): Promise<{ resolved: string; is_new: boolean }> {
        const universe = await this.getSchoolSubjectsUniverse(schoolId);
        if (universe.length === 0) return { resolved: inputName, is_new: true };

        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        const normalizedInput = normalize(inputName);

        // 1. Exact or Normalized Match
        const match = universe.find(s => normalize(s) === normalizedInput);
        if (match) return { resolved: match, is_new: false };

        // 2. Fuzzy/Partial Match
        const fuzzyMatch = universe.find(s => {
            const normU = normalize(s);
            return normU.includes(normalizedInput) || normalizedInput.includes(normU);
        });

        if (fuzzyMatch) {
            logger.info({ inputName, resolvedTo: fuzzyMatch }, '🎯 [WORKLOAD] Fuzzy matched subject name');
            return { resolved: fuzzyMatch, is_new: false };
        }

        // 3. Brand New Subject
        return { resolved: inputName, is_new: true };
    }

    /**
     * Get the full workload and current progress for a teacher
     */
    static async getTeacherWorkloadStatus(teacherId: string, schoolId: string, termId: string): Promise<SubjectStatus[]> {
        // 1. Get declared workload from setup state
        const setup: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT workload_json FROM ta_setup_state WHERE teacher_id = ? AND school_id = ?`,
                [teacherId, schoolId],
                (err, row) => resolve(row)
            );
        });

        if (!setup || !setup.workload_json) return [];

        const workload = JSON.parse(setup.workload_json || '{}');
        const statusReport: SubjectStatus[] = [];

        // 2. Cross-reference with Drafts and Final Marks
        for (const [classLevel, subjects] of Object.entries(workload)) {
            const subjectList = Array.isArray(subjects) ? subjects : [];
            
            // ✅ FIX: Use the operational source of truth (students table)
            const classRoster = await TASetupRepository.getClassStudents(teacherId, schoolId, classLevel, termId);
            
            for (const subject of subjectList) {
                // Check if completed (all students have marks for this subject in final table)
                const finalMarks: any[] = await new Promise((resolve) => {
                    db.getDB().all(
                        `SELECT student_id FROM student_marks_indexed 
                         WHERE school_id = ? AND teacher_id = ? AND class_level = ? AND subject = ? AND term_id = ?`,
                        [schoolId, teacherId, classLevel, subject, termId],
                        (err, rows) => resolve(rows || [])
                    );
                });

                if (finalMarks.length >= classRoster.length && classRoster.length > 0) {
                    statusReport.push({
                        subject,
                        class_level: classLevel,
                        status: 'COMPLETED',
                        expected_students: classRoster.length,
                        observed_students: finalMarks.length,
                        missing_students: []
                    });
                    continue;
                }

                // Check for Drafts
                const draft: any = await new Promise((resolve) => {
                    db.getDB().get(
                        `SELECT marks_json, observed_students_json FROM academic_drafts 
                         WHERE teacher_id = ? AND subject = ? AND class_level = ? AND term_id = ?`,
                        [teacherId, subject, classLevel, termId],
                        (err, row) => resolve(row)
                    );
                });

                if (draft) {
                    const observedStudents = JSON.parse(draft.observed_students_json || '[]');
                    const observedIds = new Set(observedStudents.map((s: any) => s.id));
                    const missing = classRoster
                        .filter(s => !observedIds.has(s.student_id)) // Use student_id from roster
                        .map(s => s.student_name);

                    statusReport.push({
                        subject,
                        class_level: classLevel,
                        status: 'DRAFT',
                        expected_students: classRoster.length,
                        observed_students: observedIds.size,
                        missing_students: missing
                    });
                } else {
                    statusReport.push({
                        subject,
                        class_level: classLevel,
                        status: 'MISSING',
                        expected_students: classRoster.length,
                        observed_students: 0,
                        missing_students: classRoster.map(s => s.student_name)
                    });
                }
            }
        }

        return statusReport;
    }

    /**
     * Get a summary of what's missing for conversational prompts
     */
    static async getMissingWorkloadSummary(teacherId: string, schoolId: string, termId: string): Promise<string> {
        const statuses = await this.getTeacherWorkloadStatus(teacherId, schoolId, termId);
        
        const missing = statuses.filter(s => s.status === 'MISSING');
        const drafts = statuses.filter(s => s.status === 'DRAFT');

        if (missing.length === 0 && drafts.length === 0) return "All your subjects are up to date! Well done.";

        let summary = "Here is your progress:\n";
        
        if (drafts.length > 0) {
            summary += "\n📝 *Drafts needing more data:*\n";
            drafts.forEach(d => {
                summary += `- ${d.subject} (${d.class_level}): ${d.observed_students}/${d.expected_students} students done. Missing: ${d.missing_students.slice(0, 3).join(', ')}${d.missing_students.length > 3 ? '...' : ''}\n`;
            });
        }

        if (missing.length > 0) {
            summary += "\n❌ *Subjects not yet started:*\n";
            missing.forEach(m => {
                summary += `- ${m.subject} (${m.class_level})\n`;
            });
        }

        return summary;
    }

    /**
     * Check if a specific class is academically ready (All subjects confirmed)
     */
    static async isClassAcademicReady(schoolId: string, classLevel: string, termId: string): Promise<{ ready: boolean; confirmed_subjects: string[]; missing_subjects: string[] }> {
        // 1. Get ALL declared subjects for this class across all teachers
        const teachers: any[] = await new Promise((resolve) => {
            db.getDB().all(
                `SELECT teacher_id, workload_json FROM ta_setup_state WHERE school_id = ? AND is_active = 0`,
                [schoolId],
                (err, rows) => resolve(rows || [])
            );
        });

        const expectedSubjects = new Set<string>();
        teachers.forEach(t => {
            const workload = JSON.parse(t.workload_json || '{}');
            if (workload[classLevel]) {
                const subjects = Array.isArray(workload[classLevel]) ? workload[classLevel] : [];
                subjects.forEach((s: string) => expectedSubjects.add(s));
            }
        });

        if (expectedSubjects.size === 0) return { ready: false, confirmed_subjects: [], missing_subjects: [] };

        // 2. Check which of these subjects are fully confirmed in student_marks_indexed
        const confirmedRows: any[] = await new Promise((resolve) => {
            db.getDB().all(
                `SELECT DISTINCT subject FROM student_marks_indexed 
                 WHERE school_id = ? AND class_level = ? AND term_id = ? AND confirmed_by_teacher = 1`,
                [schoolId, classLevel, termId],
                (err, rows) => resolve(rows || [])
            );
        });

        const confirmedSubjects = confirmedRows.map(r => r.subject);
        const missingSubjects = Array.from(expectedSubjects).filter(s => !confirmedSubjects.includes(s));

        return {
            ready: missingSubjects.length === 0,
            confirmed_subjects: confirmedSubjects,
            missing_subjects: missingSubjects
        };
    }
}
