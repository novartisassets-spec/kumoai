/**
 * Base Teacher Agent
 * 
 * Shared abstract base class for Secondary Teacher Agent (TA) and Primary Teacher Agent (PrimaryTA)
 * Contains all common logic for:
 * - Setup flow (with abstract methods for school-type specifics)
 * - Image submission handling
 * - Mark confirmation
 * - Attendance recording
 * - Escalation
 * 
 * Subclasses implement school-type-specific behavior:
 * - getGradingConfig() - Return grading parameters (CA max values, rank_students, etc.)
 * - buildVisionPrompt() - Return vision extraction prompt for mark sheets
 * - calculateTotal() - Calculate total mark based on school type
 */

import { BaseAgent } from './agent';
import { RoutedMessage } from '../../core/types';
import { TAOutput, TAActionType } from '../ta/types/schema';
import { SetupTAOutput, TASetupActionType } from '../ta/types/setup_schema';
import { logger } from '../../utils/logger';
import { visionService } from '../../ai/vision';
import { pdfGenerator } from '../../services/pdf-generator';
import { AcademicRepository } from '../../db/repositories/academic.repo';
import { MarkSubmissionRepository } from '../../db/repositories/mark-submission.repo';
import { TASetupRepository } from '../../db/repositories/ta-setup.repo';
import { TeacherSessionManager } from '../../services/teacher-session';
import { SessionMemoryService } from '../../core/memory/session-memory';
import { MemoryOrchestrator } from '../../core/memory/orchestrator';
import { AuditTrailService } from '../../services/audit';
import { ErrorRecoveryService } from '../../services/error-recovery';
import { ActionAuthorizer } from '../../core/action-authorization';
import { aiProvider } from '../../ai/provider';
import { db } from '../../db';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { messenger } from '../../services/messenger';
import { PromptEngine } from '../../core/prompt-engine';
import { RobustJsonParser } from '../../core/robust-json-parser';
import { WorkloadService, SubjectStatus } from '../../services/workload.service';
import { EscalationServiceV2 } from '../../services/escalation-v2';

/**
 * Grading configuration for a school type
 */
export interface GradingPillar {
  id: string;
  name: string;
  max_score: number;
  weight?: number; // Optional weight for complex averages
}

export interface GradingConfig {
  pillars: GradingPillar[];
  total_max: number;
  rank_students: boolean;
  has_midterm?: boolean; // Kept for logic compatibility
  variant?: string;
}

export abstract class BaseTeacherAgent extends BaseAgent {
  
  /**
   * Get the model config for this agent (Groq/Gemini/etc with agent-specific API keys)
   */
  abstract getModelConfig(): any;
  
  /**
   * Get grading configuration for this agent's school type
   * Subclasses can override to provide custom config or call getFluidGradingConfig(schoolId)
   */
  abstract getGradingConfig(schoolId?: string): GradingConfig | Promise<GradingConfig>;
  
  /**
   * Build vision extraction prompt for this agent's school type
   */
  abstract buildVisionPrompt(): string;
  
  /**
   * Build vision extraction prompt for attendance sheets
   */
  abstract buildAttendanceVisionPrompt(): string;
  
  /**
   * Get dynamic grading configuration from school settings
   */
  protected async getFluidGradingConfig(schoolId: string): Promise<GradingConfig> {
    const school: any = await new Promise((resolve) => {
      db.getDB().get(`SELECT school_type, grading_config FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
    });

    // 🚨 MANDATORY: Admin MUST provide grading configuration during setup
    // NO FALLBACKS - Each school has unique pillars
    if (school?.grading_config) {
      try {
        const config = typeof school.grading_config === 'string' ? JSON.parse(school.grading_config) : school.grading_config;
        if (config.pillars && config.pillars.length > 0) {
          logger.info({ schoolId, pillars: config.pillars.length }, '✅ Using admin-defined grading pillars');
          return config;
        }
      } catch (e) {
        logger.error({ schoolId, error: e }, '❌ Failed to parse grading_config');
      }
    }

    // 🚨 NO DEFAULTS - Throw error if admin hasn't configured pillars
    logger.error({ schoolId }, '❌❌❌ CRITICAL: No grading_config found! Admin must complete setup with custom pillars.');
    throw new Error(
      `School ${schoolId} has no grading configuration. ` +
      `Admin MUST define custom grading pillars during setup (e.g., "Assignment 10, Classwork 15, Exam 60"). ` +
      `Each school has unique pillars - no fallbacks allowed.`
    );
  }

  /**
   * Universal total calculation based on pillars and optional weights
   */
  calculateTotal(marks: any, config?: GradingConfig): number {
    if (!config || !config.pillars) {
        // Legacy fallback
        return (marks.ca1 || 0) + (marks.ca2 || 0) + (marks.midterm || 0) + (marks.exam || 0);
    }

    let total = 0;
    for (const pillar of config.pillars) {
        const score = marks[pillar.id] || marks[pillar.name] || 0;
        const weight = pillar.weight || 1.0;
        total += score * weight;
    }

    return total;
  }

  /**
   * Get agent type identifier ('secondary-ta' or 'primary-ta')
   */
  abstract getAgentType(): string;

  /**
   * 🔐 PHASE 1: ROLE-BASED ACCESS CONTROL
   * Resolve teacher's role and verify authorization for action
   */
  protected async getTeacherRole(teacherPhone: string, schoolId: string): Promise<string | null> {
    try {
      // For now, assume teacher role since this agent is called by teachers
      // Role resolution can be enhanced later with database queries
      return 'teacher';
    } catch (err) {
      logger.error({ err, teacherPhone, schoolId }, '⚠️ Could not resolve teacher role');
      return null;
    }
  }
  protected async validateActionAuthorization(
    action: string,
    teacherPhone: string,
    schoolId: string
  ): Promise<{ authorized: boolean; reason?: string }> {
    const teacherRole = await this.getTeacherRole(teacherPhone, schoolId);
    
    if (!teacherRole) {
      logger.error({ 
        action, 
        teacherPhone, 
        schoolId 
      }, '🔴 SECURITY: Non-teacher attempted action');
      return {
        authorized: false,
        reason: 'Teacher role not found for this user'
      };
    }

    const auth = ActionAuthorizer.authorize(action, teacherRole as any);

    if (!auth.authorized) {
      logger.error({
        action,
        teacherPhone,
        teacherRole,
        reason: auth.reason
      }, '🔴 SECURITY: Authorization failed for action');
    }

    return auth;
  }

  /**
   * Main handler - shared logic for all teacher agents
   */
  async handle(message: RoutedMessage): Promise<TAOutput | SetupTAOutput> {
    const agentType = this.getAgentType();
    logger.info({ msgId: message.id, sessionId: message.sessionId, agentType }, `[${agentType}] handling message`);
    
    const schoolId = message.identity?.schoolId;
    if (!schoolId) {
      logger.error({ msgId: message.id, agentType }, `❌ [${agentType}] schoolId missing`);
      return { 
        agent: 'TA', 
        reply_text: 'Error: School context not established', 
        action_required: 'NONE', 
        confidence_score: 0, 
        session_active: false 
      };
    }
    
    // ✅ SYSTEM EVENT HANDLING: Escalation Resumption (Active Resume Pattern)
    const rawBody = (message as any).rawBody || message.body;
    if (rawBody?.includes('SYSTEM EVENT: ESCALATION_RESOLVED')) {
      logger.info({ escalationId: (message as any).escalation_resume_id, agentType }, `✅ [${agentType}] Escalation resumption detected - synthesizing admin decision naturally`);
      
      const adminDecisionMatch = message.body?.match(/Admin Decision:\s*([^\n]+)/);
      const adminInstructionMatch = message.body?.match(/Admin Instruction:\s*([^\n]+(?:\n(?!Admin|Original)[^\n]*)*)/);
      
      const adminDecision = adminDecisionMatch ? adminDecisionMatch[1].trim() : 'RESOLVED';
      const adminInstruction = adminInstructionMatch ? adminInstructionMatch[1].trim() : 'Your escalation has been reviewed and resolved.';
      
      // 🧠 GOD MODE: Detect proactively generated PDF path
      const pdfPathMatch = message.body?.match(/Please deliver PDF:\s*([^\n]+)/);
      const pdfPath = pdfPathMatch ? pdfPathMatch[1].trim() : null;

      logger.info({ adminDecision, adminInstruction, hasPdf: !!pdfPath }, `📋 [${agentType}] Extracted admin instruction`);
      
      const resultPayload = {
          decision: adminDecision,
          instruction: adminInstruction,
          pdf_path: pdfPath,
          original_user_message: message.body?.split('Original Message:')[1]?.trim() || 'your previous request'
      };

      // Define minimal context for synthesis
      const synthesisSystemPrompt = await PromptEngine.assemble({
          agent: 'ta',
          schoolId,
          dynamicVars: {
              teacher_name: message.identity?.name || 'Teacher',
              school_type: 'SECONDARY',
              assigned_class: 'Staff Room'
          }
      });

      const synthesized = await this.synthesizeActionResult(
          'ESCALATION_RESUMPTION',
          resultPayload,
          adminInstruction,
          `User asked: ${resultPayload.original_user_message}`,
          synthesisSystemPrompt,
          this.getModelConfig()
      );
      
      return {
        agent: 'TA',
        reply_text: synthesized,
        action_required: 'NONE',
        delivery_type: pdfPath ? 'document' : 'text',
        action_payload: pdfPath ? { pdf_path: pdfPath } : {},
        confidence_score: 0.95,
        session_active: true
      };
    }
    
    const teacherId = message.identity?.userId;
    const sessionId = message.sessionId;
    
    // ✅ CHECK IF TEACHER IS IN SETUP
    let isInSetup = false;
    if (teacherId) {
      // Trust the repository state first
      isInSetup = await TASetupRepository.isTeacherInSetup(teacherId, schoolId);
      
      // 🛡️ AUTO-INITIALIZE FALLBACK: If NOT in setup table and NOT in users table?
      // For now, we assume if isTeacherInSetup is false, they are either operational or not initialized.
      // If operational (in users table), they proceed to standard handling.
      
      if (isInSetup) {
        logger.info({ teacherId, schoolId, agentType }, `🔧 [${agentType}] Teacher in SETUP phase`);
        
        const setupOutput = await this.handleSetup(message, schoolId, teacherId);
        
        // ✅ CHECK IF SETUP IS NOW COMPLETE (marked via prompt logic)
        // If the setup output indicates completion, mark teacher as operational
        if (setupOutput.setup_status?.is_setup_complete) {
          logger.info({ teacherId, schoolId, agentType }, `🎉 [${agentType}] Setup marked complete - transitioning to operational`);
          await TASetupRepository.completeSetup(teacherId, schoolId);
          
          // No hardcoded appending here. We assume the LLM in handleSetup already generated a completion message
          // because we passed it the progress_percentage and current_step.
        }
        
        return setupOutput;
      }
    }
    
    // ✅ MEMORY MANAGEMENT
    // Use the already enriched body from the dispatcher
    const contextPrompt = message.body;
    const sessionActive = !!message.sessionId;

    // ✅ TA 2.2: Load school_type and grading context for LLM
    const schoolType = await new Promise<string>((resolve) => {
      db.getDB().get(
        `SELECT school_type FROM schools WHERE id = ?`,
        [schoolId],
        (err, row: any) => {
          resolve(row?.school_type || 'SECONDARY');
        }
      );
    });
    
    const gradingConfig = await this.getGradingConfig(schoolId);
    const sessionContextObj = TeacherSessionManager.getContext(message.from);
    const currentDraftContext = sessionContextObj?.current_mark_draft 
        ? JSON.stringify(sessionContextObj.current_mark_draft) 
        : 'None';
    
    // ✅ FACULTY AUDIT: Load class roster for prompt context (Ambiguity Shield)
    const classLevel = message.identity?.assignedClass || 'Unknown Class';
    const students = await TASetupRepository.getClassStudents(teacherId || '', schoolId, classLevel, 'current');
    const studentList = students.map(s => s.student_name).join(', ') || 'No students registered yet.';

    // ✅ PROACTIVE AMBIGUITY DETECTION
    let proactiveWarning = '';
    const bodyLower = message.body.toLowerCase();
    
    // Check if the teacher mentioned any student by FULL name
    const fullNameMatches = students.filter(s => bodyLower.includes(s.student_name.toLowerCase()));
    
    if (fullNameMatches.length === 0) {
        // No full name mentioned, check if any FIRST names are mentioned ambiguously
        for (const student of students) {
            const firstName = student.student_name.split(' ')[0].toLowerCase();
            if (firstName.length > 2 && bodyLower.includes(firstName)) {
                const duplicates = students.filter(s => s.student_name.split(' ')[0].toLowerCase() === firstName);
                if (duplicates.length > 1) {
                    proactiveWarning = `\n\n=== SYSTEM WARNING (AMBIGUITY) ===\nThe teacher mentioned "${firstName}", but we have ${duplicates.length} students with that first name: ${duplicates.map(d => d.student_name).join(', ')}. \nTASK: You MUST ask the teacher to specify the full name. DO NOT perform any database actions for "${firstName}".`;
                    break;
                }
            }
        }
    } else if (fullNameMatches.length > 1) {
        // Multiple full names? Only an issue if they overlap or are confusing
        // For now, let the LLM handle multiple students if it wants, but warn if they are similar
    }

    // ✅ TA 2.2: Load teacher's subjects for context
    const teacherSubjects: string[] = await new Promise((resolve) => {
        db.getDB().get(
            `SELECT subjects FROM broadsheet_assignments WHERE teacher_id = ? AND school_id = ? AND is_active = 1`,
            [teacherId, schoolId],
            (err, row: any) => {
                if (row?.subjects) resolve(JSON.parse(row.subjects));
                else {
                    // Fallback to setup state
                    db.getDB().get(
                        `SELECT subjects FROM ta_setup_state WHERE teacher_id = ? AND school_id = ?`,
                        [teacherId, schoolId],
                        (err2, row2: any) => {
                            if (row2?.subjects) resolve(JSON.parse(row2.subjects));
                            else resolve(['Mathematics', 'English']); // Final fallback
                        }
                    );
                }
            }
        );
    });

    const promptAgent = this.getAgentType() === 'primary-ta' ? 'primary-ta' : 'ta';

    // ✅ TA 2.3: Inject Workload Intelligence (Gap Detection)
    let workloadSummary = teacherId 
        ? await WorkloadService.getMissingWorkloadSummary(teacherId, schoolId, 'current')
        : "Teacher identity not verified.";

    let systemPrompt = await PromptEngine.assemble({
      agent: promptAgent as any,
      schoolId,
      dynamicVars: {
        teacher_name: message.identity?.name || 'Teacher',
        school_type: schoolType,
        assigned_class: classLevel,
        assigned_subjects: teacherSubjects.join(', '),
        workload_status: workloadSummary, // ✅ INJECTED BRAIN
        grading_config: JSON.stringify(gradingConfig),
        session_active: sessionActive.toString(),
        session_context: sessionActive ? 'Token-authenticated session' : 'Phone-based context',
        current_draft_context: currentDraftContext,
        student_list: studentList
      }
    });

    // ✅ FINAL REINFORCEMENT: Enforce JSON and Branding
    const finalSystemPrompt = systemPrompt; // Kept for reference, but we use systemPrompt variable now

    let finalContext = contextPrompt + proactiveWarning;

    const output: TAOutput = {
      agent: 'TA',
      reply_text: "",
      action_required: 'NONE',
      confidence_score: 0,
      session_active: true 
    };

    // Handle image submissions
    if (message.type === 'image') {
      const imageResult = await this.handleImageSubmission(message, output, schoolId, teacherId, finalContext, systemPrompt);
      
      // If we have a hardcoded error or explicit action that shouldn't be conversational, return it
      if (imageResult.reply_text && ! (message as any).system_context) {
        return imageResult;
      }
      
      // ✅ FIX: Update context if image processing added system info
      if ((message as any).system_context) {
          finalContext = `${(message as any).system_context}\n\n${finalContext}`;
      }

      // Update output with extraction metadata
      Object.assign(output, imageResult);

      // ✅ REFRESH BRAIN: Re-assemble prompt with updated workload/draft status
      if (teacherId) {
          workloadSummary = await WorkloadService.getMissingWorkloadSummary(teacherId, schoolId, 'current');
          const freshSession = TeacherSessionManager.getContext(message.from);
          const freshDraftContext = freshSession?.current_mark_draft ? JSON.stringify(freshSession.current_mark_draft) : 'None';
          
          systemPrompt = await PromptEngine.assemble({
              agent: promptAgent as any,
              schoolId,
              dynamicVars: {
                  teacher_name: message.identity?.name || 'Teacher',
                  school_type: schoolType,
                  assigned_class: classLevel,
                  assigned_subjects: teacherSubjects.join(', '),
                  workload_status: workloadSummary, // ✅ UPDATED BRAIN
                  grading_config: JSON.stringify(gradingConfig),
                  session_active: sessionActive.toString(),
                  session_context: sessionActive ? 'Token-authenticated session' : 'Phone-based context',
                  current_draft_context: freshDraftContext,
                  student_list: studentList
              }
          });
          logger.info({ teacherId }, '🧠 [TA] System Prompt refreshed with post-image state');
      }
    }

    try {
      const modelConfig = this.getModelConfig();
      // Use the potentially refreshed systemPrompt
      const aiRes = await aiProvider.generateText(modelConfig, finalContext, systemPrompt);
      
      logger.debug({ agentType, hasResponse: !!aiRes.text }, `[${agentType}] AI Response received`);
      
      const result = RobustJsonParser.parse<TAOutput>(aiRes.text);

      if (!result.success || !result.data) {
          logger.error({ agentType, raw: aiRes.text }, `[${agentType}] Failed to parse AI response`);
          output.reply_text = "I understood your request but had trouble formatting the response. Please try again or be more specific.";
          return output;
      }

      const parsed = result.data;

      output.reply_text = parsed.reply_text;
      output.action_required = parsed.action_required;
      // ✅ MERGE PAYLOAD: Preserve system data (pdf_path, etc.) from handleImageSubmission
      output.action_payload = {
          ...parsed.action_payload, // LLM data
          ...output.action_payload, // System data takes precedence (e.g. pdf_path)
      };
      output.confidence_score = parsed.confidence_score;

      // ✅ UNIVERSAL IMMEDIATE ACKNOWLEDGEMENT
      // If an action is required, send the initial "I'm on it" reply immediately to avoid latency silence.
      // We then clear output.reply_text so that the final outcome can be synthesized later.
      if (output.action_required !== 'NONE' && output.reply_text) {
          logger.info({ agentType, action: output.action_required }, `📣 [${agentType}] Intent detected - sending immediate acknowledgement`);
          await messenger.sendPush(message.from, output.reply_text);
          
          // Clear reply_text so the post-action synthesis turn generates the FINAL success/failure message
          // This prevents duplicate responses and ensures the user gets two distinct, meaningful messages.
          output.reply_text = ""; 
      }

      // 🔐 PHASE 1: MASTER AUTHORIZATION CHECK (Graceful handling)
      if (output.action_required !== 'NONE') {
        const authResult = await this.validateActionAuthorization(
          output.action_required,
          message.from,
          schoolId
        );

        if (!authResult.authorized) {
          logger.warn({ action: output.action_required, phone: message.from, agentType, reason: authResult.reason }, '🔒 Action blocked - asking LLM to handle restriction');
          
          // Re-run LLM with the rejection context to get a human-like explanation
          const rejectionInstruction = `
=== SYSTEM RESTRICTION ===
Action Blocked: ${output.action_required}
Reason: ${authResult.reason}

TASK: Explain warmly to the teacher why you can't do this yet (e.g. they need to provide their access token or setup their class first).
Keep it co-pilot-like and professional. Use JSON.`;

          const rejectionRes = await aiProvider.generateText(modelConfig, contextPrompt + "\n\n" + rejectionInstruction, systemPrompt);
          const rejParsed = RobustJsonParser.parse<TAOutput>(rejectionRes.text, 'TA_REJECTION');
          output.reply_text = rejParsed.success && rejParsed.data?.reply_text 
            ? rejParsed.data.reply_text 
            : rejectionRes.text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
          output.action_required = 'NONE';
          return output;
        }

        logger.info({
          action: output.action_required,
          teacherPhone: message.from,
          agentType
        }, '✅ [TA/PRIMARY_TA] Authorization granted - proceeding with action');
      }

      // Handle mark confirmation - when teacher says "CONFIRM" after reviewing PDF
      if (output.action_required === 'CONFIRM_MARK_SUBMISSION') {
        return await this.handleMarkConfirmation(message, output, schoolId, teacherId, contextPrompt, systemPrompt);
      }

      // ✅ ACTION HANDLER: ANALYZE_CLASS_PERFORMANCE (Broadsheet)
      if (output.action_required === 'ANALYZE_CLASS_PERFORMANCE') {
          const classLevel = (output.action_payload as any)?.class_level || message.identity?.assignedClass;
          const termId = (output.action_payload as any)?.term_id || 'current';

          if (!classLevel) {
              output.reply_text = "I need to know which class you want the broadsheet for.";
              output.action_required = 'NONE';
              return output;
          }

          try {
              const { ReportService } = await import('../../services/report-service');
              const result = await ReportService.generateBroadsheet({
                  schoolId,
                  classLevel,
                  termId,
                  generatedBy: message.identity?.name || 'Teacher'
              });

              if (result) {
                  (output as any).delivery_type = 'document';
                  (output as any).action_payload = {
                      ...output.action_payload,
                      pdf_path: result.filePath
                  };
                  logger.info({ filePath: result.filePath }, '📊 Broadsheet generated');
              } else {
                  (message as any).system_context = `SYSTEM: No confirmed marks found for ${classLevel}. Explain this to the teacher.`;
                  output.reply_text = ""; // Let LLM synthesize
              }
          } catch (err) {
              logger.error({ err }, '❌ Broadsheet generation failed');
          }
      }

      // ✅ ACTION HANDLER: GENERATE_PDF
      if (output.action_required === 'GENERATE_PDF') {
          let config = (output.action_payload as any)?.pdf_config;
          
          // 🧠 UX FLEXIBILITY: If LLM detects intent but fails to build config, infer it
          if (!config) {
              const body = message.body.toLowerCase();
              if (body.includes('report card') || body.includes('terminal')) {
                  config = { template: 'batch_report_cards', data: {} };
              } else if (body.includes('mark') || body.includes('score')) {
                  config = { template: 'marks_sheet', data: {} };
              } else if (body.includes('attendance')) {
                  config = { template: 'attendance', data: {} };
              } else if (body.includes('broadsheet')) {
                  config = { template: 'broadsheet', data: {} };
              }
          }

          if (config?.template === 'batch_report_cards') {
              try {
                  const { ReportService } = await import('../../services/report-service');
                  const classLevel = config.data?.class_level || message.identity?.assignedClass;
                  const termId = config.data?.term_id || 'current';

                  const result = await ReportService.generateBatchReports({
                      schoolId,
                      classLevel,
                      termId,
                      generateRemarks: true,
                      generatedBy: message.identity?.name || 'Teacher'
                  });

                  if (result) {
                      (output as any).delivery_type = 'document';
                      (output as any).action_payload = {
                          ...output.action_payload,
                          pdf_path: result.filePath
                      };
                      return output;
                  }
              } catch (err) {
                  logger.error({ err }, '❌ Batch reports failed');
              }
          }

          if (!config) {
              logger.warn({ teacherId, schoolId }, '⚠️ GENERATE_PDF triggered without pdf_config and could not be inferred');
          } else {
              try {
                  const schoolName = await new Promise<string>((resolve) => {
                      db.getDB().get(`SELECT name FROM schools WHERE id = ?`, [schoolId], (err, row: any) => resolve(row?.name || 'Kumo Academy'));
                  });

                  const pdfResult = await pdfGenerator.generatePDF({
                      schoolId,
                      schoolName,
                      templateType: config.template,
                      templateData: config.data || {},
                      timestamp: Date.now(),
                      generatedBy: message.identity?.name || 'TA Agent',
                      orientation: config.template === 'broadsheet' ? 'landscape' : 'portrait'
                  });

                  // 💾 PERSISTENCE: Save to database
                  const { PDFStorageRepository } = await import('../../db/repositories/pdf-storage.repo');
                  await PDFStorageRepository.storePDFDocument(
                      schoolId,
                      teacherId || 'SYSTEM',
                      config.template,
                      pdfResult.filePath,
                      pdfResult.fileName
                  );

                  (output as any).delivery_type = 'document';
                  (output as any).action_payload = {
                      ...output.action_payload,
                      pdf_path: pdfResult.filePath
                  };
                  
                  logger.info({ filePath: pdfResult.filePath }, '✅ PDF generated on-demand by LLM');
              } catch (pdfErr) {
                  logger.error({ pdfErr }, '❌ Failed to generate on-demand PDF');
              }
          }
      }

      // ✅ ACTION HANDLER: CONFIRM_ATTENDANCE_SUBMISSION
      if (output.action_required === 'CONFIRM_ATTENDANCE_SUBMISSION') {
        return await this.handleAttendanceSubmission(message, output, schoolId, teacherId, contextPrompt, systemPrompt);
      }

      // ✅ ACTION HANDLER: UPDATE_STUDENT_SCORE
      if (output.action_required === 'UPDATE_STUDENT_SCORE') {
        const payload = output.action_payload as any;
        const studentName = payload?.student_identifier || payload?.name;
        const subject = payload?.subject;
        const newScore = payload?.new_score;
        const termId = payload?.term_id || 'current';

        if (!studentName || !subject || newScore === undefined) {
            output.reply_text = "I need the student's name, the subject, and the new score to make the update.";
            output.action_required = 'NONE';
            return output;
        }

        const resolution = await this.resolveStudentIdentity(teacherId || '', schoolId, studentName, message.identity?.assignedClass || 'Unknown');
        
        if (!resolution.success) {
            (message as any).system_context = resolution.error;
            output.action_required = 'NONE';
            output.reply_text = ""; // Let LLM clarify
            return output;
        }

        const student = resolution.student!;

        // 🛡️ AMENDMENT GUARD: Check if mark is already confirmed
        const isConfirmed = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT confirmed_by_teacher FROM student_marks_indexed 
                 WHERE school_id = ? AND student_id = ? AND subject = ? AND term_id = ?`,
                [schoolId, student.student_id, subject, termId],
                (err, row: any) => resolve(row?.confirmed_by_teacher === 1)
            );
        });

        if (isConfirmed) {
            logger.info({ studentId: student.student_id, subject }, '🔒 [TA] Attempted direct update of CONFIRMED mark - Escalating to Admin');
            
            // Create escalation immediately for robustness
            const escalationId = await EscalationServiceV2.pauseForEscalation({
                origin_agent: 'TA',
                escalation_type: 'MARK_AMENDMENT',
                priority: 'HIGH',
                school_id: schoolId,
                from_phone: message.from,
                session_id: message.sessionId || `session-${Date.now()}`,
                pause_message_id: `MSG-${Date.now()}`,
                user_name: message.identity?.name,
                user_role: 'teacher',
                reason: `Teacher requested correction for a confirmed mark: ${student.student_name} (${subject}) -> ${newScore}`,
                what_agent_needed: `Teacher ${message.identity?.name || 'Staff'} wants to change ${student.student_name}'s ${payload.component || 'exam'} score in ${subject} to ${newScore}. This mark was already finalized. Do you approve?`,
                context: {
                    student_id: student.student_id,
                    student_name: student.student_name,
                    subject,
                    term_id: termId,
                    component: payload.component || 'exam',
                    new_score: newScore,
                    teacher_id: teacherId,
                    class_level: classLevel,
                    requested_decision: 'APPROVE_MARK_CORRECTION',
                    allowed_actions: ['APPROVE', 'DENY']
                }
            });
            
            logger.info({ escalationId, studentId: student.student_id, subject }, '✅ [TA] Mark amendment escalation created immediately');
            
            output.admin_escalation = {
                required: true,
                urgency: 'high',
                type: 'MARK_AMENDMENT',
                subject,
                class_level: classLevel,
                term_id: termId,
                reason: `Teacher requested correction for a confirmed mark: ${student.student_name} (${subject}) -> ${newScore}`,
                message_to_admin: `Teacher ${message.identity?.name || 'Staff'} wants to change ${student.student_name}'s ${payload.component || 'exam'} score in ${subject} to ${newScore}. This mark was already finalized. Do you approve?`,
                requested_decision: 'APPROVE_MARK_CORRECTION',
                allowed_actions: ['APPROVE', 'DENY'],
                context: {
                    student_id: student.student_id,
                    student_name: student.student_name,
                    subject,
                    term_id: termId,
                    component: payload.component || 'exam',
                    new_score: newScore,
                    teacher_id: teacherId,
                    class_level: classLevel
                },
                escalation_id: escalationId
            };

            (message as any).system_context = `SYSTEM: This mark has already been finalized and approved. I've escalated your correction request to the School Admin for their authority. I'll let you know once they've signed off!`;
            output.action_required = 'NONE';
            output.reply_text = ""; // Let LLM synthesize
            return output;
        }

        try {
            // Update the mark in the database
            // Note: AcademicRepository handles the actual DB update
            // We need to map component (ca1, ca2, midterm, exam) if provided
            const component = payload.component || 'exam'; // Default to exam if not specified
            await AcademicRepository.updateMark(
                student.student_id, 
                subject, 
                termId, 
                component, 
                newScore, 
                schoolId, 
                teacherId || 'manual', 
                student.student_name, 
                classLevel
            );
            
            const systemResult = { success: true, student_name: student.student_name, subject, new_score: newScore };
            output.reply_text = await this.synthesizeActionResult('UPDATE_STUDENT_SCORE', systemResult, output.reply_text, contextPrompt, systemPrompt, modelConfig);
            output.action_required = 'NONE';
        } catch (error) {
            logger.error({ error, studentId: student.student_id }, 'UPDATE_STUDENT_SCORE failed');
            output.reply_text = "I couldn't update the score. Please try again.";
            output.action_required = 'NONE';
        }
      }

      // ✅ ACTION HANDLER: UPDATE_TEACHER_PROFILE
      if (output.action_required as string === 'UPDATE_TEACHER_PROFILE') {
        const payload = output.action_payload as any;
        const action = payload?.action;
        let systemResult: any = { success: false };

        try {
          if (action === 'ADD' || action === 'UPDATE_DETAILS') {
            const newClass = payload?.class;
            const newName = payload?.name;
            
            await new Promise<void>((resolve, reject) => {
              let query = "UPDATE users SET ";
              const params = [];
              if (newClass) {
                query += "assigned_class = ?, ";
                params.push(newClass);
              }
              if (newName) {
                query += "name = ?, ";
                params.push(newName);
              }
              query = query.slice(0, -2) + " WHERE id = ? AND school_id = ?";
              params.push(teacherId, schoolId);

              db.getDB().run(query, params, (err) => err ? reject(err) : resolve());
            });
            systemResult = { success: true, updated: true, class: newClass, name: newName };
          } else if (action === 'REMOVE') {
            // Logic for 'removing' a class could be setting it to NULL or a default
            await new Promise<void>((resolve, reject) => {
              db.getDB().run(
                `UPDATE users SET assigned_class = 'Unknown' WHERE id = ? AND school_id = ?`,
                [teacherId, schoolId],
                (err) => err ? reject(err) : resolve()
              );
            });
            systemResult = { success: true, removed: true };
          }

          // Log the profile update
          await AuditTrailService.logAuditEvent({
            actor_phone: message.from,
            action: 'UPDATE_TEACHER_PROFILE',
            target_resource: `user:${teacherId}`,
            details: { payload, result: systemResult }
          });

          // Synthesize response
          output.reply_text = await this.synthesizeActionResult(
            'UPDATE_TEACHER_PROFILE',
            systemResult,
            output.reply_text,
            contextPrompt,
            systemPrompt,
            modelConfig
          );
          output.action_required = 'NONE';
        } catch (error) {
          logger.error({ error, teacherId }, 'UPDATE_TEACHER_PROFILE failed');
          output.reply_text = "I couldn't update your profile at the moment. Please try again.";
          output.action_required = 'NONE';
        }
      }

      // Note: Dispatcher handles creating the escalation record if admin_escalation.required is true
      
      // ✅ POST-ACTION SYNTHESIS: If reply_text is empty, call LLM to generate a natural response
      if (!output.reply_text || output.reply_text.length === 0) {
          logger.info({ agentType, action: output.action_required }, `🔄 [${agentType}] Empty reply detected - triggering synthesis turn`);
          
          let synthesisContext = finalContext;
          if ((message as any).system_context) {
              synthesisContext = `${(message as any).system_context}\n\n${finalContext}`;
          }

          const synthesisRes = await aiProvider.generateText(modelConfig, synthesisContext, finalSystemPrompt);
          const synthesisParsed = RobustJsonParser.parse<TAOutput>(synthesisRes.text);
          
          if (synthesisParsed.success && synthesisParsed.data?.reply_text) {
              output.reply_text = synthesisParsed.data.reply_text;
          } else {
              // Fallback if parsing fails or no reply_text
              output.reply_text = synthesisRes.text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
          }
      }

    } catch (error) {
      logger.error({ error, agentType }, `[${agentType}] Error in main handler`);
      output.reply_text = "I encountered an error. Please try again.";
      output.action_required = 'NONE';
    }

    return output;
  }

  /**
   * Handle setup flow - ENTIRELY LLM-DRIVEN via setup prompt
   * The LLM reads /prompts/ta_setup/base.md and main.md and handles all conversational flow
   * No hardcoded switch statements - all logic is in the prompt and LLM output
   */
  private async handleSetup(message: RoutedMessage, schoolId: string, teacherId: string): Promise<SetupTAOutput> {
    const agentType = this.getAgentType();
    logger.info({ teacherId, schoolId, agentType }, `[${agentType}] handleSetup - LLM-driven via setup prompt`);

    const setupState = await TASetupRepository.getSetupState(teacherId, schoolId);
    const currentStep = setupState?.current_step || 'WELCOME';
    const progressPercentage = this.calculateSetupProgress(currentStep);

    // ✅ TA 2.2: Load school context for setup
    const schoolRow: any = await new Promise((resolve) => {
      db.getDB().get(`SELECT name, school_type, classes_json, subjects_json FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
    });
    const schoolType = schoolRow?.school_type || 'SECONDARY';
    const schoolName = schoolRow?.name || 'Kumo Academy';
    const classesUniverse = schoolRow?.classes_json || '[]';
    const subjectsUniverse = schoolRow?.subjects_json || '[]';

    // ✅ VISION PROCESSING: Pass 2 - Deep Extraction (Teacher Setup)
    let extractedData: any = null;
    let extractionConfidence = 0;
    let visionExplanation = '';

    if (message.type === 'image' && message.mediaPath) {
      try {
        logger.info({ teacherId, schoolId, agentType }, `🔍 [${agentType} SETUP] Pass 2: Deep Extraction triggered`);
        const classification = message.extractionData?.classification;
        let specializedPrompt = undefined;
        let docTypeHint = 'attendance'; // Default for setup register

        if (classification === 'ATTENDANCE_RECORD') {
          specializedPrompt = visionService.getSpecializedPrompt('attendance-vision');
          docTypeHint = 'attendance';
        } else if (classification === 'MARK_SHEET') {
          specializedPrompt = visionService.getSpecializedPrompt('mark-sheet-vision');
          docTypeHint = 'marks_sheet';
        }

        const visionResult = await visionService.analyzeImage(message.mediaPath, specializedPrompt, docTypeHint);
        if (visionResult.success || visionResult.data) {
          extractedData = visionResult.data;
          extractionConfidence = visionResult.confidence;
          visionExplanation = `[VISION EXTRACTED] I read the document and found ${extractedData?.attendance?.length || extractedData?.students?.length || 0} items.`;
          logger.info({ teacherId, confidence: extractionConfidence, docType: docTypeHint }, `✅ [${agentType} SETUP] Deep extraction successful`);
        }
      } catch (vErr) {
        logger.error({ vErr, teacherId }, `❌ [${agentType} SETUP] Pass 2 Vision failed`);
      }
    }

    // ✅ Load accumulated setup data (like SA setup config_draft pattern)
    // Reuse existing setupState from line 882
    const configDraft = setupState?.config_draft || {};
    const extractedStudents = setupState?.extracted_students || [];
    const workloadData = setupState?.workload_json || {};
    
    logger.info({ 
      teacherId, 
      currentStep,
      draftKeys: Object.keys(configDraft),
      studentCount: extractedStudents.length,
      workloadClasses: Object.keys(workloadData)
    }, '🔄 [TA SETUP] Loading accumulated data from setup state');

    // ✅ LLM-DRIVEN SETUP: Load the setup prompt, not hardcoded handlers
    // 🚨 CRITICAL: Inject accumulated data into prompt to prevent hallucinations
    const setupPrompt = await PromptEngine.assemble({
      agent: 'ta_setup',
      schoolId,
      dynamicVars: {
        teacher_name: message.identity?.name || 'Teacher',
        current_step: currentStep,
        progress_percentage: progressPercentage.toString(),
        teacher_phone: message.from,
        agent_type: agentType,
        school_type: schoolType,
        school_name: schoolName,
        classes_universe: classesUniverse,
        subjects_universe: subjectsUniverse,
        has_vision_data: extractedData ? 'true' : 'false',
        vision_explanation: visionExplanation,
        // 🆕 INJECT ACCUMULATED DATA (like SA setup)
        extracted_students: JSON.stringify(extractedStudents),
        student_count: extractedStudents.length.toString(),
        workload_json: JSON.stringify(workloadData),
        workload_summary: Object.entries(workloadData).map(([cls, subjects]) => {
          const subjList = Array.isArray(subjects) ? subjects.join(', ') : subjects;
          return `${cls}: ${subjList}`;
        }).join('\n'),
        // 🆕 Get class from workload (TA declares their own classes, not assigned by admin)
        declared_class: Object.keys(workloadData)[0] || 'Unknown',
        config_draft: JSON.stringify(configDraft, null, 2)
      }
    });

    // Get conversation history to help LLM understand setup progress
    let contextPrompt = message.body;
    
    // 🆕 INJECT ACCUMULATED DATA INTO CONTEXT (like SA setup)
    let accumulatedContext = '';
    if (extractedStudents.length > 0) {
      accumulatedContext += `[EXTRACTED_STUDENTS]\n${JSON.stringify(extractedStudents, null, 2)}\n\n`;
    }
    if (Object.keys(workloadData).length > 0) {
      accumulatedContext += `[DECLARED_WORKLOAD]\n${JSON.stringify(workloadData, null, 2)}\n\n`;
    }
    if (Object.keys(configDraft).length > 0) {
      accumulatedContext += `[ACCUMULATED_CONFIG]\n${JSON.stringify(configDraft, null, 2)}\n\n`;
    }
    
    if (accumulatedContext) {
      contextPrompt = `${accumulatedContext}${contextPrompt}`;
      logger.info({ teacherId, contextLength: accumulatedContext.length }, '📝 [TA SETUP] Injected accumulated data into context');
    }

    // Inject vision data into context for LLM
    if (extractedData) {
      contextPrompt = `[IMAGE_EXTRACTION_DATA]\n${JSON.stringify(extractedData, null, 2)}\n\n${visionExplanation}\n\n${contextPrompt}`;
    }

    if (message.sessionId) {
      try {
        const sessionContext = await SessionMemoryService.getSessionContext(
          message.sessionId,
          message.from,
          contextPrompt, // Pass the enriched context
          10  // Last 10 messages for setup context
        );
        contextPrompt = sessionContext;
      } catch (e) {
        logger.warn({ error: e, teacherId }, 'Failed to get session context, using plain message');
      }
    }

    // ✅ Call LLM with setup prompt - LLM decides entire flow
    try {
      const modelConfig = this.getModelConfig();
      const aiRes = await aiProvider.generateText(modelConfig, contextPrompt, setupPrompt);
      
      logger.debug({ teacherId, rawText: aiRes.text }, `[${agentType}] Setup LLM Raw Response`);

      const result = RobustJsonParser.parse<SetupTAOutput>(aiRes.text);

      if (!result.success || !result.data) {
          logger.error({ teacherId, schoolId, raw: aiRes.text, parseError: result.error }, `[${agentType}] Failed to parse setup AI response`);
          return {
              agent: 'TA_SETUP',
              reply_text: 'I understood your request but had trouble formatting the response. Please try again.',
              action: 'NONE',
              setup_status: { current_step: currentStep, progress_percentage: progressPercentage, step_completed: false }
          };
      }

      const parsed = result.data;

      // 🚨 SANITIZE: Fix LLM content moderation redaction (e.g., "Primary[REDACTED_AMOUNT]")
      const sanitizeRedactedContent = (obj: any): any => {
        if (typeof obj === 'string') {
          // Extract actual class from conversation context if available
          const classMatch = contextPrompt.match(/Primary\s*(\d+)|P\s*(\d+)/i);
          const actualClass = classMatch ? `Primary ${classMatch[1] || classMatch[2]}` : null;
          
          if (obj.includes('[REDACTED_AMOUNT]') && actualClass) {
            return obj.replace(/Primary\[REDACTED_AMOUNT\]/g, actualClass)
                      .replace(/\[REDACTED_AMOUNT\]/g, '');
          }
          return obj;
        }
        if (Array.isArray(obj)) {
          return obj.map(sanitizeRedactedContent);
        }
        if (typeof obj === 'object' && obj !== null) {
          const sanitized: any = {};
          for (const key of Object.keys(obj)) {
            sanitized[key] = sanitizeRedactedContent(obj[key]);
          }
          return sanitized;
        }
        return obj;
      };

      // Sanitize the parsed response
      if (parsed.internal_payload) {
        parsed.internal_payload = sanitizeRedactedContent(parsed.internal_payload);
      }
      if (parsed.reply_text) {
        parsed.reply_text = sanitizeRedactedContent(parsed.reply_text);
      }

      logger.info({ teacherId, schoolId, action: parsed.action, payload: parsed.internal_payload }, `[${agentType}] Setup LLM output: ${parsed.action}`);

      // ═══════════════════════════════════════════════════════════════
      // STEP 1: Handle step advancement
      // ═══════════════════════════════════════════════════════════════
      // UNIFIED STEP SEQUENCE - Single source of truth
      const UNIFIED_SEQUENCE = [
        'WELCOME',
        'DECLARE_WORKLOAD', 
        'REQUEST_REGISTERS', 
        'GENERATE_PREVIEW', 
        'CONFIRM_PREVIEW', 
        'SETUP_COMPLETE'
      ];
      
      if (parsed.setup_status?.step_completed) {
          const currentStep = setupState?.current_step || 'WELCOME';
          const currentIndex = UNIFIED_SEQUENCE.indexOf(currentStep);
          
          if (currentIndex !== -1 && !setupState?.completed_steps?.includes(currentStep)) {
              const newCompleted = [...(setupState?.completed_steps || []), currentStep];
              const nextStep = UNIFIED_SEQUENCE[currentIndex + 1] || 'SETUP_COMPLETE';
              
              await TASetupRepository.updateSetup(teacherId, schoolId, { 
                  completed_steps: newCompleted, 
                  current_step: nextStep 
              });
              
              logger.info({ teacherId, completed: currentStep, next: nextStep }, '📍 TA Setup step completed and advanced');
          }
      }

      // ═══════════════════════════════════════════════════════════════
      // STEP 2: Handle data capture
      // ═══════════════════════════════════════════════════════════════
      
      // If LLM included extracted student data in payload, save it
      // ✅ God Mode: Auto-extract from vision if LLM payload is empty but vision data exists
      let extractedStudents = parsed.internal_payload?.students || parsed.internal_payload?.class_data?.students;
      
      if ((!extractedStudents || extractedStudents.length === 0) && extractedData) {
          logger.info({ teacherId }, '🧠 [SETUP] Auto-extracting students from Vision data (God Mode)');
          
          // Handle both 'attendance' and 'students' fields from vision extraction
          const visionStudents = extractedData.students || extractedData.attendance || [];
          
          if (Array.isArray(visionStudents) && visionStudents.length > 0) {
              extractedStudents = visionStudents.map((s: any) => ({
                  name: s.student_name || s.name || s.studentName || 'Unknown Student',
                  roll_number: s.roll_number || s.rollNumber || s.id || null,
                  extracted_from: 'VISION' as const
              }));
              
              logger.info({ 
                  teacherId, 
                  studentCount: extractedStudents?.length || 0,
                  source: extractedData.students ? 'students_field' : 'attendance_field'
              }, `✅ Extracted ${extractedStudents?.length || 0} students from vision data`);
          }
      }

      if (extractedStudents && extractedStudents.length > 0) {
        if (!Array.isArray(extractedStudents)) {
            logger.error({ teacherId, extractedStudents }, `❌ [${agentType} handleSetup] extractedStudents is NOT an array!`);
            throw new Error(`extractedStudents must be an array, got ${typeof extractedStudents}`);
        }

        const currentCompleted = setupState?.completed_steps || [];
        const currentStudents = setupState?.extracted_students || [];
        
        // Merge students (simple append for now, mapping table handles the real structure)
        const updatedStudents = [...currentStudents, ...extractedStudents.map((s: any) => ({
            name: s.name || s.student_name,
            roll_number: s.roll_number || null,
            class_name: parsed.internal_payload?.class_name || 'Unknown',
            extracted_from: s.extracted_from || 'VISION' as const
        }))];

        // 1. Save to setup state ONLY (draft mode - not operational yet)
        // We keep accumulating in setup state until teacher confirms everything is complete
        await TASetupRepository.updateSetup(teacherId, schoolId, {
          extracted_students: updatedStudents
        });

        logger.info({ teacherId, studentCount: extractedStudents.length, totalStudents: updatedStudents.length }, `✅ Students accumulated in setup draft`);
        
        // 🚨 DEFERRED PERSISTENCE: Don't save to operational tables yet!
        // We'll only persist to DB when teacher confirms setup is complete
        // This allows teacher to add more students, fix errors, etc.
      }

      // If LLM included subject configuration in payload, save it
      // Note: In unified flow, subjects are part of DECLARE_WORKLOAD, not separate steps
      if (parsed.internal_payload?.subjects && parsed.internal_payload.subjects.length > 0) {
        // ✅ SUBJECT RESOLUTION: Snap names to universe
        const rawSubjects = parsed.internal_payload.subjects;
        const resolvedSubjects = [];
        for (const sub of rawSubjects) {
            const { resolved } = await WorkloadService.resolveSubjectName(schoolId, sub);
            resolvedSubjects.push(resolved);
        }

        await TASetupRepository.updateSetup(teacherId, schoolId, {
          subjects: resolvedSubjects
        });
        logger.info({ teacherId, subjectCount: resolvedSubjects.length }, `✅ Subjects configured`);
      }

      // ✅ NEW: Handle Workload Declaration
      if (parsed.internal_payload?.workload) {
        const workload = parsed.internal_payload.workload;
        
        // 🚨 CRITICAL: Handle "ALL_CLASSES" expansion
        let finalWorkload: Record<string, string[] | string> = {};
        
        if (workload['ALL_CLASSES'] !== undefined) {
          // Teacher declared ALL classes - expand from school universe
          logger.info({ teacherId }, '🔄 [ALL_CLASSES] Expanding to all classes from school universe');
          
          const school: any = await new Promise((resolve) => {
            db.getDB().get(`SELECT classes_json FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
          });
          
          if (school?.classes_json) {
            try {
              const universeClasses = typeof school.classes_json === 'string' 
                ? JSON.parse(school.classes_json) 
                : school.classes_json;
              
              if (Array.isArray(universeClasses) && universeClasses.length > 0) {
                // Expand ALL_CLASSES to actual classes with subjects
                const subjectsForAll = workload['ALL_CLASSES'];
                for (const className of universeClasses) {
                  finalWorkload[className] = subjectsForAll;
                }
                logger.info({ teacherId, classCount: universeClasses.length }, `✅ [ALL_CLASSES] Expanded to ${universeClasses.length} classes`);
              } else {
                finalWorkload = workload;
              }
            } catch (e) {
              logger.error({ error: e, schoolId }, '❌ Failed to expand ALL_CLASSES');
              finalWorkload = workload;
            }
          } else {
            finalWorkload = workload;
          }
        } else {
          finalWorkload = workload;
        }
        
        // ✅ SUBJECT RESOLUTION: Snap keys (classes) and values (subjects) to universe
        const resolvedWorkload: Record<string, string[]> = {};
        let inferredType: 'PRIMARY' | 'SECONDARY' | null = null;

        for (const [classLevel, subjects] of Object.entries(finalWorkload)) {
            let subjectList: string[];
            
            // Handle "ALL" subjects for a class
            if (subjects === 'ALL') {
              // Fetch all subjects from school universe
              const school: any = await new Promise((resolve) => {
                db.getDB().get(`SELECT subjects_json FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
              });
              
              if (school?.subjects_json) {
                try {
                  const universeSubjects = typeof school.subjects_json === 'string' 
                    ? JSON.parse(school.subjects_json) 
                    : school.subjects_json;
                  subjectList = Array.isArray(universeSubjects) ? universeSubjects : [];
                  logger.info({ teacherId, classLevel, subjectCount: subjectList.length }, `✅ Expanded "ALL" to ${subjectList.length} subjects for ${classLevel}`);
                } catch (e) {
                  subjectList = [];
                }
              } else {
                subjectList = [];
              }
            } else if (Array.isArray(subjects)) {
              subjectList = subjects;
            } else {
              subjectList = [];
            }
            
            const resolvedList = [];
            for (const sub of subjectList) {
                const { resolved } = await WorkloadService.resolveSubjectName(schoolId, sub);
                resolvedList.push(resolved);
            }
            resolvedWorkload[classLevel] = resolvedList;

            // 🧠 FLUID IDENTITY: Infer school type from class names
            const upperClass = classLevel.toUpperCase();
            if (upperClass.startsWith('P') || upperClass.includes('PRIMARY') || upperClass.includes('BASIC')) {
                if (!inferredType) inferredType = 'PRIMARY';
            } else if (upperClass.includes('JS') || upperClass.includes('SS') || upperClass.includes('SENIOR') || upperClass.includes('JUNIOR')) {
                if (!inferredType) inferredType = 'SECONDARY';
            }
        }

        const currentCompleted = setupState?.completed_steps || [];
        const newCompleted = Array.from(new Set([...currentCompleted, 'DECLARE_WORKLOAD']));
        
        await TASetupRepository.updateSetup(teacherId, schoolId, {
          current_step: 'DECLARE_WORKLOAD',
          completed_steps: newCompleted,
          workload_json: resolvedWorkload
        });

        // 💾 PERSIST TYPE: Update the teacher's official role type based on workload
        if (inferredType) {
            logger.info({ teacherId, inferredType }, '🧬 [FLUID_IDENTITY] Updating teacher school_type based on workload declaration');
            await new Promise<void>((resolve) => {
                db.getDB().run(
                    `UPDATE users SET school_type = ? WHERE phone = ? AND school_id = ?`,
                    [inferredType, message.from, schoolId],
                    () => resolve()
                );
            });
        }
        
        logger.info({ teacherId, workloadKeys: Object.keys(resolvedWorkload), classCount: Object.keys(resolvedWorkload).length }, `✅ Teacher workload declared and saved`);
      }

      // ✅ AUTO-TRIGGER: Generate preview if we have both workload and students, and teacher indicates list is complete
      const setupData = await TASetupRepository.getSetupState(teacherId, schoolId);
      const hasWorkload = setupData?.workload_json && Object.keys(setupData.workload_json).length > 0;
      const hasStudents = setupData?.extracted_students && setupData.extracted_students.length > 0;
      const isListComplete = message.body?.toLowerCase().includes('yes') || 
                             message.body?.toLowerCase().includes('complete') ||
                             message.body?.toLowerCase().includes('all') ||
                             message.body?.toLowerCase().includes('that\'s it') ||
                             message.body?.toLowerCase().includes('done') ||
                             parsed.internal_payload?.generate_preview === true;

      if (hasWorkload && hasStudents && isListComplete && !setupData?.completed_steps?.includes('GENERATE_PREVIEW')) {
        const studentCount = setupData?.extracted_students?.length || 0;
        logger.info({ teacherId, studentCount }, '📄 AUTO-TRIGGER: Students extracted and list confirmed complete - generating preview PDF');
        parsed.action = 'GENERATE_PREVIEW';
        parsed.internal_payload = parsed.internal_payload || {};
        parsed.internal_payload.generate_preview = true;
      }

      // ✅ CRITICAL: Handle PDF Preview Generation
      if (parsed.action === 'GENERATE_PREVIEW' || parsed.internal_payload?.generate_preview) {
        logger.info({ teacherId, schoolId }, '📄 [GENERATE_PREVIEW] Generating setup preview PDF');
        
        try {
          // Fetch current setup data
          const setupData = await TASetupRepository.getSetupState(teacherId, schoolId);
          const workload = setupData?.workload_json || {};
          const students = setupData?.extracted_students || [];
          
          // Get teacher info
          const teacher: any = await new Promise((resolve) => {
            db.getDB().get(`SELECT name FROM users WHERE id = ?`, [teacherId], (err, row) => resolve(row));
          });
          
          // Get school info
          const school: any = await new Promise((resolve) => {
            db.getDB().get(`SELECT name FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
          });
          
          // Generate preview PDF
          const pdfPath = await this.generateSetupPreviewPDF({
            teacherName: teacher?.name || 'Teacher',
            schoolName: school?.name || 'School',
            workload: workload as Record<string, string[]>,
            students,
            outputDir: path.join(process.cwd(), 'storage', 'previews')
          });
          
          // Update setup state
          await TASetupRepository.updateSetup(teacherId, schoolId, {
            current_step: 'CONFIRM_PREVIEW',
            completed_steps: [...(setupData?.completed_steps || []), 'GENERATE_PREVIEW']
          });
          
          logger.info({ teacherId, pdfPath }, '✅ Setup preview PDF generated');
          
          // Attach PDF to response for sending (transport expects mediaPath)
          (parsed as any).mediaPath = pdfPath;
          (parsed as any).reply_text = '📋 Your Setup Summary is ready! Please review the attached PDF and confirm everything looks correct.\n\nReply "Yes, looks good" to finalize your setup, or tell me what needs to be changed.';
          
        } catch (error) {
          logger.error({ error, teacherId }, '❌ Failed to generate preview PDF');
          // Continue without PDF - let LLM handle it textually
        }
      }

      // ✅ CRITICAL: Handle Preview Confirmation
      if (parsed.action === 'CONFIRM_PREVIEW' || parsed.internal_payload?.preview_confirmed) {
        logger.info({ teacherId }, '✅ Teacher confirmed preview, ready for completion');
        
        const setupData = await TASetupRepository.getSetupState(teacherId, schoolId);
        await TASetupRepository.updateSetup(teacherId, schoolId, {
          current_step: 'SETUP_COMPLETE',
          completed_steps: [...(setupData?.completed_steps || []), 'CONFIRM_PREVIEW']
        });
      }

      // ✅ CRITICAL: Handle Setup Completion (Only after preview confirmation)
      const canCompleteSetup = parsed.setup_status?.is_setup_complete || 
                               parsed.action === 'SETUP_COMPLETE';
      
      if (canCompleteSetup) {
        logger.info({ teacherId, schoolId, agentType }, `🎉 [${agentType}] Setup completion requested`);
        
        // 🚨 VALIDATION: Check required data before allowing completion
        const setupData = await TASetupRepository.getSetupState(teacherId, schoolId);
        const validationErrors: string[] = [];
        
        // Check 1: Must have declared workload
        if (!setupData?.workload_json || Object.keys(setupData.workload_json).length === 0) {
          validationErrors.push('Workload not declared');
        }
        
        // Check 2: Must have extracted students
        const hasStudents = setupData?.extracted_students && setupData.extracted_students.length > 0;
        if (!hasStudents) {
          validationErrors.push('No students registered');
        }
        
        // Check 3: Must have confirmed preview (enforced PDF review flow)
        const hasConfirmedPreview = setupData?.completed_steps?.includes('CONFIRM_PREVIEW');
        if (!hasConfirmedPreview) {
          validationErrors.push('Setup preview not confirmed');
          
          // If we have workload and students but no preview confirmation, trigger preview generation
          if (setupData?.workload_json && hasStudents) {
            logger.info({ teacherId }, '📄 Auto-triggering preview generation before completion');
            return {
              ...parsed,
              reply_text: "Almost there! Let me prepare your setup summary for review before we finalize.",
              action: 'GENERATE_PREVIEW',
              internal_payload: {
                ...parsed.internal_payload,
                generate_preview: true
              },
              setup_status: {
                current_step: 'GENERATE_PREVIEW',
                progress_percentage: 80,
                step_completed: false,
                is_setup_complete: false
              }
            };
          }
        }
        
        // If validation fails, return error without completing
        if (validationErrors.length > 0) {
          logger.warn({ teacherId, errors: validationErrors }, '⚠️ Setup completion blocked - validation failed');
          return {
            ...parsed,
            reply_text: `Please complete the following before finishing setup:\n${validationErrors.map(e => `• ${e}`).join('\n')}`,
            action: 'NONE',
            setup_status: {
              current_step: setupData?.current_step || 'WELCOME',
              progress_percentage: progressPercentage,
              step_completed: false,
              is_setup_complete: false
            }
          };
        }
        
        // 🎉 All validations passed - complete the setup
        logger.info({ teacherId, schoolId }, `✅ All validations passed - completing setup`);
        
        // Extract and process subjects from workload
        let subjects: string[] = [];
        const workload = setupData?.workload_json || {};
        
        for (const [className, classSubjects] of Object.entries(workload)) {
          if (Array.isArray(classSubjects)) {
            classSubjects.forEach((s: string) => { if (s !== 'ALL') subjects.push(s); });
          }
        }
        subjects = [...new Set(subjects)]; // Remove duplicates
        
        // Mark all unified steps as complete
        const unifiedSteps = ['WELCOME', 'DECLARE_WORKLOAD', 'REQUEST_REGISTERS', 'GENERATE_PREVIEW', 'CONFIRM_PREVIEW'];
        await TASetupRepository.updateSetup(teacherId, schoolId, {
            completed_steps: unifiedSteps,
            current_step: 'SETUP_COMPLETE',
            subjects: subjects.length > 0 ? subjects : undefined
        });
        
        // ✅ CRITICAL: Transfer workload to operational broadsheet_assignments table
        if (setupData?.workload_json && subjects.length > 0) {
          await TASetupRepository.generateBroadsheet(teacherId, schoolId, subjects);
          logger.info({ teacherId, subjectCount: subjects.length }, '✅ Broadsheet assignments created from workload');
        }
        
        // ✅ CRITICAL: NOW persist students to operational tables (after teacher confirmation)
        // Only at SETUP_COMPLETE do we make data "real" in the system
        const finalStudents = setupData?.extracted_students || [];
        const workloadForStudents = setupData?.workload_json || {};
        const targetClass = Object.keys(workloadForStudents)[0] || 'Unknown';
        
        if (finalStudents.length > 0) {
          await TASetupRepository.saveStudentMapping(
            teacherId,
            schoolId,
            targetClass,
            'current',
            finalStudents
          );
          logger.info({ teacherId, studentCount: finalStudents.length }, '✅ Students persisted to operational tables');
        }
        
        // Mark teacher as operational
        await TASetupRepository.completeSetup(teacherId, schoolId);
        logger.info({ teacherId, schoolId }, `✅ Teacher setup completed successfully - now operational`);
      }

      return parsed;
    } catch (error) {
      logger.error({ error, teacherId, schoolId, agentType }, `[${agentType}] Setup LLM error`);
      
      return {
        agent: 'TA_SETUP',
        reply_text: 'I encountered an error. Please try again.',
        action: 'NONE',
        setup_status: {
          current_step: currentStep,
          progress_percentage: progressPercentage,
          step_completed: false,
          is_setup_complete: false
        }
      };
    }
  }

  /**
   * Calculate setup progress based on current step
   * Uses unified step sequence for consistent progress tracking
   */
  private calculateSetupProgress(step: string): number {
    const UNIFIED_STEPS = ['WELCOME', 'DECLARE_WORKLOAD', 'REQUEST_REGISTERS', 'GENERATE_PREVIEW', 'CONFIRM_PREVIEW', 'SETUP_COMPLETE'];
    const index = UNIFIED_STEPS.indexOf(step);
    if (index === -1) return 0;
    return Math.round((index / UNIFIED_STEPS.length) * 100);
  }

  /**
   * Generate secure token for teacher access
   */
  private generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Generate PDF preview of teacher setup
   * Shows workload and students in a professional tabular format
   */
  private async generateSetupPreviewPDF(params: {
    teacherName: string;
    schoolName: string;
    workload: Record<string, string[]>;
    students: any[];
    outputDir: string;
  }): Promise<string> {
    const { teacherName, schoolName, workload, students, outputDir } = params;
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `TA_SETUP_PREVIEW_${teacherName.replace(/\s+/g, '_')}_${timestamp}.pdf`;
      const filePath = path.join(outputDir, fileName);
      
      // Use the pdfGenerator to create the preview
      const { pdfGenerator } = await import('../../services/pdf-generator');
      
      // Format workload for display
      const workloadTable = Object.entries(workload).map(([className, subjects]: [string, any]) => ({
        class: className,
        subjects: Array.isArray(subjects) && subjects.length > 0
          ? subjects[0] === 'ALL' ? 'ALL Subjects' : subjects.join(', ')
          : subjects === 'ALL' ? 'ALL Subjects' : String(subjects)
      }));
      
      const result = await pdfGenerator.generatePDF({
        schoolId: 'preview',
        schoolName,
        templateType: 'teacher_setup_preview',
        templateData: {
          teacherName,
          workload: workloadTable,
          students,
          generatedAt: new Date().toLocaleString()
        },
        timestamp,
        generatedBy: 'TA Setup Wizard',
        orientation: 'portrait'
      });
      
      logger.info({ filePath: result.filePath, teacherName }, '✅ Setup preview PDF generated');
      
      return result.filePath;
    } catch (error) {
      logger.error({ error, teacherName }, '❌ Failed to generate setup preview PDF');
      throw error;
    }
  }

  /**
   * Handle image submission (shared for attendance and marks)
   */
  private async handleImageSubmission(
    message: RoutedMessage,
    output: TAOutput,
    schoolId: string,
    teacherId: string | undefined,
    contextPrompt: string,
    systemPrompt: string
  ): Promise<TAOutput> {
    const agentType = this.getAgentType();
    logger.info({ agentType }, `[${agentType}] Processing image submission`);
    
    // Support testing/fallback with pre-extracted data
    let visionResult: any = { success: !!message.extractionData, data: message.extractionData, confidence: message.extractionData?.confidence || 0.95 };

    if (message.mediaPath) {
      try {
        // ✅ VISION PASS 2: Specialized Extraction based on Pass 1 Classification
        const classification = message.extractionData?.classification;
        let specializedPrompt = undefined;
        let docTypeHint = 'marks_sheet';

        if (classification === 'ATTENDANCE_RECORD') {
          logger.info({ agentType }, '🔍 [TA] Pass 2: Using specialized attendance-vision prompt');
          specializedPrompt = visionService.getSpecializedPrompt('attendance-vision');
          docTypeHint = 'attendance';
        } else if (classification === 'MARK_SHEET') {
          logger.info({ agentType }, '🔍 [TA] Pass 2: Using specialized mark-sheet-vision prompt');
          
          // ✅ FLUID VISION: Inject current school's pillars into the prompt
          const gradingConfig = await this.getFluidGradingConfig(schoolId);
          const basePrompt = visionService.getSpecializedPrompt('mark-sheet-vision');
          
          const pillarInstructions = gradingConfig.pillars.map(p => 
            `- \`scores.${p.id}\`: Score for "${p.name}" (Limit: ${p.max_score} points)`
          ).join('\n');
          
          specializedPrompt = basePrompt.replace('{{pillar_extraction_instructions}}', pillarInstructions);
          docTypeHint = 'marks_sheet';
          
          logger.info({ 
              agentType, 
              pillarCount: gradingConfig.pillars.length 
          }, '🧬 [TA] Fluid Vision DNA injected into prompt');
        } else {
          // Fallback to old dynamic prompt building if classification is general
          specializedPrompt = this.buildVisionPrompt();
        }
        
        const realVisionResult = await visionService.analyzeImage(message.mediaPath, specializedPrompt, docTypeHint);
        if (realVisionResult.success) {
          visionResult = realVisionResult;
        } else if (!visionResult.success) {
          // If real vision fails and no pre-extracted data, use the error
          visionResult = realVisionResult;
        }
      } catch (error) {
        logger.error({ error, agentType }, `[${agentType}] Vision analysis error`);
        if (!visionResult.success) throw error;
      }
    }

    if (!visionResult.success && !message.extractionData) {
      const errorResult = { success: false, error: visionResult.error || 'Image analysis failed' };
      output.reply_text = await this.synthesizeActionResult('IMAGE_SUBMISSION_ERROR', errorResult, "I couldn't analyze the image.", contextPrompt, systemPrompt, this.getModelConfig());
      output.action_required = 'NONE';
      return output;
    }

    try {
      if (visionResult.confidence < 0.60) {
        logger.info({ confidence: visionResult.confidence }, 'Low confidence extraction - passing metadata to LLM');
        // Pass low-confidence data to LLM through escalation_payload metadata
        // LLM will see the confidence in context and decide conversationally how to proceed
        output.action_payload = {
          ...output.action_payload,
          is_low_confidence: true,
          vision_confidence: visionResult.confidence,
          escalation_payload: {
            escalation_type: 'LOW_CONFIDENCE_EXTRACTION',
            reason: `Image confidence ${(visionResult.confidence * 100).toFixed(0)}% below threshold`,
            context: {
              confidence: visionResult.confidence,
              extracted_data: visionResult.data
            }
          }
        };
      }

      const extractedData = visionResult.data;
      const docType = visionResult.data?.doc_type || 'unknown';

      if (docType === 'attendance' || extractedData?.attendance) {
        return await this.handleAttendancePhoto(message, output, schoolId, teacherId || '', extractedData, visionResult.confidence, contextPrompt, systemPrompt);
      } else if (docType === 'marks_sheet' || extractedData?.marks || extractedData?.students) {
        return await this.handleMarkSheet(message, output, schoolId, teacherId || '', extractedData, visionResult.confidence, contextPrompt, systemPrompt);
      } else {
        const errorResult = { success: false, error: 'Unknown document type', extraction: extractedData };
        output.reply_text = await this.synthesizeActionResult('IMAGE_TYPE_ERROR', errorResult, "I'm not sure what this document is.", contextPrompt, systemPrompt, this.getModelConfig());
        output.action_required = 'NONE';
      }
    } catch (error) {
      logger.error({ error, agentType }, `[${agentType}] Image processing failed`);
      const errorResult = { success: false, error: 'System error processing image' };
      output.reply_text = await this.synthesizeActionResult('IMAGE_PROCESSING_FAILED', errorResult, "System error.", contextPrompt, systemPrompt, this.getModelConfig());
      output.action_required = 'NONE';
    }

    return output;
  }

  /**
   * Handle attendance photo (shared for all teacher agents)
   */
  private async handleAttendancePhoto(
    message: RoutedMessage,
    output: TAOutput,
    schoolId: string,
    teacherId: string,
    extractedData: any,
    confidence: number,
    contextPrompt: string,
    systemPrompt: string
  ): Promise<TAOutput> {
    const attendance = extractedData.attendance || extractedData.matched_attendance;
    const markedDate = extractedData.marked_date || extractedData.date || new Date().toISOString().split('T')[0];
    const shouldEscalate = extractedData.should_escalate || false;
    const absentStudents = extractedData.absent_students || [];
    const classLevel = extractedData.class || extractedData.class_level || message.identity?.assignedClass || 'Unknown';

    if (!attendance || !Array.isArray(attendance)) {
      const errorResult = { success: false, error: 'No attendance data extracted' };
      output.reply_text = await this.synthesizeActionResult('ATTENDANCE_EXTRACTION_ERROR', errorResult, "Could not read attendance.", contextPrompt, systemPrompt, this.getModelConfig());
      output.action_required = 'NONE';
      return output;
    }

    try {
      for (const att of attendance) {
        await TASetupRepository.recordAttendance(
          teacherId,
          schoolId,
          att.student_id,
          att.student_name,
          att.present,
          markedDate,
          'current',
          classLevel
        );
      }

      await AuditTrailService.logAuditEvent({
        actor_phone: message.from,
        action: 'RECORD_ATTENDANCE',
        target_resource: `attendance:${markedDate}`,
        details: {
          teacher_id: teacherId,
          marked_date: markedDate,
          record_count: attendance.length,
          absent_count: absentStudents.length
        }
      });

      // ✅ ANY ABSENCE TRIGGERS ESCALATION (User request)
      if (absentStudents.length > 0) {
        await this.triggerAbsenceEscalation(message, output, schoolId, absentStudents, markedDate, classLevel, attendance.length);
      } else {
        output.reply_text = ""; // Let LLM generate
        (message as any).system_context = `SYSTEM: Attendance recorded for ${markedDate}. Everyone present. Acknowledge and congratulate teacher.`;
      }

    } catch (error) {
      logger.error({ error }, 'Failed to record attendance');
      output.reply_text = "I couldn't save the attendance. Please try again.";
      output.action_required = 'NONE';
    }

    return output;
  }

  /**
   * ✅ NEW: Handle attendance submission (text or confirmation)
   * Supports natural language: "Only X and Y were absent" -> marks others present
   */
  private async handleAttendanceSubmission(
    message: RoutedMessage,
    output: TAOutput,
    schoolId: string,
    teacherId: string | undefined,
    contextPrompt: string,
    systemPrompt: string
  ): Promise<TAOutput> {
    const payload = output.action_payload;
    const markedDate = payload?.marked_date || new Date().toISOString().split('T')[0];
    const classLevel = payload?.class_level || message.identity?.assignedClass || 'Unknown';
    const termId = payload?.term_id || 'current';
    
    // List of student names or IDs that are ABSENT
    const absentInput = payload?.absent_students || [];
    
    if (!teacherId) {
        output.reply_text = "I couldn't identify you. Please provide your teacher token.";
        output.action_required = 'NONE';
        return output;
    }

    try {
        // 1. Get all students in this class
        const allStudents = await TASetupRepository.getClassStudents(teacherId, schoolId, classLevel, termId);
        
        if (allStudents.length === 0) {
            output.reply_text = `I couldn't find any students registered for ${classLevel}. Have you completed your class setup?`;
            output.action_required = 'NONE';
            return output;
        }

        // 2. Resolve Identities (Ambiguity Protection)
        const resolvedAbsentees: any[] = [];
        const resolutionErrors: string[] = [];

        for (const name of absentInput) {
            const res = await this.resolveStudentIdentity(teacherId, schoolId, name, classLevel, termId);
            if (res.success) {
                resolvedAbsentees.push(res.student);
            } else {
                resolutionErrors.push(res.error!);
            }
        }

        if (resolutionErrors.length > 0) {
            (message as any).system_context = resolutionErrors.join('\n');
            output.action_required = 'NONE';
            output.reply_text = ""; // Let LLM clarify
            return output;
        }

        // 3. Map attendance (Differential logic)
        const attendanceRecords = allStudents.map(student => {
            const isAbsent = resolvedAbsentees.some(ra => ra.student_id === student.student_id);
            return {
                student_id: student.student_id,
                student_name: student.student_name,
                present: !isAbsent
            };
        });

        // 4. Save to database
        for (const record of attendanceRecords) {
            await TASetupRepository.recordAttendance(
                teacherId,
                schoolId,
                record.student_id,
                record.student_name,
                record.present,
                markedDate,
                termId,
                classLevel
            );
        }

        const absentStudents = attendanceRecords.filter(r => !r.present);

        await AuditTrailService.logAuditEvent({
            actor_phone: message.from,
            action: 'RECORD_ATTENDANCE',
            target_resource: `attendance:${markedDate}`,
            details: {
                teacher_id: teacherId,
                class_level: classLevel,
                total_students: allStudents.length,
                absent_count: absentStudents.length,
                type: 'TEXT_BASED'
            }
        });

        // 4. Trigger Escalation if absences found
        if (absentStudents.length > 0) {
            await this.triggerAbsenceEscalation(message, output, schoolId, absentStudents, markedDate, classLevel, allStudents.length);
        } else {
            output.reply_text = ""; // Let LLM generate
            (message as any).system_context = `SYSTEM: Attendance recorded for ${markedDate}. All ${allStudents.length} students marked PRESENT. Acknowledge and congratulate teacher.`;
        }

        output.action_required = 'NONE';

    } catch (error) {
        logger.error({ error }, 'Failed to process text attendance');
        output.reply_text = "I encountered an error while recording attendance. Please try again.";
        output.action_required = 'NONE';
    }

    return output;
  }

  /**
   * Shared logic to trigger absence escalation to admin
   */
  private async triggerAbsenceEscalation(
    message: RoutedMessage,
    output: TAOutput,
    schoolId: string,
    absentStudents: any[],
    markedDate: string,
    classLevel: string,
    totalCount: number
  ): Promise<void> {
    const absenteeNames = absentStudents.map((s: any) => s.student_name).join(', ');
    const absentStudentIds = absentStudents.map((s: any) => s.student_id);
    
    // Check for absence patterns (3+ absences in 30 days)
    const repeatedAbsentees = await TASetupRepository.validateAttendancePatterns(schoolId, absentStudentIds);

    // Create escalation immediately for robustness
    const escalationId = await EscalationServiceV2.pauseForEscalation({
        origin_agent: 'TA',
        escalation_type: 'ATTENDANCE_ABSENCE',
        priority: 'MEDIUM',
        school_id: schoolId,
        from_phone: message.from,
        session_id: message.sessionId || `session-${Date.now()}`,
        pause_message_id: `MSG-${Date.now()}`,
        user_name: message.identity?.name,
        user_role: 'teacher',
        reason: `Student absence detected: ${absenteeNames}`,
        what_agent_needed: `TA detected that ${absenteeNames} were absent today (${markedDate}). Should we contact the parents?`,
        context: {
            absentees: absentStudents,
            repeated_absentees: repeatedAbsentees,
            class_level: classLevel,
            marked_date: markedDate,
            requested_decision: 'Should I engage parents via PA?',
            allowed_actions: ['ENGAGE_PARENTS', 'IGNORE_FOR_NOW']
        }
    });
    
    logger.info({ escalationId, absentCount: absentStudents.length }, '✅ [TA] Absence escalation created immediately');

    output.action_payload = {
      ...output.action_payload,
      attendance_details: {
        date: markedDate,
        present_count: totalCount - absentStudents.length,
        absent_count: absentStudents.length,
        absentees: absentStudents,
        repeated_absentees: repeatedAbsentees
      }
    };

    output.admin_escalation = {
        required: true,
        urgency: 'medium',
        reason: `Student absence detected: ${absenteeNames}`,
        message_to_admin: `TA detected that ${absenteeNames} were absent today (${markedDate}). Should we contact the parents?`,
        requested_decision: 'Should I engage parents via PA?',
        allowed_actions: ['ENGAGE_PARENTS', 'IGNORE_FOR_NOW'],
        context: {
            absentees: absentStudents,
            repeated_absentees: repeatedAbsentees,
            class_level: classLevel,
            marked_date: markedDate
        },
        escalation_id: escalationId
    };
    
    // System injection for LLM to craft conversational reply
    (message as any).system_context = `SYSTEM: Attendance recorded for ${markedDate}. Absentees: ${absenteeNames}. Escalation to Admin triggered. Inform teacher and wait for admin.`;
  }

  /**
   * Handle mark sheet (shared for all teacher agents)
   */
  private async handleMarkSheet(
    message: RoutedMessage,
    output: TAOutput,
    schoolId: string,
    teacherId: string,
    extractedData: any,
    confidence: number,
    contextPrompt: string,
    systemPrompt: string
  ): Promise<TAOutput> {
    const agentType = this.getAgentType();
    const matchedMarks = extractedData.marks || extractedData.students || extractedData.matched_marks;
    const rawSubject = extractedData.subject || extractedData.subject_name;
    const classLevel = extractedData.class || extractedData.class_level || message.identity?.assignedClass;

    // ✅ SUBJECT RESOLUTION: Snap vision-extracted name to universe
    const { resolved: subject, is_new: isNewSubject } = rawSubject 
        ? await WorkloadService.resolveSubjectName(schoolId, rawSubject)
        : { resolved: undefined, is_new: false };
    
    // ✅ RESOLVE TERM: Fetch actual active term from school config
    const activeTerm = await new Promise<string>((resolve) => {
        db.getDB().get(`SELECT active_term FROM schools WHERE id = ?`, [schoolId], (err, row: any) => resolve(row?.active_term || 'current'));
    });
    
    const termId = extractedData.term_id || extractedData.term || activeTerm;

    if (!matchedMarks || !Array.isArray(matchedMarks) || matchedMarks.length === 0) {
      const errorResult = { success: false, error: 'No marks data extracted' };
      output.reply_text = await this.synthesizeActionResult('MARK_EXTRACTION_ERROR', errorResult, "Could not read marks.", contextPrompt, systemPrompt, this.getModelConfig());
      output.action_required = 'NONE';
      return output;
    }

    if (!subject || !classLevel) {
      const errorResult = { success: false, error: 'Missing subject or class', subject, class_level: classLevel };
      output.reply_text = await this.synthesizeActionResult('MARK_METADATA_ERROR', errorResult, "I need the subject and class.", contextPrompt, systemPrompt, this.getModelConfig());
      output.action_required = 'NONE';
      return output;
    }

    try {
      // ✅ FLUID GRADING: Load school-specific configuration
      const gradingConfig = await this.getFluidGradingConfig(schoolId);

      // 1. Fetch existing draft for this subject/class
      const existingDraft: any = await new Promise((resolve) => {
        db.getDB().get(
            `SELECT marks_json, raw_images_json, observed_students_json FROM academic_drafts 
             WHERE teacher_id = ? AND subject = ? AND class_level = ? AND term_id = ?`,
            [teacherId, subject, classLevel, termId],
            (err, row) => resolve(row)
        );
      });

      const mergedMarks: Record<string, any> = existingDraft ? JSON.parse(existingDraft.marks_json || '{}') : {};
      const rawImages: string[] = existingDraft ? JSON.parse(existingDraft.raw_images_json || '[]') : [];
      const observedStudents: any[] = existingDraft ? JSON.parse(existingDraft.observed_students_json || '[]') : [];

      if (message.mediaPath && !rawImages.includes(message.mediaPath)) {
          rawImages.push(message.mediaPath);
      }

      const successfulMatches: any[] = [];
      const failedMatches: string[] = [];
      const validationViolations: { name: string; error: string }[] = [];

      for (const mark of matchedMarks) {
        // 1. Resolve Identity
        const resolution = await this.resolveStudentIdentity(
            teacherId, 
            schoolId, 
            mark.student_name || mark.name, 
            classLevel, 
            termId
        );

        if (resolution.success) {
            const student = resolution.student!;
            
            // 2. Validate Grading for this specific student using Fluid Logic
            const validation = await TASetupRepository.validateGradingForSchoolType(schoolId, mark);

            if (!validation.valid) {
                logger.warn({ studentName: student.student_name, error: validation.error }, '🔴 Grading validation failed for student');
                validationViolations.push({ name: student.student_name, error: validation.error || 'Invalid grading format' });
                continue; 
            }

            const sourceScores = mark.scores || mark; 
            
            // ✅ MAX SCORE VALIDATION: Check each pillar score against its max_score
            const maxScoreViolations: string[] = [];
            for (const pillar of gradingConfig.pillars) {
                const val = sourceScores[pillar.id] || sourceScores[pillar.name];
                const scoreNum = val !== undefined ? Number(val) : 0;
                if (scoreNum > pillar.max_score) {
                    maxScoreViolations.push(`${pillar.name}: ${scoreNum}/${pillar.max_score}`);
                }
            }
            
            if (maxScoreViolations.length > 0) {
                const violationMsg = `Score exceeds max (${maxScoreViolations.join(', ')})`;
                logger.warn({ studentName: student.student_name, violations: maxScoreViolations }, '🔴 Max score validation failed');
                validationViolations.push({ name: student.student_name, error: violationMsg });
                continue;
            }
            
            const total = this.calculateTotal(sourceScores, gradingConfig);
            
            // Extract only the scores that match our pillars for the JSON storage
            const marksJson: Record<string, number> = {};
            
            for (const pillar of gradingConfig.pillars) {
                const val = sourceScores[pillar.id] || sourceScores[pillar.name];
                marksJson[pillar.id] = val !== undefined ? Number(val) : 0;
            }

            // Merge into current draft
            mergedMarks[student.student_id] = {
                student_name: student.student_name,
                marks: marksJson,
                total: total,
                updated_at: new Date().toISOString()
            };

            // Update observed students if new
            if (!observedStudents.find(s => s.id === student.student_id)) {
                observedStudents.push({ id: student.student_id, name: student.student_name });
            }

            successfulMatches.push({ ...mark, student_id: student.student_id, student_name: student.student_name, total, scores: marksJson });
        } else {
            failedMatches.push(mark.student_name || mark.name);
        }
      }

      // 2. Save/Update Draft
      const draftId = existingDraft?.id || `DRAFT-${teacherId}-${subject}-${Date.now()}`;
      const classRoster = await TASetupRepository.getClassStudents(teacherId || '', schoolId, classLevel, termId);
      const expectedStudents = classRoster.map(s => ({ id: s.student_id, name: s.student_name }));

      await new Promise<void>((resolve, reject) => {
          db.getDB().run(
              `INSERT INTO academic_drafts (id, school_id, teacher_id, subject, class_level, term_id, marks_json, raw_images_json, observed_students_json, expected_students_json, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')
               ON CONFLICT(teacher_id, subject, class_level, term_id) DO UPDATE SET
               marks_json = excluded.marks_json,
               raw_images_json = excluded.raw_images_json,
               observed_students_json = excluded.observed_students_json,
               expected_students_json = excluded.expected_students_json,
               updated_at = CURRENT_TIMESTAMP`,
              [
                  draftId, 
                  schoolId, 
                  teacherId, 
                  subject, 
                  classLevel, 
                  termId, 
                  JSON.stringify(mergedMarks), 
                  JSON.stringify(rawImages), 
                  JSON.stringify(observedStudents),
                  JSON.stringify(expectedStudents)
              ],
              (err) => {
                  if (err) {
                      logger.error({ err, draftId, teacherId, subject }, '❌ SQLite Error in handleMarkSheet');
                      reject(err);
                  } else {
                      resolve();
                  }
              }
          );
      });

      // 3. Gap Detection Logic
      const workloadStatus = await WorkloadService.getTeacherWorkloadStatus(teacherId, schoolId, termId);
      const currentSubjectStatus = workloadStatus.find(s => s.subject === subject && s.class_level === classLevel);
      
      const isComplete = currentSubjectStatus?.status === 'COMPLETED' || (currentSubjectStatus?.missing_students.length === 0);

      logger.info({ 
          draftId, 
          agentType, 
          successCount: successfulMatches.length, 
          isComplete,
          missingCount: currentSubjectStatus?.missing_students.length
      }, `[${agentType}] Draft saved and gap calculated`);

      // ✅ SYSTEM CONTEXT: Assistive behavior
      let contextMsg = `SYSTEM: Processed ${successfulMatches.length} marks for ${subject} (${classLevel}). `;
      let pdfPath = '';

      if (isComplete) {
          logger.info({ subject, classLevel }, '✅ [TA] Draft Complete - Generating Verification PDF');
          contextMsg += `✅ ALL STUDENTS FOUND! The mark list for ${subject} is now complete. `;
          contextMsg += `A verification PDF has been generated. Ask teacher to review it and reply with "Confirm" to finalize these marks.`;
          
          // ✅ GENERATE PDF PREVIEW (Only when complete)
          try {
              const schoolName = await new Promise<string>((resolve) => {
                  db.getDB().get(`SELECT name FROM schools WHERE id = ?`, [schoolId], (err, row: any) => resolve(row?.name || 'Kumo Academy'));
              });

              const pdfResult = await pdfGenerator.generatePDF({
                  schoolId,
                  schoolName,
                  templateType: 'marks_sheet',
                  templateData: {
                      title: 'FINAL MARKS VERIFICATION',
                      subject,
                      class_level: classLevel,
                      term: termId,
                      pillars: gradingConfig.pillars,
                      marks: Object.values(mergedMarks).map(m => {
                          const row: any = { student_name: m.student_name, total: m.total };
                          for (const p of gradingConfig.pillars) {
                              row[p.id] = m.marks[p.id];
                          }
                          return row;
                      }),
                      teacher_name: message.identity?.name || 'Class Teacher',
                      is_draft: false,
                      missing_count: 0
                  },
                  timestamp: Date.now(),
                  generatedBy: message.identity?.name || 'TA Agent'
              });
              pdfPath = pdfResult.filePath;
              logger.info({ pdfPath }, '✅ [TA] Verification PDF Generated Successfully');
              
              // Link PDF to draft
              await new Promise<void>((resolve) => {
                  db.getDB().run(`UPDATE academic_drafts SET verification_pdf_id = ? WHERE id = ?`, [pdfPath, draftId], () => resolve());
              });
              
          } catch (pdfErr) {
              logger.error({ pdfErr }, '❌ Failed to generate marks verification PDF');
          }

      } else {
          // ⚠️ INCOMPLETE: Hold draft, ask for more.
          const missingNames = currentSubjectStatus?.missing_students || [];
          const missingCount = missingNames.length;
          
          // 🎯 INTELLIGENT ACKNOWLEDGMENT PREP: Select students doing well to mention
          const studentsToMention = successfulMatches
              .sort((a: any, b: any) => (b.total || 0) - (a.total || 0))
              .slice(0, 3)
              .map((s: any) => s.student_name);
          
          // Detect missing pillars from submitted marks
          const submittedPillars = new Set<string>();
          for (const match of successfulMatches) {
              const scores = match.scores || match;
              for (const pillar of gradingConfig.pillars) {
                  if (scores[pillar.id] !== undefined || scores[pillar.name] !== undefined) {
                      submittedPillars.add(pillar.id);
                  }
              }
          }
          const missingPillars = gradingConfig.pillars.filter(p => !submittedPillars.has(p.id));
          
          // Build rich context for LLM to create natural acknowledgment
          contextMsg += `\n📊 DRAFT STATUS: ${successfulMatches.length} students recorded for ${subject}. `;
          contextMsg += `${missingCount} students still missing. `;
          
          if (studentsToMention.length > 0) {
              contextMsg += `\n✨ STUDENTS_DOING_WELL: ${studentsToMention.join(', ')}. `;
          }
          
          if (missingCount > 0) {
              contextMsg += `\n❌ MISSING_STUDENTS_COUNT: ${missingCount}. `;
          }
          
          if (missingPillars.length > 0) {
              const pillarNames = missingPillars.map(p => p.name).join(', ');
              contextMsg += `\n📋 MISSING_PILLARS: ${pillarNames}. `;
          }
          
          contextMsg += `\n\n💬 CONVERSATION_GUIDANCE: Acknowledge the received marks naturally. `;
          contextMsg += `Mention 2-3 students doing well by name (from STUDENTS_DOING_WELL). `;
          contextMsg += `Note that ${missingCount} students are still missing (don't list names). `;
          if (missingPillars.length > 0) {
              contextMsg += `Mention that ${missingPillars.map(p => p.name).join(', ')} scores are also needed. `;
          }
          contextMsg += `Ask teacher to send the next page or remaining marks. `;
          contextMsg += `Keep conversation friendly and natural. DO NOT list all students or all scores in reply text. `;
          contextMsg += `Full data is in the draft, only reference a few examples in conversation.`;
      }

      if (failedMatches.length > 0) {
          contextMsg += `\n⚠️ UNMATCHED NAMES: ${failedMatches.join(', ')}.`;
      }

      if (isNewSubject) {
          contextMsg += `\n⚠️ NEW SUBJECT ALERT: "${subject}" was not in the school's official list. I've added it, but please confirm if this is correct or if it was a naming error.`;
      }
      
      if (validationViolations.length > 0) {
          const violationList = validationViolations.map(v => `${v.name} (${v.error})`).join(', ');
          contextMsg += `\n⚠️ POLICY VIOLATIONS: ${violationList}.`;
      }

      (message as any).system_context = contextMsg;

      // Store draft in session context
      if (message.from) {
          TeacherSessionManager.updateContext(message.from, 'current_mark_draft', {
              draft_id: draftId,
              subject,
              class_level: classLevel,
              term_id: termId,
              is_complete: isComplete,
              pdf_path: pdfPath
          });
      }

      output.reply_text = ""; 
      output.action_required = 'NONE';
      (output as any).delivery_type = pdfPath ? 'document' : 'text';
      output.action_payload = {
        ...output.action_payload,
        draft_id: draftId,
        subject,
        class_level: classLevel,
        is_complete: isComplete,
        pdf_path: pdfPath,
        missing_students: currentSubjectStatus?.missing_students || []
      };

    } catch (error) {
      logger.error({ error, agentType }, `[${agentType}] Failed to process marks`);
      output.reply_text = "I couldn't save the marks. Please try again.";
      output.action_required = 'NONE';
    }

    return output;
  }

  /**
   * Handle attendance confirmation
   */
  private async handleAttendanceConfirmation(
    message: RoutedMessage,
    output: TAOutput,
    schoolId: string,
    teacherId: string | undefined
  ): Promise<TAOutput> {
    const attendance = output.action_payload?.matched_attendance;
    const markedDate = output.action_payload?.marked_date;
    
    if (!attendance || !markedDate) {
      output.reply_text = "I need the attendance data. Please try submitting the photo again.";
      output.action_required = 'NONE';
      return output;
    }

    try {
      for (const att of attendance) {
        await TASetupRepository.recordAttendance(
          teacherId || '',
          schoolId,
          att.student_id,
          att.student_name,
          att.present,
          markedDate,
          'current'
        );
      }

      // ✅ TRULY CONVERSATIONAL
      output.reply_text = "";
      (message as any).system_context = `SYSTEM: Attendance for ${markedDate} has been confirmed and saved to the database. Acknowledge this politely to the teacher and ask if they need anything else.`;
      
      output.action_required = 'NONE';

    } catch (error) {
      logger.error({ error }, 'Failed to confirm attendance');
      output.reply_text = "I couldn't confirm the attendance. Please try again.";
      output.action_required = 'NONE';
    }

    return output;
  }

  /**
   * Handle mark confirmation
   * When teacher confirms marks, create workflow record and escalate to admin for approval
   */
  private async handleMarkConfirmation(
    message: RoutedMessage,
    output: TAOutput,
    schoolId: string,
    teacherId: string | undefined,
    contextPrompt: string,
    systemPrompt: string
  ): Promise<TAOutput> {
    const sessionContextObj = TeacherSessionManager.getContext(message.from);
    let draftContext = sessionContextObj?.current_mark_draft;
    
    // ✅ ROBUSTNESS: If context missing from session, fetch latest DRAFT from DB
    if (!draftContext && teacherId) {
        logger.info({ teacherId, schoolId }, '🔍 [TA] Handshake context missing from session, searching DB for active draft');
        
        const dbDraft: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT id, subject, class_level, term_id FROM academic_drafts 
                 WHERE teacher_id = ? AND school_id = ? AND status = 'DRAFT' 
                 ORDER BY updated_at DESC LIMIT 1`,
                [teacherId, schoolId],
                (err, row) => resolve(row)
            );
        });

        if (dbDraft) {
            logger.info({ draftId: dbDraft.id, subject: dbDraft.subject }, '✅ [TA] Recovered draft context from DB');
            draftContext = {
                draft_id: dbDraft.id,
                subject: dbDraft.subject,
                class_level: dbDraft.class_level,
                term_id: dbDraft.term_id
            };
        }
    }

    logger.debug({ 
        from: message.from, 
        hasDraftContext: !!draftContext, 
        draftId: draftContext?.draft_id 
    }, '[TA] Confirmation context check');

    const draftId = draftContext?.draft_id;
    const subject = draftContext?.subject;
    const classLevel = draftContext?.class_level;
    const termId = draftContext?.term_id || 'current';
    
    if (!draftId || !teacherId) {
      const errorResult = { success: false, error: 'Missing draft context' };
      output.reply_text = await this.synthesizeActionResult('CONFIRM_MARK_ERROR', errorResult, "I couldn't find a pending draft to confirm.", contextPrompt, systemPrompt, this.getModelConfig());
      output.action_required = 'NONE';
      return output;
    }

    try {
      // 1. Fetch the Draft
      const draft: any = await new Promise((resolve) => {
        db.getDB().get(
            `SELECT marks_json FROM academic_drafts WHERE id = ?`,
            [draftId],
            (err, row) => resolve(row)
        );
      });

      if (!draft) {
        output.reply_text = "The mark draft seems to have expired or was already finalized. Please try uploading the sheet again.";
        output.action_required = 'NONE';
        return output;
      }

      const marks = JSON.parse(draft.marks_json || '{}');
      const studentIds = Object.keys(marks);

      // 2. Finalize to indexed table
      let indexCount = 0;
      for (const studentId of studentIds) {
          const entry = marks[studentId];
          const markId = `${studentId}-${subject}-${termId}`;

          await new Promise<void>((resolve, reject) => {
              db.getDB().run(
                  `INSERT OR REPLACE INTO student_marks_indexed 
                  (id, school_id, student_id, student_name, teacher_id, class_level, subject, term_id, marks_json, total_score, confirmed_by_teacher, status, indexed_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'CONFIRMED', CURRENT_TIMESTAMP)`,
                  [
                      markId,
                      schoolId,
                      studentId,
                      entry.student_name,
                      teacherId,
                      classLevel,
                      subject,
                      termId,
                      JSON.stringify(entry.marks),
                      entry.total
                  ],
                  (err) => {
                      if (err) reject(err);
                      else {
                          indexCount++;
                          resolve();
                      }
                  }
              );
          });
      }

      logger.info({ studentCount: indexCount, subject, classLevel }, '✅ [TA] Draft successfully indexed into official records');

      // 3. Mark Draft as COMPLETED
      await new Promise<void>((resolve) => {
          db.getDB().run(
              `UPDATE academic_drafts SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [draftId],
              () => resolve()
          );
      });

      await AuditTrailService.logAuditEvent({
          actor_phone: message.from,
          action: 'CONFIRM_MARKS',
          target_resource: `marks:${subject}:${classLevel}`,
          details: { draft_id: draftId, student_count: studentIds.length }
      });

      // ✅ AUTHORITY FLOW: Check Class Readiness
      const readiness = await WorkloadService.isClassAcademicReady(schoolId, classLevel, termId);
      
      if (readiness.ready) {
          logger.info({ classLevel }, '🚀 [AUTHORITY] Class is fully ready. Triggering Admin Escalation with Broadsheet.');
          
          const { ReportService } = await import('../../services/report-service');
          const broadsheet = await ReportService.generateBroadsheet({
              schoolId,
              classLevel,
              termId,
              generatedBy: message.identity?.name || 'Teacher'
          });

          if (broadsheet) {
              // Create escalation immediately for robustness
              const escalationId = await EscalationServiceV2.pauseForEscalation({
                  origin_agent: 'TA',
                  escalation_type: 'CLASS_RESULT_RELEASE',
                  priority: 'HIGH',
                  school_id: schoolId,
                  from_phone: message.from,
                  session_id: message.sessionId || `session-${Date.now()}`,
                  pause_message_id: `MSG-${Date.now()}`,
                  user_name: message.identity?.name,
                  user_role: 'teacher',
                  reason: `Academic results for ${classLevel} are fully confirmed and ready for release.`,
                  what_agent_needed: `Proprietor, all teachers have confirmed their marks for ${classLevel}. I have compiled the final broadsheet for your review. Should I process the terminal report cards?`,
                  context: {
                      class_level: classLevel,
                      term_id: termId,
                      pdf_path: broadsheet.filePath,
                      subject_count: readiness.confirmed_subjects.length,
                      requested_decision: 'APPROVE_CLASS_RESULTS',
                      allowed_actions: ['PROCESS_RESULT', 'REQUEST_REVISION']
                  }
              });
              
              logger.info({ escalationId, classLevel }, '✅ [TA] Class result escalation created immediately');
              
              (output as any).admin_escalation = {
                  required: true,
                  urgency: 'high',
                  type: 'CLASS_RESULT_RELEASE',
                  reason: `Academic results for ${classLevel} are fully confirmed and ready for release.`,
                  message_to_admin: `Proprietor, all teachers have confirmed their marks for ${classLevel}. I have compiled the final broadsheet for your review. Should I process the terminal report cards?`,
                  requested_decision: 'APPROVE_CLASS_RESULTS',
                  allowed_actions: ['PROCESS_RESULT', 'REQUEST_REVISION'],
                  context: {
                      class_level: classLevel,
                      term_id: termId,
                      pdf_path: broadsheet.filePath,
                      subject_count: readiness.confirmed_subjects.length
                  },
                  escalation_id: escalationId // Pass to dispatcher to prevent duplicate
              };

              (message as any).system_context = `SYSTEM: Successfully finalized ${subject}. EXCITING NEWS: The entire ${classLevel} is now ACADEMIC READY! I have sent the final broadsheet to the School Admin for their final signature. Once they approve, the report cards will be processed. Inform the teacher and celebrate!`;
          }
      } else {
          // Just a standard subject confirmation
          (message as any).system_context = `SYSTEM: Successfully finalized marks for ${studentIds.length} students in ${subject} (${classLevel}). I've updated the class record. Gaps remaining for this class: ${readiness.missing_subjects.join(', ') || 'None'}. Inform the teacher.`;
      }

      // Clear draft from session
      TeacherSessionManager.updateContext(message.from, 'current_mark_draft', null);
      
      output.reply_text = ""; // Let LLM generate
      output.action_required = 'NONE';

    } catch (error) {
      logger.error({ error, draftId }, 'Failed to confirm marks');
      output.reply_text = "I encountered an error while finalizing the marks. Please try again.";
      output.action_required = 'NONE';
    }

    return output;
  }

  /**
   * ✅ NEW: Shared Student Identity Resolver
   * Handles full name discipline and ambiguity detection
   */
  protected async resolveStudentIdentity(
    teacherId: string,
    schoolId: string,
    inputName: string,
    classLevel: string,
    termId: string = 'current'
  ): Promise<{ success: boolean; student?: any; error?: string }> {
    // 1. Fetch class roster for this specific term
    const allStudents = await TASetupRepository.getClassStudents(teacherId, schoolId, classLevel, termId);
    
    logger.debug({ 
        teacherId, 
        classLevel, 
        termId, 
        rosterSize: allStudents.length, 
        searchingFor: inputName 
    }, '🔍 [IDENTITY_RESOLVER] Checking roster');

    if (allStudents.length === 0) {
        // Fallback: Check 'current' if termId was something else
        if (termId !== 'current') {
            const fallbackStudents = await TASetupRepository.getClassStudents(teacherId, schoolId, classLevel, 'current');
            if (fallbackStudents.length > 0) {
                logger.info({ studentCount: fallbackStudents.length }, '📂 [IDENTITY_RESOLVER] Term mismatch - falling back to "current" term');
                allStudents.push(...fallbackStudents);
            }
        }
    }

    const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedInput = normalize(inputName);

    // 🎯 FUZZY MATCHING: Calculate similarity scores for all students
    const scoredMatches = allStudents.map(s => {
        const normalizedRoster = normalize(s.student_name);
        let score = 0;
        
        // Exact match (highest priority)
        if (normalizedRoster === normalizedInput) {
            score = 100;
        }
        // Contains match
        else if (normalizedRoster.includes(normalizedInput) || normalizedInput.includes(normalizedRoster)) {
            score = 80;
        }
        // Levenshtein distance for typos (vision extraction errors)
        else {
            const distance = this.levenshteinDistance(normalizedRoster, normalizedInput);
            const maxLen = Math.max(normalizedRoster.length, normalizedInput.length);
            const similarity = ((maxLen - distance) / maxLen) * 100;
            
            // Only consider if similarity is high enough (typo tolerance)
            if (similarity >= 70) {
                score = similarity;
            }
        }
        
        return { student: s, score };
    }).filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);

    // Get best matches (score >= 70)
    const bestMatches = scoredMatches.filter(m => m.score >= 70);

    if (bestMatches.length === 0) {
        logger.warn({ inputName, classLevel, termId }, '🔍 [IDENTITY_RESOLVER] No fuzzy match found');
        return {
            success: false,
            error: `SYSTEM: Student "${inputName}" not found in ${classLevel} (Term: ${termId}). TASK: Inform teacher and ask for the full name or check if the student is registered.`
        };
    }

    // Check for ambiguity (multiple high-confidence matches)
    if (bestMatches.length > 1 && (bestMatches[0].score - bestMatches[1].score) < 10) {
        const topMatches = bestMatches.slice(0, 3);
        logger.warn({ inputName, matches: topMatches.map(m => m.student.student_name) }, '🔍 [IDENTITY_RESOLVER] Ambiguous match');
        return {
            success: false,
            error: `SYSTEM: Ambiguity detected. "${inputName}" could be: ${topMatches.map(m => m.student.student_name).join(', ')}. TASK: Ask teacher which exact student they mean.`
        };
    }

    // Return best match
    const bestMatch = bestMatches[0];
    logger.info({ 
        inputName, 
        matchedName: bestMatch.student.student_name, 
        score: bestMatch.score 
    }, '✅ [IDENTITY_RESOLVER] Fuzzy match successful');
    
    return { success: true, student: bestMatch.student };
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Used for fuzzy matching to correct vision spelling errors
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    
    // Create distance matrix
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // Initialize base cases
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    // Fill the matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,      // deletion
                    dp[i][j - 1] + 1,      // insertion
                    dp[i - 1][j - 1] + 1   // substitution
                );
            }
        }
    }
    
    return dp[m][n];
  }
}
