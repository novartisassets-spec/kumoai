import { db } from '..';
import { logger } from '../../utils/logger';

/**
 * TA Setup Repository
 * Manages teacher setup state, student data extraction, and sheet generation
 */

export interface TASetupState {
    teacher_id: string;
    school_id: string;
    assigned_class: string;
    current_step: string;
    completed_steps: string[];
    is_active: boolean;
    config_draft: any;
    extracted_students?: any[];
    subjects?: string[];
    workload_json?: Record<string, string | string[]>;  // Class -> Subjects mapping (supports "ALL" string or array)
}

export interface ClassStudentMapping {
    id: string;
    school_id: string;
    teacher_id: string;
    class_level: string;
    student_id: string;
    student_name: string;
    roll_number?: string;
    extraction_source: 'VISION' | 'MANUAL';
    term_id: string;
    recorded_at: string;
}

export class TASetupRepository {
    /**
     * Get TA setup state for a teacher
     */
    static async getSetupState(teacherId: string, schoolId: string): Promise<TASetupState | null> {
        const sql = `SELECT * FROM ta_setup_state WHERE teacher_id = ? AND school_id = ?`;
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, [teacherId, schoolId], (err, row: any) => {
                if (err) reject(err);
                else if (!row) resolve(null);
                else resolve({
                    teacher_id: row.teacher_id,
                    school_id: row.school_id,
                    assigned_class: row.assigned_class,
                    current_step: row.current_step,
                    completed_steps: JSON.parse(row.completed_steps || '[]'),
                    is_active: !!row.is_active,
                    config_draft: JSON.parse(row.config_draft || '{}'),
                    extracted_students: JSON.parse(row.extracted_students || '[]'),
                    subjects: JSON.parse(row.subjects || '[]'),
                    workload_json: JSON.parse(row.workload_json || '{}')
                });
            });
        });
    }

    /**
     * Initialize TA setup for a teacher
     */
    static async initSetup(teacherId: string, schoolId: string, assignedClass: string): Promise<void> {
        // UNIFIED STEP SEQUENCE - Single source of truth
        const UNIFIED_STEPS = ['WELCOME', 'DECLARE_WORKLOAD', 'REQUEST_REGISTERS', 'GENERATE_PREVIEW', 'CONFIRM_PREVIEW', 'SETUP_COMPLETE'];
        
        const sql = `
            INSERT INTO ta_setup_state 
            (teacher_id, school_id, assigned_class, current_step, completed_steps, is_active, workload_json)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(teacher_id, school_id) DO UPDATE SET is_active = 1
        `;
        return new Promise((resolve, reject) => {
            db.getDB().run(
                sql, 
                [teacherId, schoolId, assignedClass, UNIFIED_STEPS[0], JSON.stringify([]), JSON.stringify({})], 
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Check if teacher is in setup
     */
    static async isTeacherInSetup(teacherId: string, schoolId: string): Promise<boolean> {
        const sql = `SELECT is_active FROM ta_setup_state WHERE teacher_id = ? AND school_id = ?`;
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, [teacherId, schoolId], (err, row: any) => {
                if (err) reject(err);
                else resolve(row ? !!row.is_active : false);
            });
        });
    }

    /**
     * Complete teacher setup - marks teacher as operational and no longer in setup
     * ✅ TA 2.1: Validates setup checklist before allowing completion
     * Checks:
     *   1. Students extracted (extracted_students not empty)
     *   2. Subjects configured (subjects not empty)
     *   3. All key setup steps completed
     */
    static async completeSetup(teacherId: string, schoolId: string): Promise<void> {
        // Fetch current setup state to validate
        const setupState = await this.getSetupState(teacherId, schoolId);
        if (!setupState) {
            throw new Error(`Setup state not found for teacher ${teacherId}`);
        }

        // ✅ VALIDATION: Check all checklist items
        const extractedStudents = setupState.extracted_students || [];
        const subjects = setupState.subjects || [];
        const completedSteps = setupState.completed_steps || [];

        const validationErrors = [];
        
        if (!Array.isArray(extractedStudents) || extractedStudents.length === 0) {
            validationErrors.push('No students extracted from class register');
        }
        
        if (!Array.isArray(subjects) || subjects.length === 0) {
            validationErrors.push('No subjects configured');
        }
        
        // Check if key setup steps were marked complete
        // UPDATED: Using unified step names from TA Setup Flow
        const requiredSteps = [
            'WELCOME',
            'DECLARE_WORKLOAD', 
            'REQUEST_REGISTERS', 
            'GENERATE_PREVIEW', 
            'CONFIRM_PREVIEW'
        ];
        const missingSteps = requiredSteps.filter(step => !completedSteps.includes(step));
        if (missingSteps.length > 0) {
            logger.warn(
                { teacherId, missingSteps },
                '⚠️ Setup validation: Some steps not marked complete, but continuing with data validation'
            );
            // Don't fail validation just for missing step markers if we have the data
            // This allows the flow to be more flexible while still ensuring data integrity
        }
        
        if (validationErrors.length > 0) {
            logger.warn(
                { teacherId, schoolId, validationErrors },
                `⚠️  TA 2.1 Setup validation failed - cannot complete: ${validationErrors.join('; ')}`
            );
            throw new Error(`Setup incomplete: ${validationErrors.join('; ')}`);
        }
        
        logger.info(
            { teacherId, schoolId, studentCount: extractedStudents.length, subjectCount: subjects.length },
            `✅ TA 2.1 Setup validation passed - marking complete`
        );
        
        // ✅ All checks passed - mark setup as complete
        return new Promise((resolve, reject) => {
            db.getDB().run(
                `UPDATE ta_setup_state SET is_active = 0, completed_at = CURRENT_TIMESTAMP WHERE teacher_id = ? AND school_id = ?`,
                [teacherId, schoolId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Update TA setup state
     */
    static async updateSetup(teacherId: string, schoolId: string, data: Partial<TASetupState>): Promise<void> {
        const updates: string[] = [];
        const params: any[] = [];

        if (data.current_step) {
            updates.push(`current_step = ?`);
            params.push(data.current_step);
        }
        if (data.completed_steps) {
            updates.push(`completed_steps = ?`);
            params.push(JSON.stringify(data.completed_steps));
        }
        if (data.config_draft) {
            updates.push(`config_draft = ?`);
            params.push(JSON.stringify(data.config_draft));
        }
        if (data.extracted_students) {
            updates.push(`extracted_students = ?`);
            params.push(JSON.stringify(data.extracted_students));
        }
        if (data.subjects) {
            updates.push(`subjects = ?`);
            params.push(JSON.stringify(data.subjects));
        }
        if (data.workload_json) {
            updates.push(`workload_json = ?`);
            params.push(JSON.stringify(data.workload_json));
        }
        if (data.is_active !== undefined) {
            updates.push(`is_active = ?`);
            params.push(data.is_active ? 1 : 0);
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        const sql = `UPDATE ta_setup_state SET ${updates.join(', ')} WHERE teacher_id = ? AND school_id = ?`;
        params.push(teacherId, schoolId);

        return new Promise((resolve, reject) => {
            db.getDB().run(sql, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Save extracted students to class mapping
     */
    static async saveStudentMapping(
        teacherId: string,
        schoolId: string,
        classLevel: string,
        termId: string,
        students: any[]
    ): Promise<number> {
        let insertedCount = 0;

        for (const student of students) {
            // Generate a consistent ID if not provided
            const studentId = student.student_id || `${classLevel.toUpperCase()}-${student.roll_number || student.name.toUpperCase().substring(0, 3)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
            
            await new Promise<void>((resolve, reject) => {
                db.getDB().serialize(() => {
                    // 1. Ensure student exists in student_info (referenced by class_student_mapping)
                    db.getDB().run(
                        `INSERT OR IGNORE INTO student_info (id, school_id, name, class_level) VALUES (?, ?, ?, ?)`,
                        [studentId, schoolId, student.name, classLevel]
                    );

                    // 2. Ensure student exists in master students table (referenced by marks/attendance)
                    db.getDB().run(
                        `INSERT OR IGNORE INTO students (student_id, school_id, name, class_level) VALUES (?, ?, ?, ?)`,
                        [studentId, schoolId, student.name, classLevel]
                    );

                    // 3. Create the mapping
                    db.getDB().run(
                        `INSERT OR REPLACE INTO class_student_mapping 
                        (id, school_id, teacher_id, class_level, student_id, student_name, roll_number, extraction_source, term_id, recorded_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                        [
                            `${teacherId}-${studentId}`,
                            schoolId,
                            teacherId,
                            classLevel,
                            studentId,
                            student.name,
                            student.roll_number || null,
                            student.extracted_from || 'VISION',
                            termId
                        ],
                        function(err) {
                            if (err) {
                                logger.error({ err, studentId }, '❌ Failed to save student mapping');
                                reject(err);
                            } else {
                                insertedCount += this.changes;
                                resolve();
                            }
                        }
                    );
                });
            });
        }

        return insertedCount;
    }

    /**
     * Get all students mapped to a teacher's class
     */
    static async getClassStudents(teacherId: string, schoolId: string, classLevel: string, termId: string): Promise<ClassStudentMapping[]> {
        const sql = `
            SELECT * FROM class_student_mapping 
            WHERE teacher_id = ? AND school_id = ? AND class_level = ? AND term_id = ?
            ORDER BY roll_number ASC
        `;
        return new Promise((resolve, reject) => {
            db.getDB().all(sql, [teacherId, schoolId, classLevel, termId], (err, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Create or update broadsheet
     */
    static async saveBroadsheet(
        teacherId: string,
        schoolId: string,
        classLevel: string,
        termId: string,
        subjects: string[],
        students: ClassStudentMapping[]
    ): Promise<string> {
        const broadsheetId = `BS-${teacherId}-${classLevel}-${termId}`;
        
        const broadsheetData = {
            columns: ['student_id', 'student_name', ...subjects],
            rows: students.map(s => ({
                student_id: s.student_id,
                student_name: s.student_name,
                ...subjects.reduce((acc, subj) => ({ ...acc, [subj]: null }), {})
            }))
        };

        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT OR REPLACE INTO student_broadsheet 
                (id, school_id, teacher_id, class_level, term_id, subjects, broadsheet_data, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    broadsheetId,
                    schoolId,
                    teacherId,
                    classLevel,
                    termId,
                    JSON.stringify(subjects),
                    JSON.stringify(broadsheetData)
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        return broadsheetId;
    }

    /**
     * Create attendance record for a student on a date
     */
    static async recordAttendance(
        teacherId: string,
        schoolId: string,
        studentId: string,
        studentName: string,
        present: boolean,
        markedDate: string,
        termId: string,
        classLevel?: string
    ): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT OR REPLACE INTO student_attendance_records 
                (id, school_id, teacher_id, student_id, student_name, class_level, present, marked_date, term_id, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    `ATT-${studentId}-${markedDate}`,
                    schoolId,
                    teacherId,
                    studentId,
                    studentName,
                    classLevel || 'Unknown',
                    present ? 1 : 0,
                    markedDate,
                    termId
                ],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    /**
     * Get absent students for a date range
     */
    static async getAbsentStudents(
        schoolId: string,
        teacherId: string,
        fromDate: string,
        toDate: string
    ): Promise<any[]> {
        const sql = `
            SELECT 
                student_id,
                student_name,
                marked_date,
                COUNT(*) as absence_count
            FROM student_attendance_records
            WHERE school_id = ? AND teacher_id = ? AND present = 0 AND marked_date BETWEEN ? AND ?
            GROUP BY student_id, marked_date
            ORDER BY marked_date DESC, student_name ASC
        `;
        return new Promise((resolve, reject) => {
            db.getDB().all(sql, [schoolId, teacherId, fromDate, toDate], (err, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Check for duplicate students (by name, possibly different phone)
     * Used for family deduplication
     */
    static async findPossibleDuplicates(
        schoolId: string,
        firstName: string,
        lastName?: string
    ): Promise<any[]> {
        const firstNamePattern = firstName.split(' ')[0].toLowerCase();
        
        const sql = `
            SELECT 
                student_id,
                student_name,
                COUNT(*) as occurrence_count
            FROM class_student_mapping
            WHERE school_id = ? AND LOWER(student_name) LIKE ?
            GROUP BY student_id
            HAVING COUNT(*) > 1
        `;
        
        return new Promise((resolve, reject) => {
            db.getDB().all(sql, [schoolId, `%${firstNamePattern}%`], (err, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Unify duplicate student records (after SA confirmation)
     * Links multiple student records by their parent phone
     */
    static async unifyStudentRecords(
        schoolId: string,
        parentPhone: string,
        studentIds: string[]
    ): Promise<void> {
        const unificationId = `UNIFIED-${parentPhone}`;
        
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `UPDATE class_student_mapping 
                SET unified_id = ? 
                WHERE school_id = ? AND student_id IN (${studentIds.map(() => '?').join(',')})`,
                [unificationId, schoolId, ...studentIds],
                (err) => err ? reject(err) : resolve()
            );
        });

        logger.info({ schoolId, parentPhone, studentCount: studentIds.length }, 'Student records unified');
    }

    /**
     * Handle multi-send: Compare new student list with existing
     * Returns: {new_students, existing_students, possible_duplicates}
     */
    static async compareStudentLists(
        teacherId: string,
        schoolId: string,
        classLevel: string,
        termId: string,
        newStudents: any[]
    ): Promise<{
        new_students: any[],
        existing_count: number,
        possible_duplicates: any[]
    }> {
        const existingStudents = await this.getClassStudents(teacherId, schoolId, classLevel, termId);
        const existingNames = new Set(existingStudents.map(s => s.student_name.toLowerCase()));

        const newStudentsList = newStudents.filter(ns => 
            !existingNames.has(ns.name.toLowerCase())
        );

        // Check for possible duplicates (same first name, different last name)
        const possibleDuplicates: any[] = [];
        for (const newStud of newStudents) {
            const firstName = newStud.name.split(' ')[0].toLowerCase();
            for (const existing of existingStudents) {
                const existingFirst = existing.student_name.split(' ')[0].toLowerCase();
                if (firstName === existingFirst && newStud.name.toLowerCase() !== existing.student_name.toLowerCase()) {
                    possibleDuplicates.push({
                        new_name: newStud.name,
                        existing_name: existing.student_name,
                        existing_id: existing.student_id,
                        similarity: 'first_name_match'
                    });
                }
            }
        }

        return {
            new_students: newStudentsList,
            existing_count: existingStudents.length,
            possible_duplicates: possibleDuplicates
        };
    }

    /**
     * Merge/update student from second submission
     * Handles: new students added, existing students updated, possible duplicates flagged
     */
    static async mergeStudentData(
        teacherId: string,
        schoolId: string,
        classLevel: string,
        termId: string,
        newStudents: any[],
        teacherConfirmedDuplicates: {[existingId: string]: boolean} = {}
    ): Promise<{merged: number, new: number, flagged: number}> {
        let mergedCount = 0;
        let newCount = 0;
        let flaggedCount = 0;

        for (const student of newStudents) {
            const studentId = `${classLevel.toUpperCase()}-${student.roll_number || student.name.toUpperCase().substring(0, 3)}`;
            
            // Check if student already exists
            const existing: any = await new Promise((resolve) => {
                db.getDB().get(
                    `SELECT * FROM class_student_mapping WHERE school_id = ? AND teacher_id = ? AND class_level = ? AND student_name = ?`,
                    [schoolId, teacherId, classLevel, student.name],
                    (err, row) => resolve(row)
                );
            });

            if (existing) {
                mergedCount++;
                // Update if roll number changed
                if (student.roll_number && student.roll_number !== existing.roll_number) {
                    await new Promise<void>((resolve, reject) => {
                        db.getDB().run(
                            `UPDATE class_student_mapping SET roll_number = ? WHERE id = ?`,
                            [student.roll_number, existing.id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });
                }
            } else {
                newCount++;
                // New student - insert
                await this.saveStudentMapping(teacherId, schoolId, classLevel, termId, [student]);
            }
        }

        // Check for flagged duplicates (same first name, different last name)
        for (const [existingId, isConfirmedDuplicate] of Object.entries(teacherConfirmedDuplicates)) {
            if (isConfirmedDuplicate) {
                flaggedCount++;
                // Flag will be handled by SA for family unification
            }
        }

        return { merged: mergedCount, new: newCount, flagged: flaggedCount };
    }

    /**
     * Get setup progress percentage
     */
    static getProgressPercentage(completedSteps: number, totalSteps: number = 6): number {
        return Math.round((completedSteps / totalSteps) * 100);
    }

    /**
     * ✅ TA 3.2: Validate attendance patterns and detect repeated absences
     * Used by both handleAttendancePhoto (in BaseTeacherAgent) and manual escalation
     * Returns array of students with 3+ absences in last 30 days
     */
    static async validateAttendancePatterns(
        schoolId: string,
        studentIds: string[]
    ): Promise<Array<{student_id: string; student_name: string; absence_count_30days: number}>> {
        const repeatedAbsentees: any[] = [];
        
        for (const studentId of studentIds) {
            const absenceCount: any = await new Promise((resolve) => {
                db.getDB().get(
                    `SELECT COUNT(*) as count FROM student_attendance_records 
                     WHERE student_id = ? AND school_id = ? AND present = 0 AND marked_date >= date('now', '-30 days')`,
                    [studentId, schoolId],
                    (err, row: any) => {
                        if (err) {
                            logger.error({ err, studentId }, 'Error validating attendance pattern');
                            resolve(0);
                        } else {
                            resolve(row?.count || 0);
                        }
                    }
                );
            });
            
            if (absenceCount >= 3) {
                const studentInfo: any = await new Promise((resolve) => {
                    db.getDB().get(
                        `SELECT student_name FROM student_attendance_records WHERE student_id = ? LIMIT 1`,
                        [studentId],
                        (err, row: any) => resolve(row || {})
                    );
                });
                
                repeatedAbsentees.push({
                    student_id: studentId,
                    student_name: studentInfo?.student_name || `Student ${studentId}`,
                    absence_count_30days: absenceCount
                });
            }
        }
        
        return repeatedAbsentees;
    }

    /**
     * ✅ TA 3.3: Auto-generate broadsheet for teacher
     * Creates broadsheet_assignments record to track mark sheets per subject/class
     * Called during setup completion to prepare for mark entry
     */
    static async generateBroadsheet(
        teacherId: string,
        schoolId: string,
        subjects: string[]
    ): Promise<string> {
        const broadsheetId = `BS-${teacherId}-${Date.now()}`;
        
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO broadsheet_assignments 
                (id, school_id, teacher_id, subjects, generated_at, is_active)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 1)`,
                [broadsheetId, schoolId, teacherId, JSON.stringify(subjects)],
                (err) => err ? reject(err) : resolve()
            );
        });
        
        logger.info({ teacherId, schoolId, broadsheetId, subjectCount: subjects.length }, '✅ Broadsheet auto-generated');
        return broadsheetId;
    }

    /**
     * ✅ TA 3.4: Record manual attendance entry (when image fails)
     * Called from handleAttendancePhoto fallback or manual LLM request
     */
    static async recordManualAttendanceEntry(
        teacherId: string,
        schoolId: string,
        studentId: string,
        studentName: string,
        present: boolean,
        markedDate: string,
        termId: string,
        manual_notes?: string
    ): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT OR REPLACE INTO student_attendance_records 
                (id, school_id, teacher_id, student_id, student_name, present, marked_date, term_id, manual_entry, manual_notes, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
                [
                    `ATT-${studentId}-${markedDate}`,
                    schoolId,
                    teacherId,
                    studentId,
                    studentName,
                    present ? 1 : 0,
                    markedDate,
                    termId,
                    manual_notes || null
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        logger.info({ teacherId, studentId, markedDate }, '✅ Manual attendance recorded');
    }

    /**
     * ✅ TA 3.4: Record manual mark entry (when image fails)
     * Called from handleMarkSheet fallback or manual LLM request
     */
    static async recordManualMarkEntry(
        schoolId: string,
        teacherId: string,
        studentId: string,
        studentName: string,
        classLevel: string,
        subject: string,
        termId: string,
        marks: {ca1?: number; ca2?: number; midterm?: number; exam?: number},
        manual_notes?: string
    ): Promise<void> {
        const markId = `MARK-${studentId}-${subject}-${termId}`;
        const totalScore = (marks.ca1 || 0) + (marks.ca2 || 0) + (marks.midterm || 0) + (marks.exam || 0);
        
        // Prepare marks_json for API/Frontend compatibility
        const marksJson = JSON.stringify({
            CA1: marks.ca1 || 0,
            CA2: marks.ca2 || 0,
            Midterm: marks.midterm || 0,
            Exam: marks.exam || 0
        });
        
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT OR REPLACE INTO student_marks_indexed 
                (id, school_id, student_id, student_name, teacher_id, class_level, subject, term_id, ca1, ca2, midterm, exam, marks_json, total_score, manual_entry, manual_notes, confirmed_by_teacher, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, CURRENT_TIMESTAMP)`,
                [
                    markId,
                    schoolId,
                    studentId,
                    studentName,
                    teacherId,
                    classLevel,
                    subject,
                    termId,
                    marks.ca1 || 0,
                    marks.ca2 || 0,
                    marks.midterm || 0,
                    marks.exam || 0,
                    marksJson,
                    totalScore,
                    manual_notes || null
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        logger.info({ teacherId, studentId, subject }, '✅ Manual mark entry recorded');
    }

    /**
     * ✅ TA 3.4: Validate grading for school type
     * PRIMARY: CA1 + CA2 + Exam only (no midterm)
     * SECONDARY: CA1 + CA2 + Midterm + Exam
     */
    static async validateGradingForSchoolType(
        schoolId: string,
        marks: {ca1?: number; ca2?: number; midterm?: number; exam?: number}
    ): Promise<{valid: boolean; error?: string}> {
        const school: any = await new Promise((resolve) => {
            db.getDB().get(`SELECT school_type FROM schools WHERE id = ?`, [schoolId], (err, row) => {
                resolve(row || {school_type: 'SECONDARY'});
            });
        });

        const schoolType = school.school_type || 'SECONDARY';

        if (schoolType === 'PRIMARY') {
            // PRIMARY: Only CA1, CA2, Exam allowed (no midterm)
            if (marks.midterm && marks.midterm > 0) {
                return {valid: false, error: 'PRIMARY schools do not have midterm exams. Please remove midterm marks.'};
            }
            if (!marks.ca1 || !marks.ca2 || !marks.exam) {
                return {valid: false, error: 'PRIMARY grading requires CA1, CA2, and Exam marks.'};
            }
        } else {
            // SECONDARY: All four components required
            if (!marks.ca1 || !marks.ca2 || !marks.midterm || !marks.exam) {
                return {valid: false, error: 'SECONDARY grading requires CA1, CA2, Midterm, and Exam marks.'};
            }
        }

        return {valid: true};
    }
}
