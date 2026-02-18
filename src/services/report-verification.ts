/**
 * Report Verification Module
 * Generates QR codes for document integrity verification
 */

import crypto from 'crypto';
import QRCode from 'qrcode';

export interface ReportData {
    student_id: string;
    student_name: string;
    school_id: string;
    school_name: string;
    class_level: string;
    term: string;
    academic_data: {
        subjects: Array<{
            name: string;
            ca1: number;
            ca2: number;
            exam: number;
            total: number;
            position: string;
        }>;
        total_aggregate: number;
        average: number;
        class_position: string;
        total_students: number;
    };
    attendance: {
        present: number;
        open: number;
    };
    teacher_remark: string;
    generated_at: string;
    document_id: string;
}

export interface VerificationPayload {
    version: '1.0';
    document_id: string;
    student_id: string;
    school_id: string;
    term: string;
    checksum: string;
    timestamp: string;
    data_hash: string;
}

export class ReportVerification {
    /**
     * Generate a verification payload for a student report
     */
    static generatePayload(data: ReportData): VerificationPayload {
        const documentId = `RPT-${data.student_id}-${Date.now()}`;
        
        // Create a hash of the core academic data
        const dataString = JSON.stringify({
            student_id: data.student_id,
            school_id: data.school_id,
            term: data.term,
            academic_data: data.academic_data,
            teacher_remark: data.teacher_remark
        });
        
        const dataHash = crypto.createHash('sha256').update(dataString).digest('hex');
        
        // Create checksum that combines key fields
        const checksum = crypto.createHash('sha256')
            .update(`${data.student_id}:${data.academic_data.total_aggregate}:${data.teacher_remark}:${dataHash}`)
            .digest('hex');

        return {
            version: '1.0',
            document_id: documentId,
            student_id: data.student_id,
            school_id: data.school_id,
            term: data.term,
            checksum: checksum.substring(0, 16),
            timestamp: new Date().toISOString(),
            data_hash: dataHash.substring(0, 32)
        };
    }

    /**
     * Generate QR code as Data URL
     */
    static async generateQRCode(payload: VerificationPayload): Promise<string> {
        try {
            const qrData = JSON.stringify(payload);
            const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
                errorCorrectionLevel: 'M',
                margin: 2,
                width: 150,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            return qrCodeDataUrl;
        } catch (error) {
            console.error('QR Code generation failed:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    /**
     * Generate QR code as buffer (for PDF)
     */
    static async generateQRBuffer(payload: VerificationPayload): Promise<Buffer> {
        try {
            const qrData = JSON.stringify(payload);
            const qrBuffer = await QRCode.toBuffer(qrData, {
                errorCorrectionLevel: 'M',
                margin: 2,
                width: 150,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            return qrBuffer;
        } catch (error) {
            console.error('QR Code buffer generation failed:', error);
            throw new Error('Failed to generate QR code buffer');
        }
    }

    /**
     * Verify a report by scanning QR code
     */
    static verify(qrData: string, currentData: Partial<ReportData>): { valid: boolean; message: string } {
        try {
            const payload: VerificationPayload = JSON.parse(qrData);
            
            // Verify basic fields match
            if (payload.student_id !== currentData.student_id) {
                return { valid: false, message: 'Student ID mismatch' };
            }
            
            if (payload.school_id !== currentData.school_id) {
                return { valid: false, message: 'School ID mismatch' };
            }
            
            if (payload.term !== currentData.term) {
                return { valid: false, message: 'Term mismatch' };
            }

            return { valid: true, message: 'Report verified successfully' };
        } catch (error) {
            return { valid: false, message: 'Invalid QR code data' };
        }
    }

    /**
     * Generate a short verification URL (for future web verification)
     */
    static generateVerificationUrl(payload: VerificationPayload): string {
        // In production, this would be your verification domain
        const baseUrl = 'https://kumo.ai/verify';
        const params = new URLSearchParams({
            id: payload.document_id,
            s: payload.checksum
        });
        return `${baseUrl}?${params.toString()}`;
    }
}
