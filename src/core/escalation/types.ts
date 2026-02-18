/**
 * Unified Escalation System
 * 
 * This module defines the data structures and flows for inter-agent communication,
 * specifically for escalations from PA, TA, and GA to SA (School Admin).
 * 
 * Flow:
 * 1. Any agent (PA, TA, GA) can escalate to SA
 * 2. SA receives escalation with full context
 * 3. SA creates instruction payload with feedback
 * 4. Instruction routed back to originating agent
 * 5. Agent LLM processes instruction and crafts user-facing response
 * 6. All steps logged in memory for visibility
 */

// ============================================================================
// ESCALATION TYPES & PAYLOADS
// ============================================================================

export type EscalationOrigin = 'PA' | 'TA' | 'PRIMARY_TA' | 'GA';
export type EscalationType = 
    | 'PARENT_REQUEST_TO_ADMIN' // Parent wants to tell admin something
    | 'PARENT_PAYMENT_ESCALATION' // Parent escalating payment issue
    | 'TEACHER_ABSENCE_ALERT' // TA/PRIMARY_TA escalating student absences (P1-P6 for Primary, JSS/SSS for Secondary)
    | 'TEACHER_MARK_DISPUTE' // TA/PRIMARY_TA escalating mark discrepancy
    | 'PRIMARY_TEACHER_MARK_SUBMISSION' // PRIMARY_TA escalating 3-component marks (CA1, CA2, Exam) for approval
    | 'GROUP_ABUSIVE_MESSAGE' // GA escalating harmful message
    | 'GROUP_ADMINISTRATIVE' // GA escalating admin-level group issue
    | 'CUSTOM'; // Custom escalation with reason in payload

export interface EscalationPayload {
    // Core escalation metadata
    escalation_id?: string; // Unique ID for tracking (optional on creation)
    origin_agent?: EscalationOrigin;
    escalation_type: string; // Flexible type
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    
    // Context
    school_id?: string;
    from_phone?: string; // User's phone number
    user_name?: string; // User's name if known
    user_role?: 'parent' | 'teacher' | 'student' | 'unknown';
    timestamp?: number; // Unix timestamp
    
    // Original message context
    original_message?: string; // What the user said
    agent_analysis?: string; // Agent's interpretation of user intent
    
    // Escalation reason
    reason: string; // Why agent is escalating
    what_agent_needed: string; // What the agent wants admin to do
    
    context?: {
        student_id?: string;
        student_name?: string;
        teacher_id?: string;
        teacher_name?: string;
        class_level?: string;
        subject?: string;
        payment_amount?: number;
        attendance_date?: string;
        absent_count?: number;
        [key: string]: any; // Allow custom context
    };
    
    // Data for SA decision making
    data_payload?: {
        [key: string]: any; // Escalation-specific data
    };
    
    // For tracking
    conversation_history?: string[]; // Last N messages for SA context
    session_id?: string;
}

/**
 * Instruction payload from SA back to agent
 * Contains feedback, decisions, and next steps for agent to execute
 */
export interface InstructionPayload {
    // Core instruction metadata
    instruction_id: string; // Unique ID
    escalation_id: string; // Links back to original escalation
    target_agent: EscalationOrigin; // Which agent should process this
    
    // SA's decision & feedback
    decision: 'APPROVED' | 'DENIED' | 'PENDING' | 'CONDITIONAL';
    sa_response: string; // What SA decided (e.g., "Payment waived for this month")
    reason: string; // Why SA made this decision
    
    // For agent to communicate to user
    user_message?: string; // Optional template message for agent to use
    
    // For agent to execute
    action: string; // What the agent should do next
    action_params?: {
        [key: string]: any; // Parameters for the action
    };
    
    // Metadata
    school_id: string;
    target_phone: string; // Who receives the final message
    timestamp: number;
    expires_at?: number; // If instruction has expiration
}

/**
 * Escalation event logged in memory
 * Persists every escalation and feedback for visibility
 */
export interface EscalationMemoryRecord {
    escalation_id: string;
    origin_agent: EscalationOrigin;
    escalation_type: string;
    from_phone: string;
    user_name?: string;
    user_role?: string;
    
    // Original escalation details
    original_message: string;
    reason: string;
    priority: string;
    escalation_timestamp: number;
    
    // SA's instruction (if received)
    instruction_id?: string;
    sa_decision?: 'APPROVED' | 'DENIED' | 'PENDING' | 'CONDITIONAL';
    sa_response?: string;
    sa_action?: string;
    instruction_timestamp?: number;
    
    // Agent's final response to user
    agent_final_response?: string;
    final_response_timestamp?: number;
    
    // For audit trail
    school_id: string;
    session_id?: string;
    status: 'ESCALATED' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
}

// ============================================================================
// AGENT SCHEMA EXTENSIONS
// ============================================================================

/**
 * Extension to PAOutput for escalations
 */
export interface PAEscalationOutput {
    agent: 'PA';
    reply_text: string;
    action_required: 'ESCALATE_TO_ADMIN' | string;
    escalation_payload?: EscalationPayload;
}

/**
 * Extension to TAOutput for escalations
 */
export interface TAEscalationOutput {
    agent: 'TA';
    reply_text: string;
    action_required: 'ESCALATE_TO_ADMIN' | string;
    escalation_payload?: EscalationPayload;
}

/**
 * Extension to GAOutput for escalations
 */
export interface GAEscalationOutput {
    agent: 'GA';
    reply_text: string;
    action_required: 'ESCALATE_TO_ADMIN' | string;
    escalation_payload?: EscalationPayload;
}

/**
 * SAOutput receives escalations and sends instructions
 */
export interface SAEscalationOutput {
    agent: 'SA';
    reply_text: string;
    action_required: 'ACKNOWLEDGE_ESCALATION' | 'SEND_INSTRUCTION' | 'NOTIFY_OWNER' | string;
    escalations_received?: EscalationPayload[]; // Escalations SA received
    instructions_sent?: InstructionPayload[]; // Instructions SA is sending back
}

// ============================================================================
// ESCALATION FLOW DIAGRAM
// ============================================================================

/**
 * Complete Escalation Flow:
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ STEP 1: USER CONTACTS AGENT (PA, TA, or GA)                             │
 * │ Parent: "Tell admin my son is sick"                                    │
 * │ Teacher: [Attendance photo with 3 absent]                               │
 * │ Group: [Abusive message]                                               │
 * └──────────────────────────────┬──────────────────────────────────────────┘
 *                                 ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ STEP 2: AGENT LLM ANALYZES & DECIDES TO ESCALATE                        │
 * │ - Recognizes situation requires admin intervention                      │
 * │ - Creates EscalationPayload with full context                          │
 * │ - Outputs: action_required = "ESCALATE_TO_ADMIN"                       │
 * │ - Outputs: escalation_payload = {...}                                  │
 * │ - Replies: "I'll escalate this to admin..."                            │
 * └──────────────────────────────┬──────────────────────────────────────────┘
 *                                 ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ STEP 3: DISPATCHER ROUTES ESCALATION                                   │
 * │ - Dispatcher detects action_required = "ESCALATE_TO_ADMIN"             │
 * │ - Stores escalation in memory with full context                        │
 * │ - Routes escalation_payload to SA                                      │
 * │ - Sends user's reply to user (agent's reply_text)                      │
 * │ - Logs in conversation_history: "[ESCALATED to SA: reason]"            │
 * └──────────────────────────────┬──────────────────────────────────────────┘
 *                                 ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ STEP 4: SA RECEIVES & PROCESSES ESCALATION                              │
 * │ - SA gets escalation_payload with full context                         │
 * │ - SA analyzes situation (parent absence, mark dispute, absences, etc.) │
 * │ - SA decides: APPROVED, DENIED, PENDING, or CONDITIONAL                │
 * │ - SA creates instruction_payload with action & feedback                │
 * │ - SA notifies school owner (if critical)                               │
 * │ - Logs escalation in memory: "[ESC-001] received from PA"              │
 * └──────────────────────────────┬──────────────────────────────────────────┘
 *                                 ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ STEP 5: SA SENDS INSTRUCTION BACK                                      │
 * │ - Dispatcher receives instruction_payload from SA                      │
 * │ - Routes back to originating agent (PA, TA, or GA)                     │
 * │ - Target agent receives: instruction_payload with SA's decision        │
 * │ - Logs in memory: "[INSTR-001] sent to PA"                             │
 * └──────────────────────────────┬──────────────────────────────────────────┘
 *                                 ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ STEP 6: AGENT LLM PROCESSES INSTRUCTION                                │
 * │ - Agent LLM receives instruction_payload as part of system prompt      │
 * │ - Instruction shows what SA decided and what to tell user              │
 * │ - LLM crafts final response incorporating SA's decision                 │
 * │ - Example: "Your payment has been approved. You can proceed..."        │
 * │ - Outputs: action_required = "DELIVER_FEEDBACK"                       │
 * │ - User sees natural, context-aware response                            │
 * └──────────────────────────────┬──────────────────────────────────────────┘
 *                                 ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ STEP 7: FINAL RESPONSE TO USER                                          │
 * │ - Agent sends final reply_text to user (crafted by LLM, informed by SA)│
 * │ - User perceives seamless experience (no "talking to admin")            │
 * │ - Memory logs: "[RESOLVED] User received feedback from SA via agent"   │
 * │ - Conversation history complete and auditable                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

