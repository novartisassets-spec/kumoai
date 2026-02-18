/**
 * Primary Teacher Agent Setup Schema
 * 
 * Setup flow for Primary school teachers
 * Same structure as Secondary but with Primary-specific curriculum data
 */

export type PrimaryTASetupActionType =
  | 'WELCOME'
  | 'REQUEST_CLASS_REGISTER_PHOTO'
  | 'EXTRACT_STUDENTS'
  | 'REQUEST_SUBJECT_COUNT'
  | 'REQUEST_GRADING_CONFIRMATION'
  | 'GENERATE_BROADSHEET'
  | 'FINALIZE'
  | 'ESCALATE_TO_SA';

export interface StudentExtraction {
  name: string;
  roll_number?: number;
  student_id: string;
  extraction_source: 'class_register' | 'manual_entry' | 'system_import';
  email?: string;
  phone?: string;
}

export interface PrimaryTeacherClassData {
  class_level: string; // P1, P2, P3, P4, P5, P6
  term_id: string;
  subjects: string[];
  total_students: number;
  students: StudentExtraction[];
  curriculum_type: 'primary_kenyan' | 'primary_ugandan' | 'primary_nigerian' | 'primary_ghanaian';
}

export interface PrimaryAttendanceRecord {
  student_id: string;
  student_name: string;
  present: boolean;
  marked_date: string;
  reason_if_absent?: string;
}

export interface SetupPrimaryTAOutput {
  agent: 'PRIMARY_TA_SETUP';
  reply_text: string;
  action: string;
  setup_status?: {
    current_step: PrimaryTASetupActionType;
    progress_percentage: number;
    step_completed: boolean;
    is_setup_complete: boolean;
  };
  config?: PrimaryTeacherClassData;
}
