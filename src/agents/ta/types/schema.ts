export type TAActionType = 
    | 'NONE'
    | 'CONFIRM_MARK_SUBMISSION'
    | 'CONFIRM_ATTENDANCE_SUBMISSION'
    | 'REQUEST_MARK_CORRECTION'
    | 'UPDATE_STUDENT_SCORE'
    | 'ANALYZE_CLASS_PERFORMANCE'
    | 'GENERATE_PDF'
    | 'ESCALATE_TO_ADMIN';

export interface TAOutput {
    agent: 'TA';
    reply_text: string;
    action_required: TAActionType;
    
    // Delivery type for messages with documents
    delivery_type?: 'text' | 'document';
    
    // Escalation Signal: When TA needs admin authority
    // Set required=true to pause conversation and request admin decision
    admin_escalation?: {
        required: boolean;  // Set true to trigger escalation
        type?: string;  // Type of escalation (e.g., 'MARK_AMENDMENT', 'ABSENCE_ALERT')
        urgency?: 'low' | 'medium' | 'high';
        reason?: string;  // Why escalation is needed
        message_to_admin?: string;  // What TA is asking admin to decide
        requested_decision?: string;  // Type of decision (e.g., "approve|reject")
        allowed_actions?: string[];  // What actions admin can take
        context?: Record<string, any>;  // Relevant context data
        // Quick access fields for dispatcher
        subject?: string;
        class_level?: string;
        term_id?: string;
        // ID of pre-created escalation (for robustness)
        escalation_id?: string;
    };
    action_payload?: {
        // For mark submission handling
        submission_id?: string;
        reason?: string;
        
        // For UPDATE_STUDENT_SCORE
        student_identifier?: string;
        subject?: string;
        new_score?: number;
        
        // For BroadSheet / Analytics
        class_level?: string;
        term_id?: string;
        
        // For Confirmation/Inconsistency
        confirmation_context?: string;
        flagged_issue?: string;
        
        // For CONFIRM_ATTENDANCE action
        matched_attendance?: any[];
        marked_date?: string;
        should_escalate?: boolean;
        absent_students?: string[];
        absent?: string[]; // Alternative field name from LLM
        
        // For REQUEST_TEACHER_CONFIRMATION action
        matched_marks?: any[];
        
        // For PDF sending to teacher
        pdf_path?: string;
        pdf_caption?: string;
        
        // 🆕 NEW: For PDF generation (from TA LLM decision)
        pdf_config?: {
            template: 'attendance' | 'marks_sheet' | 'registration';
            title?: string;
            description?: string;
            data: any; // Template-specific data
            includeStats?: boolean;
            includeSchoolHeader?: boolean;
        };

        // For ESCALATE_TO_ADMIN
        escalation_payload?: {
            escalation_type?: string;
            priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
            reason?: string;
            original_message?: string;
            context?: any;
        };
        
        // Metadata
        confidence?: number;
        session_id?: string;
        
        // For vision processing
        is_low_confidence?: boolean;
        vision_confidence?: number;
        
        // For attendance tracking
        attendance_details?: {
            date: string;
            present_count: number;
            absent_count: number;
            absentees: any[];
            repeated_absentees: any[];
        };
        
        // For mark drafts
        draft_id?: string;
        is_complete?: boolean;
        missing_students?: string[];
    };
    confidence_score: number;
    session_active: boolean;
}