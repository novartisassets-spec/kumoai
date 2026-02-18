/**
 * TA Setup Schema
 * 
 * Defines the flow for Teacher Agent (TA) onboarding:
 * 1. Welcome message triggered
 * 2. Request class register photo
 * 3. Extract students from photo (vision processing)
 * 4. Request subject count for the class
 * 5. Generate broadsheet (with students, subjects, columns for marks)
 * 6. Generate attendance sheet
 * 7. Setup complete - teacher ready to submit marks and attendance
 */

export type TASetupActionType = 
    | 'NONE'
    | 'DECLARE_WORKLOAD'
    | 'EXTRACT_STUDENTS'
    | 'GENERATE_PREVIEW'
    | 'CONFIRM_PREVIEW'
    | 'SETUP_COMPLETE'
    | 'ESCALATE_TO_SA'
    // Legacy action types for backward compatibility
    | 'SHOW_WELCOME'
    | 'REQUEST_CLASS_REGISTER_PHOTO'
    | 'EXTRACT_STUDENTS_FROM_PHOTO'
    | 'REQUEST_SUBJECT_COUNT'
    | 'GENERATE_BROADSHEET'
    | 'GENERATE_ATTENDANCE_SHEET'
    | 'SAVE_STUDENT_DATA'
    | 'FINALIZE_SETUP'
    | 'HANDLE_ATTENDANCE_PHOTO'
    | 'CONFIRM_ATTENDANCE'
    | 'FLAG_ABSENT_STUDENTS'
    | 'ENGAGE_PARENTS';

export interface StudentExtraction {
    student_id?: string;
    name: string;
    roll_number?: string;
    extracted_from: 'VISION' | 'MANUAL';
}

export interface TeacherClassData {
    class_id?: string;
    class_name: string;
    class_level: string;
    students: StudentExtraction[];
    subject_count: number;
    subjects: string[];
}

export interface AttendanceRecord {
    student_id: string;
    student_name: string;
    present: boolean;
    marked_date: string;
    marked_by: string;
}

export interface BroadsheetRow {
    student_id: string;
    student_name: string;
    [subject: string]: string | number | boolean; // Subject columns with marks
}

export interface SetupTAOutput {
    agent: 'TA_SETUP';
    reply_text: string;
    action: TASetupActionType;
    internal_payload?: {
        class_data?: TeacherClassData;
        students?: StudentExtraction[]; // ✅ Robustness: Allow flat students list
        attendance_records?: AttendanceRecord[];
        broadsheet_data?: BroadsheetRow[];
        subjects?: string[];
        subject_count?: number;
        class_name?: string;
        workload?: Record<string, string | string[]>; // { "Primary 3": "ALL" } or { "Primary 4": ["Math"] }
        confidence?: number;
        extraction_notes?: string;
        // PDF Preview flow
        generate_preview?: boolean;
        preview_confirmed?: boolean;
        explicitly_confirmed?: boolean;  // ✅ Teacher explicitly confirmed "that's all"
        preview_data?: {
            workload: Record<string, string[]>;
            students: StudentExtraction[];
            classes: string[];
        };
    };
    setup_status?: {
        current_step: string;
        progress_percentage: number;
        step_completed: boolean;
        is_setup_complete?: boolean;
    };
}

/**
 * TA Setup Flow Sequence
 * 
 * STEP 1: WELCOME
 *   - Show personalized welcome message
 *   - Explain what TA will help with (attendance, marks, student data)
 *   Action: SHOW_WELCOME -> REQUEST_CLASS_REGISTER_PHOTO
 * 
 * STEP 2: CLASS REGISTER PHOTO
 *   - Request teacher to send photo of class register
 *   - Extract student names, roll numbers from image
 *   Action: REQUEST_CLASS_REGISTER_PHOTO -> EXTRACT_STUDENTS_FROM_PHOTO
 * 
 * STEP 3: STUDENT EXTRACTION
 *   - Vision service processes register image
 *   - Extracts student names, identifies fields
 *   - Confirm extracted data with teacher
 *   - Save to database
 *   Action: EXTRACT_STUDENTS_FROM_PHOTO -> REQUEST_SUBJECT_COUNT
 * 
 * STEP 4: SUBJECT COUNT
 *   - Ask: "How many subjects do you teach this class?"
 *   - Get list of subjects
 *   Action: REQUEST_SUBJECT_COUNT -> GENERATE_BROADSHEET
 * 
 * STEP 5: GENERATE SHEETS
 *   - Create broadsheet with students x subjects grid
 *   - Create attendance sheet
 *   - Send templates to teacher for reference
 *   Action: GENERATE_BROADSHEET, GENERATE_ATTENDANCE_SHEET -> FINALIZE_SETUP
 * 
 * STEP 6: FINALIZE
 *   - Mark setup as complete
 *   - Confirm teacher is ready
 *   - Explain next steps (send marks, send attendance photos)
 *   Action: FINALIZE_SETUP (setup complete)
 */

/**
 * Attendance & Mark Submission Flow (After Setup Complete)
 * 
 * 1. Teacher sends attendance photo daily
 *    - Vision extracts marked attendance
 *    - TA reconfirms: "I see these students absent: [names]. Is this correct?"
 *    - Action: HANDLE_ATTENDANCE_PHOTO -> CONFIRM_ATTENDANCE
 * 
 * 2. Teacher confirms attendance
 *    - If absences > threshold: FLAG_ABSENT_STUDENTS
 *    - Action: FLAG_ABSENT_STUDENTS -> ESCALATE_TO_SA
 * 
 * 3. SA reviews absences
 *    - Authorizes absence (legitimate) or escalates
 *    - Action: ESCALATE_TO_SA -> ENGAGE_PARENTS
 * 
 * 4. PA engages parents
 *    - Asks reason for absence
 *    - Records parent response
 *    - Feeds back to SA
 *    - Action: ENGAGE_PARENTS -> (feedback to SA)
 * 
 * 5. Mark submission & indexing
 *    - Teacher sends marks (photo or text)
 *    - TA matches to students by extracted name + subject
 *    - Creates indexed mark records
 *    - Teacher confirms marks
 *    - Action: Handled by existing mark submission flow
 */
