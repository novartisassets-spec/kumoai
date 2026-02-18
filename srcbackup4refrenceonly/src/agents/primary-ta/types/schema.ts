/**
 * Primary Teacher Agent Output Types
 * 
 * Extends TA output types for Primary school specific attributes
 * Structure mirrors TAOutput for consistency
 */

export type PrimaryTAActionType =
  | 'NONE'
  | 'CONFIRM_MARK_SUBMISSION'
  | 'CONFIRM_ATTENDANCE_SUBMISSION'
  | 'REQUEST_MARK_CORRECTION'
  | 'UPDATE_STUDENT_SCORE'
  | 'ANALYZE_CLASS_PERFORMANCE'
  | 'GENERATE_PDF'
  | 'ESCALATE_TO_ADMIN';

export interface PrimaryTAOutput {
  agent: 'PRIMARY_TA';
  reply_text: string;
  action_required: PrimaryTAActionType;
  action_payload?: {
    submission_id?: string;
    matched_marks?: any[];
    matched_attendance?: any[];
    class_level?: string;
    subject?: string;
    term_id?: string;
    pdf_config?: any;
    confidence_score?: number;
  };
  confidence_score: number;
  session_active: boolean;
  admin_escalation?: {
    required: boolean;
    reason: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    context?: string;
  };
}

export interface PrimaryTASetupOutput {
  agent: 'PRIMARY_TA_SETUP';
  reply_text: string;
  action: PrimaryTAActionType;
  setup_status?: {
    current_step: string;
    progress_percentage: number;
    step_completed: boolean;
    is_setup_complete: boolean;
  };
}
