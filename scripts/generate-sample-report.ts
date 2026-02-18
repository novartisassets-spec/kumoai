/**
 * DIRECT REPORT GENERATION - No LLM Dependencies
 * Creates sample student data and generates a terminal report PDF
 */

import { db } from '../src/db';
import { pdfGenerator } from '../src/services/pdf-generator';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

async function generateSampleReport() {
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("🎓 GENERATING SAMPLE STUDENT REPORT CARD");
    console.log("═══════════════════════════════════════════════════════════\n");

    // Initialize database
    await db.init();

    const schoolId = "DEMO-SCHOOL-001";
    const schoolName = "Excellence Academy Lagos";
    const termId = "2025-FIRST-TERM";

    // Create sample students with realistic data
    const students = [
        {
            student_name: "Chima David Okonkwo",
            student_id: "STU-001",
            class_level: "JSS 1",
            term: termId,
            total_aggregate: 325,
            subject_count: 5,
            average: 65.0,
            position: "1st",
            total_students: 3,
            days_present: 58,
            days_open: 60,
            show_position: true,
            pillars: [
                { id: 'ca1', name: 'CA 1', max_score: 20 },
                { id: 'ca2', name: 'CA 2', max_score: 20 },
                { id: 'midterm', name: 'Midterm', max_score: 20 },
                { id: 'exam', name: 'Exam', max_score: 40 }
            ],
            marks: [
                { subject: "Mathematics", total: 85, ca1: 18, ca2: 17, midterm: 18, exam: 32 },
                { subject: "English Language", total: 72, ca1: 15, ca2: 16, midterm: 15, exam: 26 },
                { subject: "Basic Science", total: 78, ca1: 16, ca2: 17, midterm: 16, exam: 29 },
                { subject: "Social Studies", total: 45, ca1: 10, ca2: 9, midterm: 10, exam: 16 },
                { subject: "Civic Education", total: 65, ca1: 14, ca2: 14, midterm: 13, exam: 24 }
            ],
            teacher_remark: "Chima is an exceptional student with strong analytical skills. He shows great promise in Mathematics and Science. He should work on improving his performance in Social Studies."
        },
        {
            student_name: "Blessing Ngozi Adeyemi",
            student_id: "STU-002",
            class_level: "JSS 1",
            term: termId,
            total_aggregate: 310,
            subject_count: 5,
            average: 62.0,
            position: "2nd",
            total_students: 3,
            days_present: 59,
            days_open: 60,
            show_position: true,
            pillars: [
                { id: 'ca1', name: 'CA 1', max_score: 20 },
                { id: 'ca2', name: 'CA 2', max_score: 20 },
                { id: 'midterm', name: 'Midterm', max_score: 20 },
                { id: 'exam', name: 'Exam', max_score: 40 }
            ],
            marks: [
                { subject: "Mathematics", total: 75, ca1: 16, ca2: 16, midterm: 15, exam: 28 },
                { subject: "English Language", total: 82, ca1: 18, ca2: 18, midterm: 17, exam: 29 },
                { subject: "Basic Science", total: 70, ca1: 15, ca2: 15, midterm: 15, exam: 25 },
                { subject: "Social Studies", total: 48, ca1: 11, ca2: 10, midterm: 11, exam: 16 },
                { subject: "Civic Education", total: 65, ca1: 14, ca2: 14, midterm: 13, exam: 24 }
            ],
            teacher_remark: "Blessing is a well-rounded student with consistent performance across all subjects. She excels in English and shows good participation in class activities."
        },
        {
            student_name: "Emmanuel Oluwaseun Ibrahim",
            student_id: "STU-003",
            class_level: "JSS 1",
            term: termId,
            total_aggregate: 275,
            subject_count: 5,
            average: 55.0,
            position: "3rd",
            total_students: 3,
            days_present: 55,
            days_open: 60,
            show_position: true,
            pillars: [
                { id: 'ca1', name: 'CA 1', max_score: 20 },
                { id: 'ca2', name: 'CA 2', max_score: 20 },
                { id: 'midterm', name: 'Midterm', max_score: 20 },
                { id: 'exam', name: 'Exam', max_score: 40 }
            ],
            marks: [
                { subject: "Mathematics", total: 62, ca1: 13, ca2: 13, midterm: 12, exam: 24 },
                { subject: "English Language", total: 58, ca1: 12, ca2: 12, midterm: 12, exam: 22 },
                { subject: "Basic Science", total: 55, ca1: 12, ca2: 11, midterm: 11, exam: 21 },
                { subject: "Social Studies", total: 50, ca1: 11, ca2: 10, midterm: 12, exam: 17 },
                { subject: "Civic Education", total: 50, ca1: 11, ca2: 11, midterm: 11, exam: 17 }
            ],
            teacher_remark: "Emmanuel has shown steady improvement this term. With more focused effort, especially in Mathematics and Science, he can achieve better results next term."
        }
    ];

    console.log("📊 Generating terminal report for class JSS 1...");
    console.log(`   Students: ${students.length}`);
    console.log(`   Term: ${termId}`);
    console.log(`   School: ${schoolName}\n`);

    try {
        // Generate batch report cards
        const result = await pdfGenerator.generatePDF({
            schoolId,
            schoolName,
            templateType: 'batch_report_cards',
            templateData: {
                class_level: "JSS 1",
                term: termId,
                students: students
            },
            timestamp: Date.now(),
            generatedBy: "KUMO Academic System",
            orientation: 'portrait'
        });

        console.log(`✅ Report generated successfully!`);
        console.log(`📄 File: ${result.filePath}`);
        console.log(`📛 Filename: ${result.fileName}\n`);

        // Copy to a review location with a clear name
        const reviewPath = path.join(process.cwd(), 'REVIEW-JSS1-TERMINAL-REPORTS.pdf');
        const fs = require('fs');
        fs.copyFileSync(result.filePath, reviewPath);
        
        console.log("═══════════════════════════════════════════════════════════");
        console.log("✨ REPORT READY FOR REVIEW");
        console.log("═══════════════════════════════════════════════════════════\n");
        console.log(`📋 File Location:`);
        console.log(`   ${reviewPath}\n`);
        console.log(`📊 Report Contents:`);
        console.log(`   • 3 Students from JSS 1`);
        console.log(`   • 5 Subjects per student`);
        console.log(`   • 4-Component Grading (CA1, CA2, Midterm, Exam)`);
        console.log(`   • Class Positions (1st, 2nd, 3rd)`);
        console.log(`   • Attendance Records`);
        console.log(`   • AI-Generated Teacher Remarks\n`);
        console.log(`👀 Please open the PDF to review the report card format.`);

        db.close();
        return reviewPath;

    } catch (error) {
        console.error("❌ Report generation failed:", error);
        db.close();
        throw error;
    }
}

generateSampleReport().then(path => {
    console.log(`\n✅ Success! Report saved to: ${path}`);
    process.exit(0);
}).catch(err => {
    console.error("❌ Failed:", err);
    process.exit(1);
});
