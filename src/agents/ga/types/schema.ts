export type GAActionType = 
    | 'NONE'
    | 'DELETE_MESSAGE'
    | 'SEND_MESSAGE'
    | 'GREET_NEW_MEMBER'
    | 'LOG_MODERATION'
    | 'ESCALATE_TO_ADMIN';

export interface GAOutput {
    agent: 'GA';
    reply_text: string;
    action_required: GAActionType;
    
    // Escalation Signal: When GA needs admin authority
    // Set required=true to pause conversation and request admin decision
    admin_escalation?: {
        required: boolean;  // Set true to trigger escalation
        urgency?: 'low' | 'medium' | 'high';
        reason?: string;  // Why escalation is needed
        message_to_admin?: string;  // What GA is asking admin to decide
        requested_decision?: string;  // Type of decision (e.g., "approve|reject")
        allowed_actions?: string[];  // What actions admin can take
        context?: Record<string, any>;  // Relevant context data
    };
    action_payload?: {
        message_id?: string;
        reason?: string;
        target_phone?: string;
        announcement_content?: string;

        // For ESCALATE_TO_ADMIN
        escalation_payload?: {
            escalation_type?: string;
            priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
            reason?: string;
            original_message?: string;
            context?: any;
        };
    };
    confidence_score: number;
    moderation_flag: 'CLEAN' | 'HURTFUL' | 'ABUSIVE';
}

