export type AgentContext = 'PA' | 'TA' | 'SA' | 'GA' | 'ONBOARDING';

export type UserRole = 'admin' | 'teacher' | 'parent';

export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'voice';

export interface UserIdentity {
    phone: string;
    role: UserRole;
    schoolId: string;
    userId: string;
    name?: string;
    assignedClass?: string;
    preferredLanguage?: string; // For voice transcription
}

export interface IncomingMessage {
    id: string;
    from: string; // Phone number (sender)
    to?: string; // ✅ WhatsApp JID that received the message (for multi-tenancy school resolution)
    type: MessageType;
    body: string; // Text content or caption
    mediaPath?: string; // If image/file/audio
    imageExplanation?: string; // Result of vision analysis (from Pass 1 classifier)
    extractionData?: any; // Structured data from vision
    timestamp: number;
    source: 'user' | 'system'; // New field for internal triggers
    isGroup?: boolean; // ✅ Flag to identify group messages
    participant?: string; // ✅ Actual sender phone in group messages (from field might be group JID)
    originalMessageKey?: any; // ✅ Baileys message key for quoting in groups
    mediaType?: string; // ✅ Mimetype if media
    // Voice message fields (populated by VoiceMessageHandler)
    isVoiceMessage?: boolean;
    voiceTranscription?: any; // TranscriptionResult
    voiceContext?: string;
    audioBuffer?: Buffer;
}

export interface RoutedMessage extends IncomingMessage {
    context: AgentContext;
    identity?: UserIdentity; // Present if known user
    senderIdentity?: UserIdentity; // ✅ For group messages - identity of who posted in group
    isAdminMessage?: boolean; // ✅ True if sender is admin posting in group
    // ✅ Token-based teacher session context
    sessionId?: string; // Teacher session ID when authenticated via access token
    accessToken?: string; // The access token used for authentication
    isTokenAuthenticated?: boolean; // Flag indicating token-based access
    isUserSwitch?: boolean; // Flag indicating a user switch on shared device
    // Additional routing metadata
    schoolId?: string; // Resolved school context for the message
    isIdentifiedParent?: boolean; // Whether the sender is a registered parent
}

export interface AgentResponse {
    to: string;
    body: string; // Text response
    mediaPath?: string; // Optional media
    quotedMessageId?: string; // ✅ For quoting/replying to messages in groups
    actions?: AgentAction[]; // Structured actions for the system to execute
    delivery_type?: 'text' | 'voice' | 'document';
    action_payload?: any; // Structured payload from agent
    acknowledgementOfVoice?: boolean; // Flag if response acknowledges voice input
}

export interface AgentAction {
    type: string;
    payload: any;
}
