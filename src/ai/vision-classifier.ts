/**
 * Vision Classifier Service - PASS 1 of Two-Pass Vision Strategy
 * 
 * Purpose: Quick classification of incoming images before routing to specific agents
 * Output: Document type classification to guide agent-specific deep extraction
 * 
 * Examples:
 * - "Mark Sheet" → TA/PRIMARY_TA gets classified input + full image for deep extraction
 * - "Attendance Record" → TA gets classified input + full image
 * - "Payment Receipt" → PA gets classified input + full image
 * - "General" → Agent decides if further analysis needed
 */

import { visionService } from './vision';
import { logger } from '../utils/logger';

export type DocumentClassification = 
    | 'MARK_SHEET'
    | 'ATTENDANCE_RECORD'
    | 'PAYMENT_RECEIPT'
    | 'SCHOOL_DOCUMENT'
    | 'BANK_DOCUMENT'
    | 'ID_DOCUMENT'
    | 'GENERAL'
    | 'UNKNOWN';

export interface ClassificationResult {
    classification: DocumentClassification;
    confidence: number; // 0-1
    explanation: string;
    suggestedAgent?: 'TA' | 'PA' | 'SA' | 'GA'; // Which agent should handle deep extraction
}

export class VisionClassifier {
    /**
     * PASS 1: Quick Classification
     * Uses a lightweight classification prompt to categorize the image
     * Returns fast, with minimal processing
     */
    static async classifyImage(imagePath: string): Promise<ClassificationResult> {
        try {
            logger.info({ imagePath }, '🔍 [VISION CLASSIFIER] Pass 1: Classifying image');

            // Use vision service with a lightweight classification prompt
            const classificationPrompt = `
Quickly classify this image into ONE of these categories:
- MARK_SHEET: School report card, grade sheet, mark submission
- ATTENDANCE_RECORD: Attendance register, roll call
- PAYMENT_RECEIPT: Receipt, invoice, payment proof, bank transfer
- SCHOOL_DOCUMENT: School ID, assignment, memo, official paper
- BANK_DOCUMENT: Bank statement, financial record
- ID_DOCUMENT: National ID, passport, driver's license
- GENERAL: Cannot determine or doesn't fit above

Respond STRICTLY in JSON format:
{
  "classification": "CATEGORY",
  "confidence": 0.0-1.0,
  "explanation": "one sentence why"
}
`;

            const classifyRes = await visionService.analyzeImage(imagePath, classificationPrompt);
            
            // The visionService already parses JSON and returns it in .data
            const classification = (classifyRes.data?.classification || 'UNKNOWN').toUpperCase() as DocumentClassification;
            const confidence = classifyRes.data?.confidence || 0.5;
            
            logger.info({ 
                classification, 
                confidence,
                explanation: classifyRes.data?.explanation
            }, '✅ [VISION CLASSIFIER] Classification complete');

            return {
                classification,
                confidence,
                explanation: classifyRes.data?.explanation || 'Classification complete',
                suggestedAgent: this.suggestAgent(classification)
            };
        } catch (error) {
            logger.error({ error, imagePath }, '❌ [VISION CLASSIFIER] Classification failed');
            return {
                classification: 'UNKNOWN',
                confidence: 0,
                explanation: 'Classification failed',
                suggestedAgent: undefined
            };
        }
    }

    /**
     * Suggest which agent should handle deep extraction based on classification
     */
    private static suggestAgent(classification: DocumentClassification): 'TA' | 'PA' | 'SA' | 'GA' | undefined {
        switch (classification) {
            case 'MARK_SHEET':
            case 'ATTENDANCE_RECORD':
                return 'TA'; // Teacher Agent handles educational records
            case 'PAYMENT_RECEIPT':
                return 'PA'; // Parent Agent handles payments
            case 'SCHOOL_DOCUMENT':
            case 'BANK_DOCUMENT':
                return 'SA'; // School Admin handles official documents
            default:
                return undefined; // Agent decides
        }
    }
}
