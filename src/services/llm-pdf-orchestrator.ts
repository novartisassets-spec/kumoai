/**
 * LLM PDF Orchestration Service
 * Coordinates between TA agent, LLM Claude, and PDF generator
 * Maintains conversation context and ensures consistent, timestamped interactions
 */

import {
    ConversationContext,
    ExtractedData,
    LLMPDFInstruction,
    LLMInstructionResponse,
    buildLLMPDFPrompt,
    parseLLMPDFInstruction,
    createConversationContext,
    addMessageToContext
} from '../core/llm-pdf-protocol';
import { pdfGenerator, PDFGenerationRequest, PDFGenerationResponse } from './pdf-generator';
import { aiProvider } from '../ai/provider';
import { logger } from '../utils/logger';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { TeacherSessionManager } from './teacher-session';

export class LLMPDFOrchestrator {
    /**
     * Initialize session context
     */
    initializeSession(
        sessionId: string,
        teacherId: string,
        schoolId: string,
        schoolName: string,
        teacherName: string,
        phone: string
    ): ConversationContext {
        const context = createConversationContext(sessionId, teacherId, schoolId, schoolName, teacherName, phone);
        
        // Use TeacherSessionManager for storage
        TeacherSessionManager.updateContext(phone, 'pdf_orchestrator', context);

        addMessageToContext(
            context,
            'system',
            `Session started for ${teacherName} at ${new Date(context.conversationStartedAt).toLocaleString()}`,
            'action'
        );

        logger.info(
            { sessionId, teacherId, schoolId, teacherName },
            '🎯 LLM PDF Orchestration session initialized'
        );

        return context;
    }

    /**
     * Get context for session via phone
     */
    getContext(phone: string): ConversationContext | null {
        const sessionContext = TeacherSessionManager.getContext(phone);
        return sessionContext?.pdf_orchestrator || null;
    }

    /**
     * Save context back to session
     */
    private saveContext(phone: string, context: ConversationContext): void {
        TeacherSessionManager.updateContext(phone, 'pdf_orchestrator', context);
    }

    /**
     * Process teacher submission with LLM and generate PDF instruction
     */
    async processSubmissionWithLLM(
        phone: string,
        extractedData: ExtractedData | null,
        teacherMessage?: string
    ): Promise<{
        instruction: LLMPDFInstruction | null;
        context: ConversationContext | null;
        error?: string;
    }> {
        const context = this.getContext(phone);
        if (!context) {
            return {
                instruction: null,
                context: null,
                error: 'Session context not found'
            };
        }

        try {
            // Add teacher's message to context
            if (teacherMessage) {
                addMessageToContext(context, 'teacher', teacherMessage);
            }

            // Update context with extracted data if provided
            if (extractedData) {
                // Merge or replace
                if (context.extractedData && context.extractedData.type === extractedData.type) {
                    logger.debug({ phone, type: extractedData.type }, 'Merging new extraction into existing context');
                    context.extractedData = { ...context.extractedData, ...extractedData };
                } else {
                    context.extractedData = extractedData;
                }
                
                addMessageToContext(
                    context,
                    'system',
                    `Data processed: ${extractedData.type} with ${extractedData.extractionConfidence * 100}% confidence`,
                    'action'
                );
            }

            context.currentPhase = 'confirmation';
            context.lastInteractionAt = Date.now();

            // Build prompt for LLM (Claude/Gemini/Groq)
            const prompt = buildLLMPDFPrompt(context, context.extractedData!);

            logger.debug(
                { phone, dataType: context.extractedData?.type },
                '🧠 Sending current draft to LLM for PDF instruction generation'
            );

            // Call LLM with context-aware prompt
            const { TA_CONFIG } = await import('../ai/config');
            const response = await aiProvider.generateText(
                TA_CONFIG,
                prompt,
                'You are OPHIREX, an intelligent teaching assistant. Output ONLY valid JSON instructions for PDF generation. Support holistic African terminal reports (remarks, traits).'
            );
            
            const llmResponse = response.text;
            
            // Parse LLM response
            const instruction = parseLLMPDFInstruction(llmResponse);
            if (!instruction) {
                logger.warn({ phone, response: llmResponse }, '⚠️ Failed to parse LLM PDF instruction');
                return {
                    instruction: null,
                    context,
                    error: 'Invalid LLM response format'
                };
            }

            // Update the draft in context if the LLM provided modified data in the instruction
            if (instruction.pdfRequest.data) {
                this.updateDraftFromInstruction(context, instruction);
            }

            // Record LLM instruction in context
            addMessageToContext(
                context,
                'llm',
                `Instruction generated: ${instruction.nextAction.type} - ${instruction.message.text.substring(0, 100)}...`,
                'action'
            );

            // Save updated context
            this.saveContext(phone, context);

            return {
                instruction,
                context,
                error: undefined
            };
        } catch (error) {
            logger.error({ phone, error }, '❌ LLM processing failed');
            return {
                instruction: null,
                context,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Update the local draft (ExtractedData) based on LLM instruction
     */
    private updateDraftFromInstruction(context: ConversationContext, instruction: LLMPDFInstruction): void {
        if (!context.extractedData) return;

        const data = instruction.pdfRequest.data;

        if ((context.extractedData.type === 'marks' || instruction.pdfRequest.templateType === 'batch_report_cards') && data.marks) {
            context.extractedData.marks = {
                ...context.extractedData.marks!,
                marks: data.marks,
                subject: data.subject || context.extractedData.marks?.subject,
                classLevel: data.class_level || context.extractedData.marks?.classLevel,
                traits: data.traits || context.extractedData.marks?.traits,
                comments: data.comments || context.extractedData.marks?.comments
            };
        } else if (context.extractedData.type === 'attendance' && data.students) {
            context.extractedData.attendance = {
                ...context.extractedData.attendance!,
                students: data.students,
                classLevel: data.class_level || context.extractedData.attendance?.classLevel,
                markedDate: data.marked_date || context.extractedData.attendance?.markedDate
            };
        }
    }

    /**
     * Execute LLM instruction: Generate PDF and prepare response
     */
    async executeLLMInstruction(
        phone: string,
        instruction: LLMPDFInstruction
    ): Promise<LLMInstructionResponse> {
        const context = this.getContext(phone);
        if (!context) {
            return {
                instructionId: instruction.instructionId,
                timestamp: Date.now(),
                status: 'failed',
                messageSent: false,
                errors: ['Session context not found']
            };
        }

        const response: LLMInstructionResponse = {
            instructionId: instruction.instructionId,
            timestamp: Date.now(),
            status: 'pending',
            messageSent: false
        };

        try {
            // Generate PDF from instruction
            const pdfRequest: PDFGenerationRequest = {
                schoolId: context.schoolId,
                schoolName: context.schoolName,
                templateType: instruction.pdfRequest.templateType,
                templateData: instruction.pdfRequest.data,
                timestamp: instruction.timestamp,
                generatedBy: context.teacherName,
                documentId: uuidv4()
            };

            logger.info(
                {
                    instructionId: instruction.instructionId,
                    templateType: instruction.pdfRequest.templateType,
                    phone
                },
                '📄 Generating PDF from LLM instruction'
            );

            const pdfResult = await pdfGenerator.generatePDF(pdfRequest);

            response.pdf = {
                documentId: pdfResult.documentId,
                fileName: pdfResult.fileName,
                filePath: pdfResult.filePath,
                mimeType: pdfResult.mimeType,
                generatedAt: pdfResult.generatedAt
            };

            // Store PDF metadata in database for audit trail
            await this.storePDFMetadata(phone, pdfResult, instruction);

            // Update response status
            response.status = 'executed';
            response.messageSent = true; 

            // Record execution in context
            addMessageToContext(
                context,
                'system',
                `PDF generated: ${pdfResult.fileName} | Message: "${instruction.message.text}"`,
                'action'
            );

            // Save updated context
            this.saveContext(phone, context);

            logger.info(
                {
                    instructionId: instruction.instructionId,
                    documentId: pdfResult.documentId,
                    phone
                },
                '✅ LLM instruction executed successfully'
            );

            return response;
        } catch (error) {
            logger.error(
                { instructionId: instruction.instructionId, phone, error },
                '❌ LLM instruction execution failed'
            );

            response.status = 'failed';
            response.errors = [error instanceof Error ? error.message : 'Unknown error'];
            return response;
        }
    }

    /**
     * Handle teacher response to LLM instruction
     */
    async handleTeacherResponse(
        phone: string,
        instructionId: string,
        responseType: 'approval' | 'correction' | 'rejection' | 'skip',
        content: string,
        confidence?: number
    ): Promise<{
        nextInstruction?: LLMPDFInstruction;
        context?: ConversationContext;
        error?: string;
    }> {
        const context = this.getContext(phone);
        if (!context) {
            return { error: 'Session context not found' };
        }

        try {
            // Record teacher response with timestamp
            addMessageToContext(context, 'teacher', `Response [${responseType}]: ${content}`);

            context.lastInteractionAt = Date.now();

            logger.info(
                {
                    phone,
                    instructionId,
                    responseType,
                    timestamp: new Date(context.lastInteractionAt).toLocaleString()
                },
                `👨‍🏫 Teacher responded to instruction`
            );

            // Update confirmation status based on response
            if (responseType === 'approval') {
                context.confirmationStatus = 'confirmed';
                context.currentPhase = 'submission';
            } else if (responseType === 'rejection') {
                context.confirmationStatus = 'rejected';
                context.currentPhase = 'extraction'; // Start over
            } else if (responseType === 'correction') {
                context.confirmationStatus = null;
                context.currentPhase = 'confirmation';
            }

            // Save context
            this.saveContext(phone, context);

            // If teacher requests correction, we need to process again
            if (responseType === 'correction' && context.extractedData) {
                const result = await this.processSubmissionWithLLM(phone, context.extractedData, content);
                return {
                    nextInstruction: result.instruction ?? undefined,
                    context: result.context ?? undefined,
                    error: result.error
                };
            }

            return { context };
        } catch (error) {
            logger.error({ phone, instructionId, error }, '❌ Failed to handle teacher response');
            return {
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Store PDF metadata in database for audit trail
     */
    private async storePDFMetadata(
        phone: string,
        pdfResult: PDFGenerationResponse,
        instruction: LLMPDFInstruction
    ): Promise<void> {
        const context = this.getContext(phone);
        if (!context) return;

        return new Promise((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO pdf_generation_audit (
                    document_id, session_id, school_id, teacher_id, 
                    template_type, file_path, file_name,
                    llm_instruction_id, confidence_level,
                    generated_at, reasoning
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    pdfResult.documentId,
                    context.sessionId,
                    context.schoolId,
                    context.teacherId,
                    instruction.pdfRequest.templateType,
                    pdfResult.filePath,
                    pdfResult.fileName,
                    instruction.instructionId,
                    instruction.context.confidenceLevel,
                    pdfResult.generatedAt,
                    instruction.reasoning
                ],
                (err) => {
                    if (err) {
                        logger.warn({ phone, error: err }, '⚠️ Failed to store PDF metadata');
                        resolve(); 
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Get full conversation history for a session
     */
    getConversationHistory(phone: string): any[] | null {
        const context = this.getContext(phone);
        if (!context) return null;

        return context.messages.map((msg: any) => ({
            timestamp: new Date(msg.timestamp).toISOString(),
            from: msg.from,
            type: msg.type,
            phase: msg.phase,
            content: msg.content.substring(0, 200) 
        }));
    }

    /**
     * Get session summary for debugging/analytics
     */
    getSessionSummary(phone: string): any | null {
        const context = this.getContext(phone);
        if (!context) return null;

        const duration = context.lastInteractionAt - context.conversationStartedAt;
        const durationMinutes = Math.round(duration / 1000 / 60);

        return {
            phone,
            teacher: context.teacherName,
            school: context.schoolName,
            startTime: new Date(context.conversationStartedAt).toISOString(),
            lastInteraction: new Date(context.lastInteractionAt).toISOString(),
            duration: `${durationMinutes} minutes`,
            currentPhase: context.currentPhase,
            confirmationStatus: context.confirmationStatus,
            dataType: context.extractedData?.type || 'none',
            messageCount: context.messages.length,
            confidence: context.extractedData ? `${(context.extractedData.extractionConfidence * 100).toFixed(1)}%` : 'N/A'
        };
    }
}

// Singleton instance
export const llmPDFOrchestrator = new LLMPDFOrchestrator();
