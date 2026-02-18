import { BaseTeacherAgent, GradingConfig } from '../base/BaseTeacherAgent';
import { TA_CONFIG } from '../../ai/config';
import { logger } from '../../utils/logger';
import { VisionPromptLoader } from '../../ai/vision-prompt-loader';

/**
 * Secondary Teacher Agent (TeacherAgent)
 * 
 * Serves Secondary schools (JSS 1-3, SSS 1-3) in African education systems
 * Extends BaseTeacherAgent with Secondary-specific:
 * - Grading configuration (CA1(10) + CA2(10) + Midterm(20) + Exam(60))
 * - Vision extraction prompts for 4-component marks
 * - Curriculum data (JSS/SSS class levels)
 * - Student ranking capability
 * 
 * ⚠️ IMPORTANT: Most logic moved to BaseTeacherAgent.handle()
 * This class only provides configuration and overrides school-type-specific methods
 */

export class TeacherAgent extends BaseTeacherAgent {
  
  /**
   * Get model config with TA-specific API keys (Secondary agents)
   */
  getModelConfig(): any {
    return TA_CONFIG;
  }

  /**
   * Secondary school grading configuration
   * 
   * 🚨 MANDATORY: Uses admin-defined pillars from school setup
   * NO FALLBACKS - Admin MUST provide custom grading configuration
   * Each secondary school has unique pillars (CA1+CA2+Midterm+Exam, or Project+Lab+Exam, etc.)
   */
  getGradingConfig(schoolId?: string): GradingConfig | Promise<GradingConfig> {
    // Use fluid grading from admin setup - NO DEFAULTS
    if (!schoolId) {
      throw new Error('schoolId is required to get grading config');
    }
    return this.getFluidGradingConfig(schoolId);
  }

  /**
   * Build vision extraction prompt for Secondary mark sheets
   * Loads from prompts/vision/ta-vision.md (unified vision prompt, not hardcoded)
   * The prompt auto-detects image type (marks vs attendance) and responds accordingly
   */
  buildVisionPrompt(): string {
    return VisionPromptLoader.loadAgentPrompt('ta');
  }

  /**
   * Build vision extraction prompt for Secondary attendance sheets
   * Loads from prompts/vision/ta-vision.md (same unified prompt)
   * The unified prompt handles both marks and attendance detection
   */
  buildAttendanceVisionPrompt(): string {
    return VisionPromptLoader.loadAgentPrompt('ta');
  }

  /**
   * Calculate total mark for Secondary school
   * Secondary: CA1(10) + CA2(10) + Midterm(20) + Exam(60) = 100
   */
  calculateTotal(marks: any): number {
    const ca1 = marks.ca1 || 0;
    const ca2 = marks.ca2 || 0;
    const midterm = marks.midterm || 0;
    const exam = marks.exam || 0;
    
    const total = ca1 + ca2 + midterm + exam;
    logger.debug({ ca1, ca2, midterm, exam, total }, '[TA] Total calculated (4 components)');
    return total;
  }

  /**
   * Get agent type identifier
   */
  getAgentType(): string {
    return 'secondary-ta';
  }
}