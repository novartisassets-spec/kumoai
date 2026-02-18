/**
 * Kumo Premium PDF Generation Service
 * 
 * Provides professional-grade, high-fidelity academic documents.
 * Tailored for African schools with fluid grading logic and 
 * multi-domain assessment (Academic, Affective, Psychomotor).
 */

import PDFDocument from 'pdfkit';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// --- THEME CONFIGURATION ---
const THEME = {
    PRIMARY: '#1A365D', // Deep Navy
    SECONDARY: '#D4AF37', // Gold
    TEXT_MAIN: '#2D3748',
    TEXT_MUTED: '#718096',
    BORDER: '#E2E8F0',
    BACKGROUND_LIGHT: '#F7FAFC',
    SUCCESS: '#38A169',
    DANGER: '#E53E3E'
};

export interface PDFGenerationRequest {
    schoolId: string;
    schoolName: string;
    templateType: 'registration' | 'marks_sheet' | 'attendance' | 'batch_report_cards' | 'student_report_card' | 'broadsheet' | 'teacher_setup_preview' | 'parent_premium_report';
    templateData: Record<string, any>;
    timestamp: number;
    generatedBy: string;
    documentId?: string;
    orientation?: 'portrait' | 'landscape';
}

export interface PDFGenerationResponse {
    documentId: string;
    filePath: string;
    fileName: string;
    mimeType: string;
    generatedAt: number;
    schoolName: string;
}

export class PDFGenerator {
    private outputDir: string;

    constructor(outputDir: string = './pdf-output') {
        this.outputDir = outputDir;
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async generatePDF(request: PDFGenerationRequest): Promise<PDFGenerationResponse> {
        const documentId = request.documentId || uuidv4();
        const timestamp = new Date(request.timestamp);
        const fileName = `${request.templateType}-${documentId}-${timestamp.getTime()}.pdf`;
        const filePath = path.join(this.outputDir, fileName);

        // Auto-detect landscape for broadsheets
        const orientation = request.templateType === 'broadsheet' ? 'landscape' : (request.orientation || 'portrait');

        try {
            const doc = new PDFDocument({
                margin: 40,
                size: 'A4',
                layout: orientation,
                bufferPages: true
            });

            const writeStream = fs.createWriteStream(filePath);
            doc.pipe(writeStream);

            if (request.templateType === 'batch_report_cards') {
                this.renderBatchReports(doc, request);
            } else if (request.templateType === 'broadsheet') {
                this.drawPageChrome(doc, request);
                this.drawBroadsheet(doc, request.templateData);
            } else if (request.templateType === 'teacher_setup_preview') {
                this.drawPageChrome(doc, request);
                this.renderTeacherSetupPreview(doc, request.templateData);
            } else if (request.templateType === 'parent_premium_report') {
                this.drawPremiumParentReport(doc, request);
            } else {
                this.drawPageChrome(doc, request);
                this.renderTemplate(doc, request);
            }

            // Draw footer on all pages ONCE at the end
            this.drawFooter(doc, request);

            doc.end();

            await new Promise<void>((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            return {
                documentId,
                filePath,
                fileName,
                mimeType: 'application/pdf',
                generatedAt: request.timestamp,
                schoolName: request.schoolName
            };
        } catch (error) {
            logger.error({ error, documentId, templateType: request.templateType }, '❌ PDF generation failed');
            throw error;
        }
    }

    private drawPageChrome(doc: PDFKit.PDFDocument, request: PDFGenerationRequest): void {
        const width = doc.page.width;
        const height = doc.page.height;
        const m = doc.page.margins;

        // 1. Page Border (Elegant thin line)
        doc.rect(m.left - 10, m.top - 10, width - m.left - m.right + 20, height - m.top - m.bottom + 20)
           .lineWidth(0.5)
           .strokeColor(THEME.BORDER)
           .stroke();

        // 2. School Header
        doc.fillColor(THEME.PRIMARY)
           .font('Helvetica-Bold')
           .fontSize(18)
           .text(request.schoolName.toUpperCase(), m.left, m.top + 10, { align: 'center' });

        doc.fillColor(THEME.TEXT_MUTED)
           .font('Helvetica')
           .fontSize(9)
           .text('ACADEMIC EXCELLENCE & CHARACTER', { align: 'center' });

        doc.moveDown(0.5);

        // 3. Document Title Ribbon
        const title = this.getTemplateTitle(request.templateType).toUpperCase();
        doc.rect(m.left, doc.y, width - m.left - m.right, 25)
           .fill(THEME.PRIMARY);
        
        doc.fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text(title, m.left, doc.y + 7, { align: 'center' });

        doc.moveDown(1.5);
    }

    private drawFooter(doc: PDFKit.PDFDocument, request: PDFGenerationRequest): void {
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            const y = doc.page.height - 30;
            
            doc.moveTo(40, y)
               .lineTo(doc.page.width - 40, y)
               .lineWidth(0.5)
               .strokeColor(THEME.BORDER)
               .stroke();

            doc.fillColor(THEME.TEXT_MUTED)
               .font('Helvetica')
               .fontSize(7)
               .text(`KUMO ACADEMIC ORCHESTRATOR | DOC ID: ${request.documentId || 'NEW'} | AUTH: ${request.generatedBy}`, 40, y + 8);

            doc.text(`Page ${i + 1} of ${pages.count}`, 40, y + 8, { align: 'right' });
        }
    }

    private renderTemplate(doc: PDFKit.PDFDocument, request: PDFGenerationRequest): void {
        switch (request.templateType) {
            case 'registration': this.drawRegistration(doc, request.templateData); break;
            case 'marks_sheet': this.drawMarksSheet(doc, request.templateData); break;
            case 'attendance': this.drawAttendance(doc, request.templateData); break;
            case 'student_report_card': this.drawReportCardBody(doc, request.templateData); break;
        }
    }

    private renderBatchReports(doc: PDFKit.PDFDocument, request: PDFGenerationRequest): void {
        const students = request.templateData.students || [];
        students.forEach((student: any, idx: number) => {
            if (idx > 0) doc.addPage();
            this.drawPageChrome(doc, request);
            this.drawReportCardBody(doc, student);
        });
    }

    private drawPremiumParentReport(doc: PDFKit.PDFDocument, request: PDFGenerationRequest): void {
        // Use the same layout as batch report card for consistency
        this.drawPageChrome(doc, request);
        this.drawReportCardBody(doc, request.templateData);
    }

    private getSubjectIcon(subject: string): string {
        const icons: Record<string, string> = {
            'Mathematics': '🔢',
            'Math': '🔢',
            'English Language': '📖',
            'English': '📖',
            'Basic Science': '🔬',
            'Science': '🔬',
            'Social Studies': '🌍',
            'Social Studies ': '🌍',
            'Physics': '⚛️',
            'Chemistry': '🧪',
            'Biology': '🧬',
            'Economics': '💰',
            'Government': '🏛️',
            'Literature': '📚',
            'History': '📜',
            'Geography': '🗺️',
            'Religious Studies': '✝️',
            'CRS': '✝️',
            'IRS': '☪️',
            'French': '🇫🇷',
            'Agricultural Science': '🌾',
            'Technical Drawing': '📐',
            'Food and Nutrition': '🍳',
            'Computer Studies': '💻',
            'Physical Education': '⚽',
            'Creative Arts': '🎨',
            'Home Economics': '🏠'
        };
        return icons[subject] || '📚';
    }

    private getGradeColor(grade: string): string {
        if (grade.startsWith('A')) return '#38A169';
        if (grade.startsWith('B')) return '#3182CE';
        if (grade.startsWith('C')) return '#D69E2E';
        if (grade.startsWith('D')) return '#ED8936';
        return '#E53E3E';
    }

    private drawReportCardBody(doc: PDFKit.PDFDocument, data: any): void {
        const m = doc.page.margins;
        
        // 1. Student Bio Section
        const bioY = doc.y;
        doc.rect(m.left, bioY, doc.page.width - m.left - m.right, 45)
           .fill(THEME.BACKGROUND_LIGHT);
        
        doc.fillColor(THEME.TEXT_MAIN).font('Helvetica-Bold').fontSize(11);
        doc.text(`STUDENT: ${data.student_name.toUpperCase()}`, m.left + 10, bioY + 10);
        
        doc.font('Helvetica').fontSize(9).fillColor(THEME.TEXT_MUTED);
        doc.text(`CLASS: ${data.class_level || 'N/A'}  |  TERM: ${data.term || 'N/A'}  |  ID: ${data.student_id || 'N/A'}`, m.left + 10, bioY + 25);
        
        doc.y = bioY + 55;

        // 2. Academic Performance Table
        this.drawSectionHeader(doc, 'ACADEMIC PERFORMANCE');
        
        const pillars = data.pillars || [];
        const headers = ['SUBJECT', ...pillars.map((p: any) => p.name.toUpperCase()), 'TOTAL', 'POS', 'GRADE'];
        const rows = (data.marks || []).map((m: any) => {
            const r = [m.subject];
            pillars.forEach((p: any) => {
                const score = m[p.id] !== undefined ? m[p.id] : (m[p.name] !== undefined ? m[p.name] : '0');
                r.push(String(score));
            });
            r.push(String(m.total || '0'));
            r.push(m.subject_position || '-');
            r.push(this.calculateGrade(m.total));
            return r;
        });

        // Dynamic column widths
        const tableWidth = doc.page.width - m.left - m.right;
        const subWidth = 140;
        const otherCount = pillars.length + 3;
        const otherWidth = (tableWidth - subWidth) / otherCount;
        
        this.drawGrid(doc, headers, rows, [subWidth, ...pillars.map(() => otherWidth), otherWidth, otherWidth, otherWidth]);

        // 3. Summary Stats (Side-by-side boxes)
        doc.moveDown(1);
        const statsY = doc.y;
        this.drawInfoBox(doc, m.left, statsY, 150, 'TOTAL SCORE', `${data.total_aggregate || 0}`);
        this.drawInfoBox(doc, m.left + 160, statsY, 150, 'AVERAGE', `${data.average || 0}%`);
        
        if (data.show_position) {
            this.drawInfoBox(doc, m.left + 320, statsY, 150, 'CLASS POSITION', `${data.position} of ${data.total_students}`);
        }

        doc.y = statsY + 50;
        doc.moveDown(1);

        // 4. Behavioral & Attendance (Two columns)
        const domainY = doc.y;
        this.drawSectionHeader(doc, 'BEHAVIORAL ASSESSMENT', 240);
        this.drawGrid(doc, ['TRAIT', 'RATING'], (data.traits || []).map((t: any) => [t.trait, t.rating]), [180, 60], domainY + 20);

        const currentYAfterBehavior = doc.y;

        doc.y = domainY;
        this.drawSectionHeader(doc, 'ATTENDANCE', 240, m.left + 250);
        doc.fontSize(9).fillColor(THEME.TEXT_MAIN)
           .text(`Days Present: ${data.days_present || 0}`, m.left + 260, domainY + 30)
           .text(`Days Absent: ${(data.days_open || 0) - (data.days_present || 0)}`, m.left + 260, doc.y + 5)
           .text(`Total Days Open: ${data.days_open || 0}`, m.left + 260, doc.y + 5);

        doc.y = Math.max(currentYAfterBehavior, doc.y + 20);
        doc.moveDown(1);

        // 5. Remarks Section
        this.drawSectionHeader(doc, 'REMARKS & SIGNATURES');
        const remarkY = doc.y;
        doc.rect(m.left, remarkY, doc.page.width - m.left - m.right, 60)
           .lineWidth(0.5).strokeColor(THEME.BORDER).stroke();
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor(THEME.PRIMARY)
           .text('TEACHER\'S REMARK:', m.left + 10, remarkY + 10);
        doc.font('Helvetica-Oblique').fontSize(9).fillColor(THEME.TEXT_MAIN)
           .text(data.teacher_remark || 'No remark provided.', m.left + 10, remarkY + 22, { width: 480 });

        doc.y = remarkY + 70;

        // 6. Signatures
        const sigY = doc.y + 20;
        this.drawSignature(doc, m.left, sigY, 'CLASS TEACHER');
        this.drawSignature(doc, doc.page.width - m.right - 150, sigY, 'PRINCIPAL');
    }

    private drawBroadsheet(doc: PDFKit.PDFDocument, data: any): void {
        const m = doc.page.margins;
        const schoolName = data.school_name || 'Kumo Academy';
        const classLevel = data.class_level || 'N/A';
        const term = data.term || 'N/A';

        doc.fillColor(THEME.PRIMARY).font('Helvetica-Bold').fontSize(14)
           .text(`${schoolName} - CLASS BROADSHEET`, { align: 'center' });
        doc.fontSize(10).text(`CLASS: ${classLevel} | TERM: ${term}`, { align: 'center' });
        doc.moveDown(1);

        const subjects = data.subjects || [];
        const pillars = data.pillars || [];
        const subColCount = pillars.length + 1; // Pillars + Total per subject

        // 1. Define Master Headers
        const masterHeaders = ['S/N', 'STUDENT NAME'];
        subjects.forEach((s: string) => masterHeaders.push(s.toUpperCase()));
        masterHeaders.push('OVERALL');

        // 2. Define Sub Headers (The sub-columns)
        const subHeaders: string[] = ['', '']; // Empty for S/N and Name
        subjects.forEach(() => {
            pillars.forEach((p: any) => subHeaders.push(p.name.substring(0, 3))); // e.g. CA1, CA2
            subHeaders.push('TOT');
        });
        subHeaders.push('AGG');
        subHeaders.push('AVG');
        subHeaders.push('POS');

        // 3. Data Rows
        const rows = (data.students || []).map((s: any, i: number) => {
            const r: any[] = [i + 1, s.student_name];
            
            subjects.forEach((sub: string) => {
                const markObj = s.marks[sub];
                if (markObj) {
                    pillars.forEach((p: any) => {
                        const val = markObj.pillars[p.id] !== undefined ? markObj.pillars[p.id] : (markObj.pillars[p.name] || '0');
                        r.push(String(val));
                    });
                    r.push(String(markObj.total));
                } else {
                    pillars.forEach(() => r.push('-'));
                    r.push('-');
                }
            });

            r.push(String(s.total_aggregate));
            r.push(`${s.average}%`);
            r.push(s.position);
            return r;
        });

        // 4. Calculate Column Widths
        const pageWidth = doc.page.width - m.left - m.right;
        const snWidth = 25;
        const nameWidth = 120;
        const overallWidth = 80; // Total for AGG, AVG, POS
        
        const subjectsRemainingWidth = pageWidth - snWidth - nameWidth - overallWidth;
        const subjectWidth = subjectsRemainingWidth / subjects.length;
        const colWidth = subjectWidth / subColCount;

        const allColWidths: number[] = [snWidth, nameWidth];
        subjects.forEach(() => {
            for (let j = 0; j < subColCount; j++) allColWidths.push(colWidth);
        });
        allColWidths.push(overallWidth / 3); // AGG
        allColWidths.push(overallWidth / 3); // AVG
        allColWidths.push(overallWidth / 3); // POS

        // 5. Draw the Multi-Tier Grid
        this.drawDetailedGrid(doc, masterHeaders, subHeaders, rows, allColWidths, pillars.length + 1);
    }

    private drawDetailedGrid(
        doc: PDFKit.PDFDocument, 
        masters: string[], 
        subs: string[], 
        rows: any[][], 
        widths: number[],
        subColsPerSubject: number
    ): void {
        const startX = doc.page.margins.left;
        const m = doc.page.margins;
        let currentY = doc.y;

        // Calculate positions for vertical lines (after each subject)
        const subjectsStartIndex = 2; // After S/N and NAME
        const totalSubjectCols = masters.length - subjectsStartIndex - 3; // Before OVERALL
        const tableWidth = widths.reduce((a, b) => a + b, 0);
        
        // Tier 1 Header (Subjects) with border
        doc.rect(startX, currentY, tableWidth, 18).fill(THEME.PRIMARY);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7);
        
        let curX = startX;
        let subjectEndX = startX;
        masters.forEach((m, i) => {
            if (i >= 2 && i < masters.length - 1) {
                const spanWidth = subColsPerSubject * widths[2];
                doc.text(m, curX, currentY + 5, { width: spanWidth, align: 'center' });
                subjectEndX = curX + spanWidth;
                
                // Add vertical line after this subject
                doc.rect(subjectEndX - 0.5, currentY, 1, 33).fill('#D4AF37');
                
                curX = subjectEndX;
            } else if (i < 2) {
                doc.text(m, curX + 5, currentY + 5, { width: widths[i] - 10 });
                curX += widths[i];
            } else {
                const remainingSpan = (widths[widths.length-1] * 3);
                doc.text(m, curX, currentY + 5, { width: remainingSpan, align: 'center' });
            }
        });

        currentY += 18;

        // Tier 2 Header (Pillars)
        doc.rect(startX, currentY, tableWidth, 15).fill(THEME.BACKGROUND_LIGHT);
        doc.fillColor(THEME.PRIMARY).font('Helvetica-Bold').fontSize(6);
        curX = startX;
        
        // Track subject boundaries for vertical lines
        let subjectBoundaries: number[] = [];
        
        subs.forEach((s, i) => {
            // Check if this is the last pillar column of a subject (TOT column)
            const isLastPillarOfSubject = (i - 2) % subColsPerSubject === subColsPerSubject - 1;
            
            doc.text(s, curX + 2, currentY + 4, { width: widths[i] - 4, align: 'center' });
            
            if (isLastPillarOfSubject && i > 1) {
                // Add vertical line after this pillar
                doc.rect(curX + widths[i] - 0.5, currentY - 18, 0.5, 33).fill('#CBD5E0');
            }
            
            curX += widths[i];
        });

        currentY += 15;

        // Rows with alternating colors
        doc.font('Helvetica').fontSize(6).fillColor(THEME.TEXT_MAIN);
        rows.forEach((row, idx) => {
            const rowHeight = 14;
            if (currentY + rowHeight > doc.page.height - 50) {
                doc.addPage();
                currentY = doc.page.margins.top;
            }

            if (idx % 2 === 0) {
                doc.rect(startX, currentY, tableWidth, rowHeight).fill('#FFFFFF');
            } else {
                doc.rect(startX, currentY, tableWidth, rowHeight).fill('#F9FAFB');
            }
            
            doc.fillColor(THEME.TEXT_MAIN);
            curX = startX;
            row.forEach((cell, i) => {
                doc.text(String(cell), curX + 2, currentY + 4, { width: widths[i] - 4, align: i < 2 ? 'left' : 'center' });
                curX += widths[i];
            });
            
            // Add vertical line after each subject in the row
            if (idx % 2 === 0) {
                curX = startX;
                row.forEach((cell, i) => {
                    const isLastPillarOfSubject = (i - 2) % subColsPerSubject === subColsPerSubject - 1;
                    if (isLastPillarOfSubject && i > 1) {
                        doc.rect(curX + widths[i] - 0.5, currentY, 0.5, rowHeight).fill('#E2E8F0');
                    }
                    curX += widths[i];
                });
            }
            
            currentY += rowHeight;
        });

        // Bottom border
        doc.rect(startX, currentY, tableWidth, 0.5).fill(THEME.BORDER);

        doc.y = currentY + 10;
    }

    // --- HELPER DRAWING METHODS ---

    private drawSectionHeader(doc: PDFKit.PDFDocument, text: string, width = 0, xOffset = 0): void {
        const x = xOffset || doc.page.margins.left;
        const w = width || (doc.page.width - doc.page.margins.left - doc.page.margins.right);
        const y = doc.y;
        
        doc.rect(x, y, w, 15).fill(THEME.BACKGROUND_LIGHT);
        doc.fillColor(THEME.PRIMARY).font('Helvetica-Bold').fontSize(8)
           .text(text, x + 5, y + 4);
        doc.y = y + 15;
        doc.moveDown(0.2);
    }

    private drawGrid(doc: PDFKit.PDFDocument, headers: string[], rows: any[][], colWidths: number[], forceY?: number): void {
        const startX = doc.page.margins.left;
        const startY = forceY || doc.y;
        let currentY = startY;

        // Header
        doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), 20).fill(THEME.PRIMARY);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7);
        
        let currentX = startX;
        headers.forEach((h, i) => {
            doc.text(h, currentX + 5, currentY + 6, { width: colWidths[i] - 10, align: 'left' });
            currentX += colWidths[i];
        });

        currentY += 20;

        // Rows
        doc.font('Helvetica').fontSize(7).fillColor(THEME.TEXT_MAIN);
        rows.forEach((row, idx) => {
            const rowHeight = 15;
            // Page break check
            if (currentY + rowHeight > doc.page.height - 50) {
                doc.addPage();
                currentY = doc.page.margins.top;
            }

            if (idx % 2 === 0) {
                doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#FFFFFF');
            } else {
                doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill(THEME.BACKGROUND_LIGHT);
            }
            
            doc.fillColor(THEME.TEXT_MAIN);
            currentX = startX;
            row.forEach((cell, i) => {
                doc.text(String(cell), currentX + 5, currentY + 4, { width: colWidths[i] - 10, lineBreak: false });
                currentX += colWidths[i];
            });
            currentY += rowHeight;
        });

        doc.y = currentY + 10;
    }

    private drawInfoBox(doc: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, value: string): void {
        doc.rect(x, y, width, 40).lineWidth(0.5).strokeColor(THEME.BORDER).stroke();
        doc.fillColor(THEME.TEXT_MUTED).font('Helvetica').fontSize(7).text(label, x + 5, y + 8, { width: width - 10, align: 'center' });
        doc.fillColor(THEME.PRIMARY).font('Helvetica-Bold').fontSize(14).text(value, x + 5, y + 18, { width: width - 10, align: 'center' });
    }

    private drawSignature(doc: PDFKit.PDFDocument, x: number, y: number, label: string): void {
        doc.moveTo(x, y).lineTo(x + 150, y).lineWidth(0.5).strokeColor(THEME.TEXT_MAIN).stroke();
        doc.font('Helvetica-Bold').fontSize(7).fillColor(THEME.TEXT_MAIN).text(label, x, y + 5, { width: 150, align: 'center' });
        doc.font('Helvetica-Oblique').fontSize(6).fillColor(THEME.TEXT_MUTED).text('DIGITALLY AUTHENTICATED', x, y + 15, { width: 150, align: 'center' });
    }

    private calculateGrade(score: number | string): string {
        const s = Number(score);
        if (s >= 75) return 'A (Excellent)';
        if (s >= 65) return 'B (Very Good)';
        if (s >= 50) return 'C (Credit)';
        if (s >= 40) return 'D (Pass)';
        return 'F (Fail)';
    }

    private getTemplateTitle(type: string): string {
        const titles: Record<string, string> = {
            registration: 'Class Register Confirmation',
            marks_sheet: 'Subject Marks Sheet',
            attendance: 'Daily Attendance Report',
            student_report_card: 'Terminal Progress Report',
            batch_report_cards: 'Terminal Progress Reports',
            broadsheet: 'Class Academic Broadsheet'
        };
        return titles[type] || 'Official Document';
    }

    // --- OTHER TEMPLATES ---
    private drawRegistration(doc: PDFKit.PDFDocument, data: any): void {
        doc.text(`Class: ${data.class_level || 'N/A'}`);
        this.drawGrid(doc, ['#', 'STUDENT NAME', 'ROLL NO'], (data.students || []).map((s: any, i: number) => [i+1, s.name, s.roll || '-']), [30, 300, 100]);
    }

    private drawMarksSheet(doc: PDFKit.PDFDocument, data: any): void {
        const { subject, class_level, teacher_name, generated_at, pillars = [], marks = [] } = data;
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const margin = 30;
        const contentWidth = pageWidth - (margin * 2);
        
        // Mobile-first: Center everything
        const centerX = pageWidth / 2;
        
        // Document Info Header - Mobile optimized, centered
        doc.fillColor(THEME.PRIMARY).font('Helvetica-Bold').fontSize(14);
        doc.text(`${subject || 'Subject'}`, centerX, 100, { align: 'center' });
        
        doc.fillColor(THEME.SECONDARY).font('Helvetica-Bold').fontSize(11);
        doc.text(`${class_level || 'Class'}`, centerX, doc.y + 5, { align: 'center' });
        
        doc.moveDown(0.8);
        
        doc.fillColor(THEME.TEXT_MUTED).font('Helvetica').fontSize(9);
        doc.text(`Teacher: ${teacher_name || 'N/A'}`, centerX, doc.y, { align: 'center' });
        doc.text(`${generated_at || new Date().toLocaleString()}`, centerX, doc.y + 12, { align: 'center' });
        
        doc.moveDown(1.2);
        
        // Grading Info - Centered, mobile-friendly format
        if (pillars.length > 0) {
            doc.fillColor(THEME.TEXT_MUTED).font('Helvetica').fontSize(8);
            const pillarInfo = pillars.map((p: any) => `${p.name} (/${p.max_score || 'N/A'})`).join('  •  ');
            doc.text(pillarInfo, centerX, doc.y, { align: 'center', width: contentWidth });
            doc.moveDown(1);
        }
        
        // Mobile-optimized table
        const tableWidth = contentWidth;
        const numCols = 2 + pillars.length + 1; // #, Name, pillars, Total
        const colWidth = tableWidth / numCols;
        
        // Center the table
        const tableStartX = margin;
        
        // Header with background
        const headerY = doc.y;
        doc.rect(tableStartX, headerY, tableWidth, 22).fill(THEME.PRIMARY);
        
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
        let currentX = tableStartX;
        
        // Column headers
        const headers = ['#', 'NAME', ...pillars.map((p: any) => p.name.toUpperCase()), 'TOTAL'];
        headers.forEach((h, i) => {
            const width = i === 1 ? colWidth * 2.5 : colWidth; // Give more space to name
            doc.text(h, currentX + 3, headerY + 6, { width: width - 6, align: 'center' });
            currentX += width;
        });
        
        doc.y = headerY + 22;
        
        // Rows - centered and mobile-friendly
        doc.font('Helvetica').fontSize(8).fillColor(THEME.TEXT_MAIN);
        
        marks.forEach((m: any, idx: number) => {
            const rowY = doc.y;
            const rowHeight = 18;
            
            // Alternating row colors for readability
            if (idx % 2 === 0) {
                doc.rect(tableStartX, rowY, tableWidth, rowHeight).fill('#F8F9FA');
            }
            
            doc.fillColor(THEME.TEXT_MAIN);
            currentX = tableStartX;
            
            // # column
            doc.text(String(idx + 1), currentX + 3, rowY + 4, { width: colWidth - 6, align: 'center' });
            currentX += colWidth;
            
            // Name column (wider)
            doc.text(m.student_name, currentX + 3, rowY + 4, { width: (colWidth * 2.5) - 6, align: 'left' });
            currentX += colWidth * 2.5;
            
            // Score columns
            pillars.forEach((p: any) => {
                const score = m[p.id] || m[p.name] || '0';
                doc.text(String(score), currentX + 3, rowY + 4, { width: colWidth - 6, align: 'center' });
                currentX += colWidth;
            });
            
            // Total column (bold)
            doc.font('Helvetica-Bold');
            doc.text(String(m.total || '0'), currentX + 3, rowY + 4, { width: colWidth - 6, align: 'center' });
            doc.font('Helvetica');
            
            doc.y = rowY + rowHeight;
        });
        
        doc.moveDown(1.5);
        
        // Footer note - centered for mobile
        doc.fillColor(THEME.TEXT_MUTED).font('Helvetica').fontSize(9);
        doc.text('📱 Review on your phone and reply "YES" to confirm', centerX, doc.y, { align: 'center', width: contentWidth });
        doc.moveDown(0.3);
        doc.text('or send corrections if needed.', centerX, doc.y, { align: 'center', width: contentWidth });
        
        // Note about total calculation
        doc.moveDown(1);
        doc.fillColor(THEME.SECONDARY).font('Helvetica-Oblique').fontSize(7);
        doc.text('✓ Totals calculated automatically by Kumo', centerX, doc.y, { align: 'center' });
    }

    private drawAttendance(doc: PDFKit.PDFDocument, data: any): void {
        doc.text(`Date: ${data.marked_date || 'N/A'}`);
        this.drawGrid(doc, ['#', 'NAME', 'STATUS'], (data.students || []).map((s: any, i: number) => [i+1, s.name, s.present ? 'PRESENT' : 'ABSENT']), [30, 300, 100]);
    }

    /**
     * Render Teacher Setup Preview PDF
     * Shows workload and student list in a professional format
     */
    private renderTeacherSetupPreview(doc: PDFKit.PDFDocument, data: any): void {
        const { teacherName, workload, students, generatedAt } = data;
        
        // Title
        doc.fontSize(16)
           .fillColor(THEME.PRIMARY)
           .text('TEACHER SETUP CONFIRMATION', { align: 'center' });
        
        doc.moveDown(0.5);
        
        // Metadata
        doc.fontSize(10)
           .fillColor(THEME.TEXT_MAIN)
           .text(`Teacher: ${teacherName || 'N/A'}`)
           .text(`Generated: ${generatedAt || new Date().toLocaleString()}`);
        
        doc.moveDown(1);
        
        // Section 1: Workload
        this.drawSectionHeader(doc, 'DECLARED WORKLOAD');
        
        if (workload && workload.length > 0) {
            const workloadHeaders = ['CLASS', 'SUBJECTS'];
            const workloadRows = workload.map((w: any) => [
                w.class || 'Unknown',
                w.subjects || 'N/A'
            ]);
            this.drawGrid(doc, workloadHeaders, workloadRows, [150, 350]);
        } else {
            doc.font('Helvetica-Oblique').text('No workload declared yet.');
        }
        
        doc.moveDown(1);
        
        // Section 2: Students
        this.drawSectionHeader(doc, 'REGISTERED STUDENTS');
        
        if (students && students.length > 0) {
            const studentHeaders = ['#', 'STUDENT NAME', 'ROLL NO', 'CLASS'];
            const studentRows = students.map((s: any, i: number) => [
                i + 1,
                s.name || s.student_name || 'Unknown',
                s.roll_number || s.rollNumber || '-',
                s.class_name || s.class || 'Unknown'
            ]);
            this.drawGrid(doc, studentHeaders, studentRows, [40, 250, 80, 130]);
        } else {
            doc.font('Helvetica-Oblique').text('No students registered yet. Please send class register photos.');
        }
        
        doc.moveDown(1);
        
        // Confirmation instructions
        doc.fontSize(9)
           .fillColor(THEME.TEXT_MUTED)
           .text('Please review this document carefully. If everything is correct, reply with "YES" to complete your setup.', { align: 'center' });
    }

    /**
     * Draw a rounded rectangle with fill color
     */
    private drawRoundedRect(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, radius: number, color: string): void {
        doc.path(`M ${x + radius} ${y}
                 L ${x + width - radius} ${y}
                 Q ${x + width} ${y} ${x + width} ${y + radius}
                 L ${x + width} ${y + height - radius}
                 Q ${x + width} ${y + height} ${x + width - radius} ${y + height}
                 L ${x + radius} ${y + height}
                 Q ${x} ${y + height} ${x} ${y + height - radius}
                 L ${x} ${y + radius}
                 Q ${x} ${y} ${x + radius} ${y}
                 Z`)
           .fill(color);
    }
}

export const pdfGenerator = new PDFGenerator();