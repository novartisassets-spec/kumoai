/**
 * COMPLETE ACADEMIC CYCLE SIMULATION
 * Tests: Setup → Marks Upload → Confirmation → Approval → Report Generation
 */

import { db } from '../src/db';
import { AgentDispatcher } from '../src/core/dispatcher';
import { MessageRouter } from '../src/core/router';
import { visionService } from '../src/ai/vision';
import { messenger } from '../src/services/messenger';
import { ReportService } from '../src/services/report-service';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const captures = {
    adminPdfs: [] as string[],
    teacherPdfs: [] as string[],
    teacherMessages: [] as string[],
    studentReportPdf: null as string | null
};

// Mock WhatsApp messenger
messenger.registerHandler(async (msg: any) => {
    console.log(`[MOCK WHATSAPP] To: ${msg.to} | Type: ${msg.type}`);
    if (msg.type === 'document') {
        console.log(`   📄 PDF: ${msg.documentPath}`);
        if (msg.to === '2348012345678') captures.adminPdfs.push(msg.documentPath);
        if (msg.to === '2348098765432') captures.teacherPdfs.push(msg.documentPath);
    }
    if (msg.type === 'text') {
        console.log(`   💬 Msg: ${msg.body?.substring(0, 100)}...`);
        if (msg.to === '2348098765432') captures.teacherMessages.push(msg.body);
    }
});

// Mock Vision Service
(visionService as any).analyzeImage = async (p: string, prompt: string, type?: string) => {
    console.log(`[MOCK VISION] Analyzing image... Type: ${type || 'general'}`);
    return {
        success: true,
        confidence: 0.98,
        data: {
            doc_type: 'marks_sheet',
            subject: 'Mathematics',
            class_level: 'JSS 1',
            marks: [
                { student_name: "Chima David Okonkwo", scores: { ca1: 18, ca2: 17, midterm: 19, exam: 55 } },
                { student_name: "Blessing Ngozi Adeyemi", scores: { ca1: 20, ca2: 19, midterm: 18, exam: 58 } },
                { student_name: "Emmanuel Oluwaseun Ibrahim", scores: { ca1: 15, ca2: 16, midterm: 17, exam: 48 } }
            ]
        }
    };
};

async function simulate(dispatcher: AgentDispatcher, from: string, body: string, type = 'text', imagePath?: string) {
    const msg = { 
        id: `M-${Date.now()}`, 
        from, 
        to: "BOT", 
        type, 
        body, 
        mediaPath: imagePath, 
        timestamp: Date.now(), 
        source: 'user', 
        isGroup: false 
    };
    const routed = await MessageRouter.route(msg as any);
    const response = await dispatcher.dispatch(routed);
    return response;
}

async function runAcademicCycle() {
    console.log("\n🎓 STARTING COMPLETE ACADEMIC CYCLE SIMULATION\n");
    
    // Initialize database
    await db.init();
    const dispatcher = new AgentDispatcher();

    const schoolId = "TEST-SCHOOL-001";
    const schoolName = "Excellence Academy Lagos";
    const adminPhone = "2348012345678";
    const teacherPhone = "2348098765432";
    const termId = "2025-TERM-1";

    // STEP 1: SEED DATABASE
    console.log("═══════════════════════════════════════════════════════════");
    console.log("STEP 1: SEEDING DATABASE");
    console.log("═══════════════════════════════════════════════════════════\n");

    await new Promise<void>((resolve, reject) => {
        db.getDB().run(
            `INSERT INTO schools (id, name, admin_phone, school_type, grading_config, setup_status, connected_whatsapp_jid) 
             VALUES (?, ?, ?, 'SECONDARY', ?, 'OPERATIONAL', ?)`,
            [schoolId, schoolName, adminPhone, JSON.stringify({
                pillars: [
                    { id: 'ca1', name: 'CA 1', max_score: 20 },
                    { id: 'ca2', name: 'CA 2', max_score: 20 },
                    { id: 'midterm', name: 'Midterm', max_score: 20 },
                    { id: 'exam', name: 'Exam', max_score: 40 }
                ],
                total_max: 100,
                rank_students: true
            }), adminPhone],
            (err) => err ? reject(err) : resolve()
        );
    });
    console.log(`✅ School created: ${schoolName}`);

    const teacherId = uuidv4();
    await new Promise<void>((resolve, reject) => {
        db.getDB().run(
            `INSERT INTO users (id, phone, role, name, school_id, assigned_class, school_type) 
             VALUES (?, ?, 'teacher', 'Mr. Adebayo Johnson', ?, 'JSS 1', 'SECONDARY')`,
            [teacherId, teacherPhone, schoolId],
            (err) => err ? reject(err) : resolve()
        );
    });
    console.log(`✅ Teacher registered: Mr. Adebayo (${teacherPhone})`);

    const adminId = uuidv4();
    await new Promise<void>((resolve, reject) => {
        db.getDB().run(
            `INSERT INTO users (id, phone, role, name, school_id) 
             VALUES (?, ?, 'admin', 'Principal Mrs. Chukwu', ?)`,
            [adminId, adminPhone, schoolId],
            (err) => err ? reject(err) : resolve()
        );
    });
    console.log(`✅ Admin registered: Principal Mrs. Chukwu (${adminPhone})`);

    // Create test students
    const students = [
        { id: uuidv4(), name: "Chima David Okonkwo", roll: "001" },
        { id: uuidv4(), name: "Blessing Ngozi Adeyemi", roll: "002" },
        { id: uuidv4(), name: "Emmanuel Oluwaseun Ibrahim", roll: "003" }
    ];

    for (const student of students) {
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO students (student_id, school_id, name, class_level) VALUES (?, ?, ?, 'JSS 1')`,
                [student.id, schoolId, student.name],
                (err) => err ? reject(err) : resolve()
            );
        });
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO class_student_mapping (id, school_id, teacher_id, class_level, student_id, student_name, roll_number, term_id) 
                 VALUES (?, ?, ?, 'JSS 1', ?, ?, ?, ?)`,
                [uuidv4(), schoolId, teacherId, student.id, student.name, student.roll, termId],
                (err) => err ? reject(err) : resolve()
            );
        });
    }
    console.log(`✅ ${students.length} students registered in JSS 1`);

    // Set academic term
    await new Promise<void>((resolve, reject) => {
        db.getDB().run(
            `INSERT INTO academic_terms (id, school_id, term_name, start_date, end_date) 
             VALUES (?, ?, 'First Term 2025', '2025-01-01', '2025-03-31')`,
            [termId, schoolId],
            (err) => err ? reject(err) : resolve()
        );
    });
    console.log(`✅ Academic term set: First Term 2025`);

    // STEP 2: TEACHER UPLOADS MARKS
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("STEP 2: TEACHER UPLOADS MARKS SHEET");
    console.log("═══════════════════════════════════════════════════════════\n");

    console.log("📸 Teacher uploading Mathematics marks for JSS 1...");
    await simulate(dispatcher, teacherPhone, "Here are the JSS 1 Mathematics marks for First Term", 'image', 'C:\\fake\\marks.jpg');
    
    await new Promise(r => setTimeout(r, 3000));

    // STEP 3: TEACHER CONFIRMS MARKS
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("STEP 3: TEACHER CONFIRMS EXTRACTED MARKS");
    console.log("═══════════════════════════════════════════════════════════\n");

    console.log("✅ Teacher confirming marks...");
    await simulate(dispatcher, teacherPhone, "Yes, I confirm these marks are correct. Please submit them.");
    
    await new Promise(r => setTimeout(r, 3000));

    // STEP 4: ADMIN APPROVES
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("STEP 4: ADMIN APPROVES SUBMISSION");
    console.log("═══════════════════════════════════════════════════════════\n");

    console.log("👑 Admin reviewing and approving...");
    await simulate(dispatcher, adminPhone, "Yes, approve the JSS 1 Mathematics marks for release.");
    
    await new Promise(r => setTimeout(r, 5000));

    // STEP 5: GENERATE REPORT CARDS
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("STEP 5: GENERATING TERMINAL REPORT CARDS");
    console.log("═══════════════════════════════════════════════════════════\n");

    console.log("📊 Generating batch report cards for JSS 1...");
    
    try {
        const result = await ReportService.generateBatchReports({
            schoolId,
            classLevel: 'JSS 1',
            termId,
            generateRemarks: true,
            generatedBy: 'System Test'
        });

        if (result && result.filePath) {
            console.log(`✅ Report cards generated: ${result.filePath}`);
            captures.studentReportPdf = result.filePath;
            
            // Copy to a review location
            const reviewPath = path.join(process.cwd(), 'REVIEW-REPORT-JSS1.pdf');
            fs.copyFileSync(result.filePath, reviewPath);
            console.log(`📄 Copied to review location: ${reviewPath}`);
        }
    } catch (error) {
        console.error("❌ Report generation failed:", error);
    }

    // STEP 6: VERIFY RESULTS
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("VERIFICATION RESULTS");
    console.log("═══════════════════════════════════════════════════════════\n");

    // Check marks in database
    const marksCount = await new Promise<number>((resolve) => {
        db.getDB().get(
            `SELECT COUNT(*) as count FROM student_marks_indexed WHERE school_id = ? AND term_id = ?`,
            [schoolId, termId],
            (err, row: any) => resolve(row?.count || 0)
        );
    });
    console.log(`✅ Marks stored in database: ${marksCount} records`);

    // Check terminal reports
    const reportsCount = await new Promise<number>((resolve) => {
        db.getDB().get(
            `SELECT COUNT(*) as count FROM terminal_reports WHERE school_id = ? AND term_id = ?`,
            [schoolId, termId],
            (err, row: any) => resolve(row?.count || 0)
        );
    });
    console.log(`✅ Terminal reports created: ${reportsCount} students`);

    // Check workflow status
    const workflowStatus = await new Promise<string>((resolve) => {
        db.getDB().get(
            `SELECT current_status FROM mark_submission_workflow WHERE school_id = ? ORDER BY timestamp DESC LIMIT 1`,
            [schoolId],
            (err, row: any) => resolve(row?.current_status || 'NOT_STARTED')
        );
    });
    console.log(`✅ Workflow status: ${workflowStatus}`);

    // Check PDFs generated
    console.log(`\n📄 Admin PDFs received: ${captures.adminPdfs.length}`);
    console.log(`📄 Teacher PDFs received: ${captures.teacherPdfs.length}`);
    console.log(`📄 Student Report PDF: ${captures.studentReportPdf || 'Not generated'}`);

    // Summary
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("ACADEMIC CYCLE COMPLETE");
    console.log("═══════════════════════════════════════════════════════════\n");

    const success = marksCount === 3 && reportsCount === 3 && captures.studentReportPdf !== null;
    
    if (success) {
        console.log("🏆 SUCCESS! Complete academic cycle verified.");
        console.log(`\n📋 REVIEW PDF LOCATION:`);
        console.log(`   ${path.join(process.cwd(), 'REVIEW-REPORT-JSS1.pdf')}`);
        console.log(`\n   Open this file to review the generated student report.`);
    } else {
        console.log("❌ CYCLE INCOMPLETE - Check logs above");
    }

    db.close();
    return success;
}

runAcademicCycle().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
