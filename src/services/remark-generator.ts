/**
 * AI Academic Remark Generator
 * Generates unique, performance-based remarks for students
 */

import { aiProvider } from '../ai/provider';
import { SA_TA_CONFIG } from '../ai/config';
import { logger } from '../utils/logger';

export interface StudentPerformance {
    name: string;
    scores: Record<string, number>;
    total: number;
    subject: string;
    classLevel: string;
    average?: number;
    position?: number;
    totalStudents?: number;
}

export class RemarkGeneratorService {
    /**
     * Generate a unique principal remark based on performance
     */
    static async generatePrincipalRemark(perf: StudentPerformance): Promise<string> {
        try {
            const prompt = `
You are a School Principal in an African school. Your task is to write a unique, encouraging, and professional closing remark for a student's terminal report card.

STUDENT DATA:
- Name: ${perf.name}
- Subject: ${perf.subject}
- Class: ${perf.classLevel}
- Total Score: ${perf.total}/100
- Position: ${perf.position || 'N/A'} of ${perf.totalStudents || 'N/A'}

GUIDELINES:
- Be specific to the score. 
- If score is >80: Commend excellence and focus.
- If score is 60-80: Encourage consistency and more effort.
- If score is <50: Be supportive but firm about the need for improvement.
- Use a professional yet warm tone.
- Keep it to 1-2 sentences.

Response must be the REMARK ONLY. No JSON, no quotes.
`;

            const res = await aiProvider.generateText(SA_TA_CONFIG, prompt);
            return res.text.trim().replace(/^"|"$/g, '');
        } catch (error) {
            logger.error({ error, student: perf.name }, 'Failed to generate remark');
            return "A fair performance. Aim higher next term.";
        }
    }

    /**
     * Batch generate remarks for a whole class
     */
    static async batchGenerateRemarks(students: StudentPerformance[]): Promise<Map<string, string>> {
        const remarks = new Map<string, string>();
        
        // In production, we might want to do this in parallel or with a single LLM call for the whole class
        // For now, sequential for simplicity and individual uniqueness
        for (const student of students) {
            const remark = await this.generatePrincipalRemark(student);
            remarks.set(student.name, remark);
        }
        
        return remarks;
    }
}
