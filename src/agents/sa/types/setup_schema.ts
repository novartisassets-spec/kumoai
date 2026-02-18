export type SetupActionType =
    | 'NO_ACTION'
    | 'GO_TO_STEP'
    | 'SETUP_SCHOOL'  // ← NEW: Unified school setup action
    | 'REMOVE_TEACHER'  // ← NEW: Remove teacher from registration list
    | 'REPLACE_TEACHER'  // ← NEW: Replace teacher details
    | 'SET_ADMIN_NAME'  // ← Capture admin's name for personalization
    | 'CONFIRM_SCHOOL_IDENTITY'
    | 'SET_SCHOOL_INFO'
    | 'SET_SCHOOL_TYPE'  // ← NEW: Declare PRIMARY, SECONDARY, or BOTH
    | 'ADD_TERM'
    | 'SET_ACTIVE_TERM'
    | 'CONFIGURE_GRADING'
    | 'CONFIGURE_FEES'
    | 'SKIP_FEES_SETUP'
    | 'ADD_PRIMARY_TEACHER'  // ← NEW: Add Primary school teacher
    | 'ADD_SECONDARY_TEACHER'  // ← NEW: Add Secondary school teacher (alias for ADD_TEACHER)
    | 'ADD_TEACHER'  // Legacy (Secondary only)
    | 'SKIP_TEACHER_SETUP'
    | 'CONFIRM_READINESS'
    | 'FINALIZE_SETUP';

// ═══════════════════════════════════════════════════════════════
// UNIFIED SETUP PAYLOAD: Complete school configuration
// ═══════════════════════════════════════════════════════════════
export interface SetupSchoolPayload {
    school_info: {
        name: string;
        address: string;
        phone: string;
        whatsapp_group_link?: string;
        registration_number?: string;
    };
    school_type: 'PRIMARY' | 'SECONDARY' | 'BOTH';  // ← NEW: Declare school type
    academic_config: {
        terms: Array<{
            term_name: string;
            start_date: string;  // YYYY-MM-DD
            end_date: string;    // YYYY-MM-DD
        }>;
        active_term?: string;
    };
    grading_config: {
        ca_percentage: number;
        exam_percentage: number;
        scale: string;  // e.g., "A-F", "0-100", "1-5"
    };
    fees_config: {
        tuition: number;
        additional_fees?: { [key: string]: number };
        currency: string;  // e.g., "NGN", "USD"
    };
    universe_config: {
        classes_universe: string[];  // e.g., ["Primary 1", "Primary 2", ...]
        subjects_universe: string[];  // e.g., ["Mathematics", "English", ...]
    };
    teacher_assignments: Array<{
        name: string;
        phone: string;
        assigned_class?: string;  // ← OPTIONAL: Teachers declare this during THEIR setup
        email?: string;
        school_type?: 'PRIMARY' | 'SECONDARY';  // ← NEW: Specify which type this teacher teaches
    }>;
}

export interface RemoveTeacherPayload {
    teacher_phone: string;  // Phone of teacher to remove
    reason?: string;
}

export interface ReplaceTeacherPayload {
    old_phone: string;  // Phone of teacher being replaced
    new_teacher: {
        name: string;
        phone: string;
        assigned_class?: string;  // ← OPTIONAL: Teachers declare this during THEIR setup
        email?: string;
    };
    reason?: string;
}

export interface SetupSAOutput {
    reply_text: string;
    action: SetupActionType;
    internal_payload: any;
    setup_status: {
        current_step: string;
        progress_percentage: number;
        step_completed: boolean;
    };
    backend_actions?: Array<{
        action: string;
        payload?: Record<string, any>;
    }>;
}