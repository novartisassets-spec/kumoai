/**
 * Primary Teacher Agent (PrimaryTA)
 * 
 * Serves Primary schools (P1-P6) in African education systems
 * Extends BaseTeacherAgent with Primary-specific:
 * - Grading configuration (CA1(20) + CA2(20) + Exam(60))
 * - Vision extraction prompts for 3-component marks
 * - Curriculum data (P1-P6 class levels)
 * - Simplified setup flow (no ranking, no midterm)
 */

import { BaseTeacherAgent, GradingConfig } from '../base/BaseTeacherAgent';
import { PRIMARY_TA_CONFIG } from '../../ai/config';
import { logger } from '../../utils/logger';
import { VisionPromptLoader } from '../../ai/vision-prompt-loader';

export class PrimaryTeacherAgent extends BaseTeacherAgent {
  
  /**
   * Get model config with PRIMARY_TA-specific API keys
   * Uses centralized config from src/ai/config.ts
   */
  getModelConfig(): any {
    return PRIMARY_TA_CONFIG;
  }

  /**
   * Primary school grading configuration
   * 
   * 🚨 MANDATORY: Uses admin-defined pillars from school setup
   * NO FALLBACKS - Admin MUST provide custom grading configuration
   * Each primary school has unique pillars (CA1+CA2+Exam, or Assignment+Classwork+Exam, etc.)
   */
  getGradingConfig(schoolId?: string): GradingConfig | Promise<GradingConfig> {
    // Use fluid grading from admin setup - NO DEFAULTS
    if (!schoolId) {
      throw new Error('schoolId is required to get grading config');
    }
    return this.getFluidGradingConfig(schoolId);
  }

  /**
   * Build vision extraction prompt for Primary mark sheets
   * Loads from prompts/vision/primary-ta-vision.md (unified vision prompt, not hardcoded)
   * The prompt auto-detects image type (marks vs attendance) and responds accordingly
   */
  buildVisionPrompt(): string {
    return VisionPromptLoader.loadAgentPrompt('primary-ta');
  }

  /**
   * Build vision extraction prompt for Primary attendance sheets
   * Loads from prompts/vision/primary-ta-vision.md (same unified prompt)
   * The unified prompt handles both marks and attendance detection
   */
  buildAttendanceVisionPrompt(): string {
    return VisionPromptLoader.loadAgentPrompt('primary-ta');
  }

  /**
   * Calculate total mark for Primary school
   * 
   * Primary: CA1(20) + CA2(20) + Exam(60) = 100
   * No midterm component
   */
  calculateTotal(marks: any): number {
    const ca1 = marks.ca1 || 0;
    const ca2 = marks.ca2 || 0;
    const exam = marks.exam || 0;
    
    // ✅ Do NOT include midterm for Primary
    const total = ca1 + ca2 + exam;
    
    logger.debug({ ca1, ca2, exam, total }, '[PrimaryTA] Total calculated (3 components)');
    
    return total;
  }

  /**
   * Get agent type identifier
   */
  getAgentType(): string {
    return 'primary-ta';
  }
}