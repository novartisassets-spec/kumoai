/**
 * ESCALATION TYPE CONSTANTS
 * Comprehensive list of all escalation types for PA, TA, GA, SA
 * Updated: January 17, 2026
 * 
 * Organization:
 * - PA Escalation Types (Parent Agent)
 * - TA Escalation Types (Teacher Agent) - Class-scoped
 * - GA Escalation Types (Group Agent)
 * - SA Escalation Types (School Admin Agent) - Meta escalations
 */

// ============================================================================
// PA ESCALATION TYPES (Parent Agent)
// ============================================================================

export const PA_ESCALATION_TYPES = {
    // Payment & Fee Related
    PAYMENT_SUBMISSION: 'PAYMENT_SUBMISSION',
    PAYMENT_VERIFICATION_DISPUTE: 'PAYMENT_VERIFICATION_DISPUTE',
    
    // Fee Exceptions & Waivers (NEW - Class-Scoped in context)
    FEE_WAIVER_REQUEST: 'FEE_WAIVER_REQUEST',
    FEE_EXEMPTION_RENEWAL: 'FEE_EXEMPTION_RENEWAL',
    PARTIAL_PAYMENT_REQUEST: 'PARTIAL_PAYMENT_REQUEST',
    
    // Student Accommodations (NEW)
    ACCOMMODATION_REQUEST: 'ACCOMMODATION_REQUEST',
    SPECIAL_ATTENDANCE_REQUEST: 'SPECIAL_ATTENDANCE_REQUEST',
    MEDICAL_EXCEPTION: 'MEDICAL_EXCEPTION',
    
    // Results & Academic Access
    RESULTS_ACCESS_EXCEPTION: 'RESULTS_ACCESS_EXCEPTION',
    RESULT_DISPUTE: 'RESULT_DISPUTE',
    
    // General Escalations
    GENERAL_INQUIRY: 'GENERAL_INQUIRY',
    COMPLAINT: 'COMPLAINT',
};

// ============================================================================
// TA ESCALATION TYPES (Teacher Agent - Secondary) - Class-Scoped
// All TA escalations include: class_level, subject, term_id
// ============================================================================

export const TA_ESCALATION_TYPES = {
    // Attendance Management (Class-Scoped)
    ATTENDANCE_ALERT: 'ATTENDANCE_ALERT',
    ABSENCE_VERIFICATION_REQUEST: 'ABSENCE_VERIFICATION_REQUEST',
    
    // Mark Management (Class-Scoped) - NEW
    MARK_SUBMISSION_FOR_APPROVAL: 'MARK_SUBMISSION_FOR_APPROVAL',
    MARK_BATCH_CORRECTION: 'MARK_BATCH_CORRECTION',
    SCORE_CORRECTION_REQUEST: 'SCORE_CORRECTION_REQUEST',
    
    // Result Management (Class-Scoped) - NEW
    RESULT_AMENDMENT_REQUEST: 'RESULT_AMENDMENT_REQUEST',
    RESULT_APPROVAL_FOR_SIGNING: 'RESULT_APPROVAL_FOR_SIGNING',
    RESULT_LOCK_OVERRIDE_REQUEST: 'RESULT_LOCK_OVERRIDE_REQUEST',
    
    // Performance & Analytics
    CLASS_PERFORMANCE_ALERT: 'CLASS_PERFORMANCE_ALERT',
    STUDENT_PERFORMANCE_CONCERN: 'STUDENT_PERFORMANCE_CONCERN',
    
    // General
    GENERAL_REQUEST: 'GENERAL_REQUEST',
};

// ============================================================================
// PRIMARY_TA ESCALATION TYPES (Teacher Agent - Primary Schools) - Class-Scoped
// All PRIMARY_TA escalations include: class_level (P1-P6), subject (if applicable), term_id
// ============================================================================

export const PRIMARY_TA_ESCALATION_TYPES = {
    // Attendance Management (Class-Scoped) - Same as Secondary
    ATTENDANCE_ALERT: 'ATTENDANCE_ALERT',
    ABSENCE_VERIFICATION_REQUEST: 'ABSENCE_VERIFICATION_REQUEST',
    
    // Mark Management (Class-Scoped) - Primary uses 3-component (CA1, CA2, Exam)
    MARK_SUBMISSION_FOR_APPROVAL: 'MARK_SUBMISSION_FOR_APPROVAL',
    MARK_BATCH_CORRECTION: 'MARK_BATCH_CORRECTION',
    SCORE_CORRECTION_REQUEST: 'SCORE_CORRECTION_REQUEST',
    
    // Result Management (Class-Scoped) - Primary does NOT use midterm or ranking
    RESULT_AMENDMENT_REQUEST: 'RESULT_AMENDMENT_REQUEST',
    RESULT_APPROVAL_FOR_SIGNING: 'RESULT_APPROVAL_FOR_SIGNING',
    
    // Performance & Analytics
    CLASS_PERFORMANCE_ALERT: 'CLASS_PERFORMANCE_ALERT',
    STUDENT_PERFORMANCE_CONCERN: 'STUDENT_PERFORMANCE_CONCERN',
    
    // General
    GENERAL_REQUEST: 'GENERAL_REQUEST',
};

// ============================================================================
// GA ESCALATION TYPES (Group Agent)
// ============================================================================

export const GA_ESCALATION_TYPES = {
    // Content Moderation
    ABUSIVE_MESSAGE_ALERT: 'ABUSIVE_MESSAGE_ALERT',
    MISINFORMATION_ALERT: 'MISINFORMATION_ALERT',
    SPAM_ALERT: 'SPAM_ALERT',
    
    // Group Management
    MEMBER_CONDUCT_ISSUE: 'MEMBER_CONDUCT_ISSUE',
    GROUP_POLICY_VIOLATION: 'GROUP_POLICY_VIOLATION',
    
    // Administrative
    GROUP_ADMINISTRATIVE_REQUEST: 'GROUP_ADMINISTRATIVE_REQUEST',
};

// ============================================================================
// SA ESCALATION TYPES (School Admin Agent) - Meta
// These are escalations that SA receives from system or creates
// ============================================================================

export const SA_ESCALATION_TYPES = {
    // From Agents
    ADMIN_DECISION_REQUIRED: 'ADMIN_DECISION_REQUIRED',
    
    // System-Generated
    DEADLINE_APPROACHING: 'DEADLINE_APPROACHING',
    CRITICAL_SYSTEM_EVENT: 'CRITICAL_SYSTEM_EVENT',
    
    // From Admin Self
    RESULT_PROCESSING: 'RESULT_PROCESSING',
    END_OF_TERM_SETTLEMENT: 'END_OF_TERM_SETTLEMENT',
};

// ============================================================================
// ESCALATION SUBTYPES (Fine-grained classification)
// Used in escalation_subtype field for more specific tracking
// ============================================================================

export const ESCALATION_SUBTYPES = {
    // TA Mark Subtypes
    MARK_APPROVAL_SS1: 'MARK_APPROVAL_SS1',
    MARK_APPROVAL_SS2: 'MARK_APPROVAL_SS2',
    MARK_APPROVAL_SS3: 'MARK_APPROVAL_SS3',
    MARK_APPROVAL_JSS1: 'MARK_APPROVAL_JSS1',
    MARK_APPROVAL_JSS2: 'MARK_APPROVAL_JSS2',
    MARK_APPROVAL_JSS3: 'MARK_APPROVAL_JSS3',
    MARK_APPROVAL_PRIMARY: 'MARK_APPROVAL_PRIMARY',
    
    // TA Result Subtypes
    SIGNING_APPROVAL: 'SIGNING_APPROVAL',
    AMENDMENT_APPROVAL: 'AMENDMENT_APPROVAL',
    
    // PA Fee Subtypes
    TUITION_WAIVER: 'TUITION_WAIVER',
    LUNCH_FEE_WAIVER: 'LUNCH_FEE_WAIVER',
    TRANSPORT_FEE_WAIVER: 'TRANSPORT_FEE_WAIVER',
    EXAM_WAIVER: 'EXAM_WAIVER',
    ACTIVITY_FEE_WAIVER: 'ACTIVITY_FEE_WAIVER',
    
    // PA Accommodation Subtypes
    SCHEDULE_MODIFICATION: 'SCHEDULE_MODIFICATION',
    LEARNING_SUPPORT: 'LEARNING_SUPPORT',
    HEALTH_ACCOMMODATION: 'HEALTH_ACCOMMODATION',
};

// ============================================================================
// PRIORITY LEVELS
// ============================================================================

export const ESCALATION_PRIORITY = {
    LOW: 'LOW',           // Can wait 24+ hours (non-urgent requests)
    MEDIUM: 'MEDIUM',     // Should be handled within hours (normal flow)
    HIGH: 'HIGH',         // Urgent, within minutes (attendance alerts, disputes)
    CRITICAL: 'CRITICAL', // Immediate (safety issues, system failures)
};

// ============================================================================
// ESCALATION STATES
// ============================================================================

export const ESCALATION_STATE = {
    PENDING: 'PENDING',           // Waiting for admin decision
    ACKNOWLEDGED: 'ACKNOWLEDGED', // Admin has seen it
    IN_PROGRESS: 'IN_PROGRESS',   // Admin working on it
    RESOLVED: 'RESOLVED',         // Admin made decision, agent resumed
    CLOSED: 'CLOSED',             // Complete, all feedback sent
    EXPIRED: 'EXPIRED',           // Escalation became irrelevant
    CANCELLED: 'CANCELLED',       // Agent cancelled escalation
};

// ============================================================================
// NIGERIAN SCHOOL CONTEXT
// ============================================================================

export const NIGERIAN_SCHOOL_CONTEXT = {
    // Academic Sessions
    ACADEMIC_TERMS: {
        FIRST_TERM: '2025-T1',  // Jan - Mar
        SECOND_TERM: '2025-T2', // Apr - Jul
        THIRD_TERM: '2025-T3',  // Sep - Dec
    },
    
    // Class Levels
    CLASS_LEVELS: {
        PRIMARY: [
            'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'
        ],
        JUNIOR_SECONDARY: [
            'JSS1', 'JSS1A', 'JSS1B', 'JSS1C',
            'JSS2', 'JSS2A', 'JSS2B', 'JSS2C',
            'JSS3', 'JSS3A', 'JSS3B', 'JSS3C',
        ],
        SENIOR_SECONDARY: [
            'SS1', 'SS1A', 'SS1B', 'SS1C',
            'SS2', 'SS2A', 'SS2B', 'SS2C',
            'SS3', 'SS3A', 'SS3B', 'SS3C',
        ],
    },
    
    // Common Fees (Nigerian Schools)
    COMMON_FEES: [
        'TUITION',
        'LUNCH',
        'TRANSPORT',
        'EXAM',
        'ACTIVITY',
        'SPORTS',
        'DEVELOPMENT_LEVY',
        'SECURITY',
        'UNIFORM',
        'BOOKS',
    ],
    
    // Teacher Behavior Patterns
    TEACHER_PATTERNS: {
        // Class flow
        REGISTRATION_PERIOD: '08:00-08:30', // Morning registration
        FIRST_LESSON: '08:30-10:00',
        MORNING_BREAK: '10:00-10:30',
        LESSONS: '10:30-12:30',
        LUNCH_BREAK: '12:30-13:30',
        AFTERNOON_LESSONS: '13:30-15:30',
        CLOSING_TIME: '15:30',
        
        // Mark Submission Behavior
        MARK_DEADLINES: ['Wednesday', 'Friday'], // Teachers often submit end of week
        END_OF_TERM_RUSH: 'Last 3 days of term', // Marks must be in
        CORRECTION_WINDOW: '24 hours post-submission', // Teachers often want to correct
        
        // Typical Classes
        TYPICAL_CLASS_SIZE: '40-50 students',
        MULTI_STREAM_SCHOOL: ['A', 'B', 'C', 'D'], // Typical streams per class
    },
    
    // Academic Calendar
    SCHOOL_YEAR: '2025',
    CALENDAR: {
        'First Term': { start: 'Jan 6', end: 'Mar 28', exam: 'Mar 24-28' },
        'Second Term': { start: 'Apr 28', end: 'Jul 18', exam: 'Jul 14-18' },
        'Third Term': { start: 'Sep 1', end: 'Dec 19', exam: 'Dec 8-19' },
    },
    
    // Grading Scale (Nigerian)
    GRADING: {
        A: { range: '80-100', comment: 'Excellent' },
        B: { range: '70-79', comment: 'Very Good' },
        C: { range: '60-69', comment: 'Good' },
        D: { range: '50-59', comment: 'Credit' },
        E: { range: '40-49', comment: 'Pass' },
        F: { range: '0-39', comment: 'Fail' },
    },
    
    // Assessment Components
    ASSESSMENT_COMPONENTS: {
        CA1: { weight: 0.1, name: 'Continuous Assessment 1 (First Month)' },
        CA2: { weight: 0.1, name: 'Continuous Assessment 2 (Second Month)' },
        MIDTERM: { weight: 0.2, name: 'Midterm Exam' },
        EXAM: { weight: 0.6, name: 'Final Exam' },
    },
    
    // Remarks Template (Nigerian Schools)
    REMARKS_TEMPLATE: [
        'Excellent performance. Well done and keep it up.',
        'Very good performance. Maintain this standard.',
        'Good performance. You can do better.',
        'Satisfactory performance. Make more effort.',
        'Fair performance. Needs improvement in specific areas.',
        'Poor performance. Requires serious attention.',
        'Very poor performance. Needs immediate intervention.',
    ],
};

export default {
    PA_ESCALATION_TYPES,
    TA_ESCALATION_TYPES,
    GA_ESCALATION_TYPES,
    SA_ESCALATION_TYPES,
    ESCALATION_SUBTYPES,
    ESCALATION_PRIORITY,
    ESCALATION_STATE,
    NIGERIAN_SCHOOL_CONTEXT,
};
