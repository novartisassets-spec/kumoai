/**
 * LLM PDF Instruction Protocol
 * Defines JSON schema for LLM to instruct backend on PDF generation
 * LLM outputs structured JSON that backend parses to render PDFs
 * Enables LLM to have full control over presentation without hardcoded messages
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Complete conversation context that LLM maintains
 * Timestamps every interaction for full audit trail
 */
export interface ConversationContext {
    sessionId: string;
    teacherId: string;
    schoolId: string;
    schoolName: string;
    teacherName: string;
    phone: string;

    // Conversation state
    currentPhase: 'initial' | 'extraction' | 'confirmation' | 'submission' | 'complete';
    conversationStartedAt: number;
    lastInteractionAt: number;

    // Data accumulated in this session
    extractedData: ExtractedData | null;
    confirmationStatus: 'pending' | 'confirmed' | 'rejected' | null;

    // Conversation history with timestamps
    messages: TimestampedMessage[];
}

export interface TimestampedMessage {
    id: string;
    timestamp: number;
    from: 'teacher' | 'system' | 'llm';
    type: 'text' | 'image' | 'action';
    content: string;
    phase: string;
    actionTaken?: string;
}

/**
 * Extracted data from teacher submission
 * Could be registration, marks, or attendance data
 */
export interface ExtractedData {
    type: 'registration' | 'marks' | 'attendance';
    timestamp: number;
    extractionConfidence: number;

    // Registration data (student list)
    registration?: {
        classLevel: string;
        studentCount: number;
        students: Array<{
            name: string;
            roll?: string;
            confidence: number;
            extractedAt: number;
        }>;
    };

    // Marks data
    marks?: {
        subject: string;
        term: string;
        classLevel: string;
        maxScore: number;
        studentCount: number;
        marks: Array<{
            studentId?: string;
            studentName: string;
            score: number;
            scores?: Record<string, number>; // ✅ FLUID PILLARS: { "CA1": 15, "Project": 20 }
            confidence: number;
            submittedAt: number;
        }>;
        traits?: Array<{
            studentName: string;
            category: 'affective' | 'psychomotor';
            trait: string;
            rating: number; // 1-5
        }>;
        comments?: Array<{
            studentName: string;
            teacherRemark?: string;
            principalRemark?: string;
        }>;
    };

    // Attendance data
    attendance?: {
        classLevel: string;
        markedDate: string;
        studentCount: number;
        presentCount: number;
        absentCount: number;
        students: Array<{
            name: string;
            present: boolean;
            markedAt: number;
        }>;
        absentStudents?: Array<{
            name: string;
            reason?: string;
        }>;
    };
}

/**
 * LLM PDF Instruction - What the LLM outputs to backend
 * LLM decides: template, data, tone, next actions
 */
export interface LLMPDFInstruction {
    // Instruction metadata
    instructionId: string;
    timestamp: number;
    phase: string; // Which phase of conversation this instruction is for

    // What PDF to render
    pdfRequest: {
        templateType: 'registration' | 'marks_sheet' | 'attendance' | 'batch_report_cards' | 'student_report_card';
        data: Record<string, any>;
        title?: string; // Custom title if needed
        notes?: string; // Any special notes for PDF
    };

    // What message to send alongside PDF
    message: {
        text: string; // Main message to teacher
        tone: 'professional' | 'friendly' | 'urgent' | 'encouraging';
        language: 'en' | 'ig' | 'yo'; // Multi-language support
    };

    // What to ask teacher next
    nextAction: {
        type: 'confirmation' | 'correction' | 'submission' | 'escalation' | 'end';
        instruction: string;
        expectedResponseType: 'yes_no' | 'correction' | 'file' | 'text' | 'timeout';
        timeoutSeconds?: number; // Auto-continue after timeout
    };

    // Context for backend to understand conversation flow
    context: {
        // What happened before this instruction
        previousPhase?: string;
        dataCollected: string[]; // [registration, marks, attendance]
        issuesFound?: string[];
        confidenceLevel: number; // 0-1: LLM's confidence in what it saw
        needsApproval: boolean;
    };

    // Audit trail
    reasoning: string; // Why LLM made this decision
    alternativeActions?: string[]; // What could happen if teacher responds differently
}

/**
 * Backend Response to LLM
 * Tells LLM what happened with its instruction
 */
export interface LLMInstructionResponse {
    instructionId: string;
    timestamp: number;
    status: 'executed' | 'pending' | 'failed' | 'cancelled';
    
    // PDF generation result
    pdf?: {
        documentId: string;
        fileName: string;
        filePath: string;
        mimeType: string;
        generatedAt: number;
    };

    // Message delivery result
    messageSent: boolean;
    messageId?: string;

    // Teacher's response (if any)
    teacherResponse?: {
        timestamp: number;
        type: 'approval' | 'correction' | 'rejection' | 'skip' | 'timeout';
        content: string;
        confidence?: number;
    };

    // Any errors or issues
    errors?: string[];

    // What LLM should do next based on response
    nextSteps?: string;
}

/**
 * LLM Prompt for PDF Generation
 * This is what we send to Claude to generate the LLMPDFInstruction
 */
export function buildLLMPDFPrompt(context: ConversationContext, extractedData: ExtractedData): string {
    const dataType = extractedData.type;
    const lastMessage = context.messages[context.messages.length - 1];
    const messagesSummary = context.messages
        .slice(-5) // Last 5 messages for context
        .map((m) => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.from}: ${m.content}`)
        .join('\n');

    return `
# Teacher Confirmation System - PDF Generation Task

## Your Role
You are OPHIREX, an intelligent and professional teaching assistant for African schools. You extract data from teacher submissions and generate confirmation PDFs. Your job is to:
1. Understand what data the teacher submitted (Marks, Attendance, or Registration).
2. Detect missing holistic data common in African schools: Teacher Remarks, Principal Comments, and Affective Traits (Punctuality, Neatness, etc.).
3. Decide what PDF template to use for confirmation.
4. Generate a conversational message that explains what you found and asks for missing details or corrections.
5. Output JSON instructions for the backend to render the PDF.

## Conversational Correction Strategy
- If a teacher says "John actually got 15 in Assignment", update the data and generate a new PDF.
- If comments or traits are missing, gently ask: "I've extracted the marks, but I don't see any behavioral traits or teacher remarks. Would you like to add them now or proceed with just the academic scores?"
- Never use generic "Confirmation requested" messages. Be specific: "I've compiled the results for JSS3 Mathematics. John Doe topped the class with 92%. Please check the attached sheet for accuracy."

## African School Context
- **Affective Traits**: Punctuality, Neatness, Relationship with others, Honesty, Leadership.
- **Comments**: Academic performance is not just about numbers; qualitative remarks are critical for parents.
- **Fluid Pillars**: Every school has its own scoring DNA (e.g. CA1, Project, Lab, Exam). You MUST follow the pillars provided in the extraction data.

## Current Session Context
- **Teacher**: ${context.teacherName}
- **School**: ${context.schoolName}
- **Class**: ${extractedData.registration?.classLevel || extractedData.marks?.classLevel || extractedData.attendance?.classLevel}
- **Session Start**: ${new Date(context.conversationStartedAt).toLocaleString()}
- **Current Time**: ${new Date(Date.now()).toLocaleString()}

## Conversation History (Last 5 messages)
\`\`\`
${messagesSummary}
\`\`\`

## Extracted Data Summary
- **Data Type**: ${dataType}
- **Confidence**: ${(extractedData.extractionConfidence * 100).toFixed(1)}%
- **Items Found**: ${dataType === 'registration' ? extractedData.registration?.studentCount || 0 : dataType === 'marks' ? extractedData.marks?.studentCount || 0 : extractedData.attendance?.studentCount || 0}
- **Timestamp**: ${new Date(extractedData.timestamp).toLocaleString()}

${extractedData.registration ? `## Student Registration Data
- Students Identified: ${extractedData.registration.studentCount}
- Sample: ${extractedData.registration.students.slice(0, 3).map((s) => s.name).join(', ')}
- Confidence Range: ${((extractedData.registration.students.reduce((a, b) => a + b.confidence, 0) / extractedData.registration.studentCount) * 100).toFixed(1)}%` : ''}

${extractedData.marks ? `## Marks Data
- Subject: ${extractedData.marks.subject}
- Term: ${extractedData.marks.term}
- Students with Marks: ${extractedData.marks.studentCount}
- Score Range: ${Math.min(...extractedData.marks.marks.map((m) => m.score))} - ${Math.max(...extractedData.marks.marks.map((m) => m.score))}` : ''}

${extractedData.attendance ? `## Attendance Data
- Date: ${extractedData.attendance.markedDate}
- Present: ${extractedData.attendance.presentCount}
- Absent: ${extractedData.attendance.absentCount}
- Total: ${extractedData.attendance.studentCount}
- Attendance Rate: ${((extractedData.attendance.presentCount / extractedData.attendance.studentCount) * 100).toFixed(1)}%` : ''}

## Your Task
Generate a JSON response with the following structure:

\`\`\`json
{
  "instructionId": "unique-id-for-this-instruction",
  "timestamp": timestamp_in_milliseconds,
  "phase": "current_phase_name",
  "pdfRequest": {
    "templateType": "registration|marks_sheet|attendance",
    "data": { /* structured data for PDF population */ },
    "title": "optional custom title",
    "notes": "any special instructions"
  },
  "message": {
    "text": "Your message to teacher explaining what was found and what needs to happen next",
    "tone": "professional|friendly|urgent|encouraging",
    "language": "en"
  },
  "nextAction": {
    "type": "confirmation|correction|submission|escalation|end",
    "instruction": "What you're asking the teacher to do",
    "expectedResponseType": "yes_no|correction|file|text|timeout",
    "timeoutSeconds": 300
  },
  "context": {
    "previousPhase": "extraction",
    "dataCollected": ["registration", "marks", "attendance"],
    "issuesFound": [],
    "confidenceLevel": 0.95,
    "needsApproval": true
  },
  "reasoning": "Why you made these decisions",
  "alternativeActions": ["What could happen if teacher responds differently"]
}
\`\`\`

## Important Guidelines
1. **Be Context-Aware**: Reference the conversation history and what's happened so far
2. **Be Honest About Confidence**: If extraction confidence is low, ask for verification
3. **Be Helpful**: Guide teachers to fix issues, don't just reject data
4. **Include Timestamps**: Every decision is timestamped
5. **Full Context**: Always show what you found and why you're asking for confirmation
6. **Dynamic Messages**: Generate helpful, contextual messages - no generic templates
7. **Error Handling**: If data looks wrong, explain specifically what seems off
8. **Multi-Language Ready**: Responses should support teacher's language preference

## Example Scenarios

### If Registration Data Looks Good
Send registration template with student list, ask: "Please review the student names above. Are they all correct? Reply YES to proceed or send corrections."

### If Marks Has Some Missing
Send marks template highlighting missing scores, ask: "I found some students but missed scores for others. Please resubmit or clarify."

### If Attendance Shows Many Absences
Send attendance template, alert on escalations, ask: "I've marked multiple students absent. This will be escalated to admin. Confirm?"

## Output Format
Return ONLY valid JSON. No markdown, no explanation text. Just the JSON object.
`;
}

/**
 * Parse LLM response and validate it's proper JSON
 */
export function parseLLMPDFInstruction(response: string): LLMPDFInstruction | null {
    try {
        // Try to extract JSON from response (in case LLM includes extra text)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]) as LLMPDFInstruction;

        // Validate required fields
        if (
            !parsed.instructionId ||
            !parsed.timestamp ||
            !parsed.pdfRequest ||
            !parsed.message ||
            !parsed.nextAction
        ) {
            return null;
        }

        return parsed;
    } catch (error) {
        return null;
    }
}

/**
 * Create initial context for a session
 */
export function createConversationContext(
    sessionId: string,
    teacherId: string,
    schoolId: string,
    schoolName: string,
    teacherName: string,
    phone: string
): ConversationContext {
    return {
        sessionId,
        teacherId,
        schoolId,
        schoolName,
        teacherName,
        phone,
        currentPhase: 'initial',
        conversationStartedAt: Date.now(),
        lastInteractionAt: Date.now(),
        extractedData: null,
        confirmationStatus: null,
        messages: []
    };
}

/**
 * Add timestamped message to context
 */
export function addMessageToContext(
    context: ConversationContext,
    from: 'teacher' | 'system' | 'llm',
    content: string,
    type: 'text' | 'image' | 'action' = 'text'
): TimestampedMessage {
    const message: TimestampedMessage = {
        id: uuidv4(),
        timestamp: Date.now(),
        from,
        type,
        content,
        phase: context.currentPhase,
        actionTaken: undefined
    };

    context.messages.push(message);
    context.lastInteractionAt = Date.now();

    return message;
}