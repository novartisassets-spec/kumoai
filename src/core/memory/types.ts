import { MessageType, AgentContext } from '../types';

export interface ActionAwareMessage {
    id: string;
    timestamp: string;
    sender_role: string;
    content: string;
    type: string;
    context: string;
    action_performed?: string;
    action_status?: string;
}

export interface MemorySnapshot {
    id: string;
    school_id: string;
    user_id: string;
    summary_text: string;
    embedding: number[];
    message_count: number;
    created_at: string;
}
