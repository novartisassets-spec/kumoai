import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

import { ENV } from '../config/env';

export interface VisionResult {
    success: boolean;
    data?: any;
    confidence: number;
    error?: string;
    docType?: string;
    isLowConfidence?: boolean;
}

export class VisionService {
    private apiKeys: string[];
    private currentKeyIndex: number;
    private masterPrompt: string;
    private readonly CONFIDENCE_THRESHOLD = 0.60; // Ideal confidence for seamless processing
    private readonly MIN_CONFIDENCE_FLOOR = 0.30; // Absolute minimum to even try processing

    constructor() {
        // Support multiple API keys for fallback
        this.apiKeys = [
            ENV.GEMINI_VISION_API_KEY || ENV.SA_GEMINI_API_KEY,
            ENV.GEMINI_VISION_API_KEY_2,
            ENV.GEMINI_VISION_API_KEY_3
        ].filter(Boolean); // Remove empty/undefined keys
        
        this.currentKeyIndex = 0;
        
        const promptPath = path.join(process.cwd(), 'prompts', 'vision', 'master.md');
        this.masterPrompt = fs.existsSync(promptPath) 
            ? fs.readFileSync(promptPath, 'utf-8') 
            : 'Analyze this image and extract school-related data in JSON format. Provide extraction_confidence as a number 0-1.';
    }
    
    private getCurrentApiKey(): string {
        return this.apiKeys[this.currentKeyIndex] || this.apiKeys[0];
    }
    
    private switchToNextApiKey(): boolean {
        if (this.currentKeyIndex < this.apiKeys.length - 1) {
            this.currentKeyIndex++;
            logger.info({ keyIndex: this.currentKeyIndex }, '🔄 Switching to fallback vision API key');
            return true;
        }
        return false;
    }

    /**
     * Load a specialized vision prompt from disk
     */
    public getSpecializedPrompt(name: string): string {
        const promptPath = path.join(process.cwd(), 'prompts', 'vision', `${name}.md`);
        if (fs.existsSync(promptPath)) {
            return fs.readFileSync(promptPath, 'utf-8');
        }
        logger.warn({ name }, '⚠️ Specialized vision prompt not found, using master');
        return this.masterPrompt;
    }

    async analyzeImage(imagePath: string, customPrompt?: string, documentType: string = 'general'): Promise<VisionResult> {
        // Validate image exists
        if (!fs.existsSync(imagePath)) {
            logger.error({ imagePath }, 'Image file not found');
            return {
                success: false,
                confidence: 0,
                error: 'Image file not found or inaccessible'
            };
        }

        // Check file size (prevent excessively large images)
        const stats = fs.statSync(imagePath);
        if (stats.size > 25 * 1024 * 1024) { // 25MB limit
            logger.warn({ imagePath, size: stats.size }, 'Image exceeds size limit');
            return {
                success: false,
                confidence: 0,
                error: 'Image file is too large. Please provide a smaller image.'
            };
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const imageBase64 = imageBuffer.toString('base64');
        const mimeType = this.getMimeType(imagePath);
        const prompt = customPrompt || this.masterPrompt;
        const modelName = ENV.GEMINI_MODEL_VISION || 'gemini-2.0-flash';

        // Try each API key in sequence (fallback mechanism)
        let lastError: any;
        
        for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
            const currentKey = this.getCurrentApiKey();
            
            if (!currentKey) {
                logger.error({ attempt }, 'No API key available for vision');
                break;
            }
            
            logger.info({ 
                modelName, 
                documentType, 
                attempt: attempt + 1,
                totalKeys: this.apiKeys.length 
            }, 'Initiating Vision Analysis');
            
            try {
                const genAI = new GoogleGenerativeAI(currentKey);
                const model = genAI.getGenerativeModel({ model: modelName });

                const result = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: imageBase64,
                            mimeType: mimeType
                        }
                    }
                ]);

                const text = result.response.text();
                
                // Robust JSON extraction
                const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                let parsed: any;
                
                try {
                    parsed = JSON.parse(cleanedText);
                } catch (parseError) {
                    logger.error({ parseError, text: cleanedText.substring(0, 200) }, 'Failed to parse vision response as JSON');
                    return {
                        success: false,
                        confidence: 0,
                        error: 'Vision API returned invalid JSON. Image may be unclear or wrong document type.',
                        docType: documentType
                    };
                }

            // Extract confidence score
            const confidence = this.normalizeConfidence(parsed.extraction_confidence);
            const docType = parsed.doc_type || documentType;

            logger.info({ docType, confidence, threshold: this.CONFIDENCE_THRESHOLD }, 'Vision analysis completed');

            // 🚨 CRITICAL: Log what was actually extracted
            const extractedData = parsed.extracted_data || parsed;
            logger.info({
                docType,
                confidence,
                hasData: !!extractedData,
                extractedKeys: Object.keys(extractedData || {}),
                hasName: !!(extractedData as any)?.name || !!(extractedData as any)?.school_name,
                hasAddress: !!(extractedData as any)?.address,
                hasPhone: !!(extractedData as any)?.phone,
                hasTerms: !!(extractedData as any)?.terms?.length,
                termCount: (extractedData as any)?.terms?.length || 0,
                hasGrading: !!(extractedData as any)?.grading_scale || !!(extractedData as any)?.ca_percentage || !!(extractedData as any)?.grading_policy,
                hasFees: !!(extractedData as any)?.tuition || !!(extractedData as any)?.additional_fees,
                hasTeachers: !!(extractedData as any)?.teachers?.length,
                teacherCount: (extractedData as any)?.teachers?.length || 0,
                fullExtractedData: JSON.stringify(extractedData, null, 2)
            }, '🔍 [VISION] ACTUAL EXTRACTED DATA');

            // Optimistic Data Handling: We return data even if confidence is low,
            // but we flag it so agents can be cautious.
            const isLowConfidence = confidence < this.CONFIDENCE_THRESHOLD;

            if (confidence < this.MIN_CONFIDENCE_FLOOR) {
                logger.warn({ documentType: docType, confidence }, `Confidence below absolute floor (${this.MIN_CONFIDENCE_FLOOR}). Data may be garbage.`);
                return {
                    success: false,
                    confidence: confidence,
                    docType: docType,
                    error: `Image quality too low for processing (confidence: ${(confidence * 100).toFixed(0)}%). Please provide a clearer image.`,
                    data: extractedData
                };
            }

            return {
                success: true,
                data: extractedData,
                confidence: confidence,
                docType: docType,
                isLowConfidence
            };

            } catch (error: any) {
                lastError = error;
                logger.warn({ 
                    error: error.message, 
                    attempt: attempt + 1,
                    totalKeys: this.apiKeys.length 
                }, 'Vision API call failed, trying fallback key...');
                
                // Try next API key if available
                if (this.switchToNextApiKey()) {
                    continue;
                }
                
                // No more keys to try
                break;
            }
        }
        
        // All API keys failed
        logger.error({ error: lastError?.message, imagePath, code: lastError?.code }, 'All vision API keys failed');
        
        let userMessage = 'Failed to process the image. Please try again.';
        if (lastError?.message?.includes('model not found')) {
            userMessage = 'Vision processing is currently unavailable. Please try again later.';
        } else if (lastError?.message?.includes('rate') || lastError?.message?.includes('quota') || lastError?.message?.includes('limit')) {
            userMessage = 'Vision service quota exceeded. Please wait a moment and try again.';
        } else if (lastError?.message?.includes('permission') || lastError?.message?.includes('unauthorized')) {
            userMessage = 'API key configuration issue. Please contact support.';
        }

        return {
            success: false,
            confidence: 0,
            error: userMessage
        };
    }

    private getMimeType(imagePath: string): string {
        const ext = path.extname(imagePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        return mimeTypes[ext] || 'image/jpeg';
    }

    private normalizeConfidence(value: any): number {
        if (typeof value === 'number') {
            return Math.max(0, Math.min(1, value)); // Clamp to 0-1
        } else if (typeof value === 'string') {
            const num = parseFloat(value);
            return isNaN(num) ? 0.5 : Math.max(0, Math.min(1, num));
        } else {
            return 0.5; // Default confidence if not provided
        }
    }

    /**
     * Process image from buffer (for direct image processing without file)
     * Used by agents to process images in memory
     */
    async processImage(
        imageBuffer: Buffer, 
        mimeType: string, 
        documentType: string = 'general',
        schoolId?: string
    ): Promise<VisionResult & { classification?: string; explanation?: string; extractedData?: any }> {
        
        // Check file size
        if (imageBuffer.length > 25 * 1024 * 1024) {
            logger.warn({ size: imageBuffer.length }, 'Image exceeds size limit');
            return {
                success: false,
                confidence: 0,
                error: 'Image file is too large. Please provide a smaller image.'
            };
        }

        const imageBase64 = imageBuffer.toString('base64');
        
        // Load specialized prompt based on document type
        let prompt = this.masterPrompt;
        if (documentType === 'payment') {
            const paymentPrompt = this.getSpecializedPrompt('payment-receipt');
            if (paymentPrompt !== this.masterPrompt) {
                prompt = paymentPrompt;
            }
        }

        const modelName = ENV.GEMINI_MODEL_VISION || 'gemini-2.0-flash';
        let lastError: any;
        
        for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
            const currentKey = this.getCurrentApiKey();
            
            if (!currentKey) {
                logger.error({ attempt }, 'No API key available for vision');
                break;
            }
            
            try {
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(currentKey);
                const model = genAI.getGenerativeModel({ model: modelName });

                const result = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: imageBase64,
                            mimeType: mimeType
                        }
                    }
                ]);

                const text = result.response.text();
                
                // Robust JSON extraction
                const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                let parsed: any;
                
                try {
                    parsed = JSON.parse(cleanedText);
                } catch (parseError) {
                    logger.error({ parseError, text: cleanedText.substring(0, 200) }, 'Failed to parse vision response as JSON');
                    return {
                        success: false,
                        confidence: 0,
                        error: 'Vision API returned invalid JSON',
                        docType: documentType
                    };
                }

                // Extract data
                const confidence = this.normalizeConfidence(parsed.extraction_confidence);
                const extractedData = parsed.data || parsed;
                
                return {
                    success: true,
                    confidence: confidence,
                    docType: documentType,
                    classification: parsed.classification || parsed.document_type || documentType,
                    explanation: parsed.explanation || parsed.summary || '',
                    extractedData: extractedData,
                    isLowConfidence: confidence < this.CONFIDENCE_THRESHOLD
                };

            } catch (error: any) {
                lastError = error;
                if (this.switchToNextApiKey()) {
                    continue;
                }
                break;
            }
        }
        
        logger.error({ error: lastError?.message, documentType }, 'Vision processing failed');
        return {
            success: false,
            confidence: 0,
            error: 'Failed to process image. Please try again.'
        };
    }
}

export const visionService = new VisionService();
