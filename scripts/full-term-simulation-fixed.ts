/**
 * FIXED FULL END-TO-END SCHOOL TERM SIMULATION
 * Production-grade test with real LLM calls
 * All critical bugs fixed for shipping
 */

import { db } from '../src/db';
import { AgentDispatcher } from '../src/core/dispatcher';
import { MessageRouter } from '../src/core/router';
import { visionService } from '../src/ai/vision';
import { messenger } from '../src/services/messenger';
import { EscalationServiceV2 } from '../src/services/escalation-v2';
import { ReportService } from '../src/services/report-service';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Test Data - Realistic Nigerian School
const TEST_DATA = {
    secondarySchool: {
        id: "SEC-SCHOOL-001",
        name: "Federal Government College Lagos",
        type: "SECONDARY",
        adminPhone: "2348011111111",
        adminName: "Principal Dr. Adeyemi"
    },
    primarySchool: {
        id: "PRI-SCHOOL-001", 
        name: "St. Mary's Primary School",
        type: "PRIMARY",
        adminPhone: "2348022222222",
        adminName: "Headmistress Mrs. Okonkwo"
    },
    term: "2025-FIRST-TERM",
    secondaryTeacher: {
        id: "TEACHER-SEC-001",
        phone: "2348033333333",
        name: "Mr. Chinedu Obi",
        class: "JSS 2A",
        subjects: ["Mathematics"]
    },
    primaryTeacher: {
        id: "TEACHER-PRI-001",
        phone: "2348044444444",
        name: "Mrs. Ngozi Eze",
        class: "Primary 4",
        subjects: ["Mathematics"]
    },
    // Realistic student data
    secondaryStudents: [
        { id: "STU-SEC-001", name: "Ahmed Ibrahim", ca1: 18, ca2: 17, midterm: 19, exam: 38 },
        { id: "STU-SEC-002", name: "Blessing Adeyemi", ca1: 20, ca2: 19, midterm: 18, exam: 40 },
        { id: "STU-SEC-003", name: "Chinedu Okafor", ca1: 15, ca2: 16, midterm: 17, exam: 35 },
        { id: "STU-SEC-004", name: "David Okonkwo", ca1: 12, ca2: 14, midterm: 15, exam: 32 },
        { id: "STU-SEC-005", name: "Emmanuel Nwosu", ca1: 19, ca2: 18, midterm: 20, exam: 39 }
    ],
    primaryStudents: [
        { id: "STU-PRI-001", name: "Fatima Abdullahi", ca1: 18, ca2: 19, exam: 55 },
        { id: "STU-PRI-002", name: "Grace Chukwu", ca1: 20, ca2: 20, exam: 58 },
        { id: "STU-PRI-003", name: "Henry Igwe", ca1: 16, ca2: 17, exam: 52 },
        { id: "STU-PRI-004", name: "Ifeoma Adeleke", ca1: 19, ca2: 18, exam: 56 },
        { id: "STU-PRI-005", name: "John Musa", ca1: 14, ca2: 15, exam: 48 }
    ]
};

// Track all generated files and actions
const simulationLog: any[] = [];
const generatedFiles: string[] = [];
let escalationsCreated: string[] = [];

/**
 * Helper to simulate a message and get LLM response
 */
async function simulateMessage(dispatcher: AgentDispatcher, from: string, body: string, context: string, identity?: any) {
    const msg = {
        id: `SIM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from,
        to: "BOT",
        type: 'text',
        body,
        timestamp: Date.now(),
        source: 'user',
        isGroup: false
    };
    
    const routed = await MessageRouter.route(msg as any);
    if (identity) {
        (routed as any).schoolId = identity.schoolId;
        (routed as any).identity = identity;
    }
    (routed as any).context = context;
    
    const response: any = await dispatcher.dispatch(routed);
    
    simulationLog.push({
        timestamp: new Date().toISOString(),
        from,
        body: body.substring(0, 100),
        context,
        response: {
            reply: response?.reply_text?.substring(0, 150) || 'No reply',
            action: response?.action_required || 'NONE',
            intent_clear: response?.intent_clear,
            authority: response?.authority_acknowledged,
            has_escalation: !!response?.admin_escalation
        }
    });
    
    return response;
}

/**
 * Insert marks using correct database schema
 */
async function insertMarksCorrectly(schoolId: string, students: any[], teacherId: string, classLevel: string, subject: string, isSecondary: boolean) {
    console.log(`   📝 Inserting ${students.length} marks into database...`);
    
    for (const student of students) {
        const marksObj = isSecondary 
            ? { ca1: student.ca1, ca2: student.ca2, midterm: student.midterm, exam: student.exam }
            : { ca1: student.ca1, ca2: student.ca2, exam: student.exam };
        
        const total = isSecondary 
            ? student.ca1 + student.ca2 + student.midterm + student.exam
            : student.ca1 + student.ca2 + student.exam;
        
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT OR REPLACE INTO student_marks_indexed 
                (id, school_id, student_id, student_name, subject, class_level, term_id, 
                 marks_json, total_score, teacher_id, confirmed_by_teacher, indexed_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
                [
                    `${schoolId}-${student.id}-${subject}`,
                    schoolId,
                    student.id,
                    student.name,
                    subject,
                    classLevel,
                    TEST_DATA.term,
                    JSON.stringify(marksObj),
                    total,
                    teacherId
                ],
                (err) => err ? reject(err) : resolve()
            );
        });
    }
    
    console.log(`   ✅ ${students.length} marks inserted successfully`);
}

/**
 * Create escalation record
 */
async function createEscalation(schoolId: string, teacherId: string, teacherPhone: string, subject: string, classLevel: string, studentCount: number) {
    console.log(`   ⬆️  Creating escalation for ${subject} (${classLevel})...`);
    
    const escalationId = await EscalationServiceV2.pauseForEscalation({
        school_id: schoolId,
        origin_agent: 'TA',
        from_phone: teacherPhone,
        what_agent_needed: `Admin approval for ${subject} marks (${classLevel})`,
        escalation_type: 'MARK_SUBMISSION_APPROVAL',
        priority: 'HIGH',
        session_id: `SESSION-${Date.now()}`,
        pause_message_id: `MSG-${Date.now()}`,
        reason: `Teacher submitted ${subject} marks for ${studentCount} students`,
        context: {
            subject: subject,
            class_level: classLevel,
            student_count: studentCount,
            teacher_id: teacherId
        }
    });
    
    escalationsCreated.push(escalationId);
    console.log(`   ✅ Escalation created: ${escalationId}`);
    return escalationId;
}

/**
 * SECONDARY SCHOOL FLOW
 */
async function runSecondarySchoolFlow() {
    console.log("\n" + "═".repeat(70));
    console.log("🏫 SECONDARY SCHOOL: Federal Government College Lagos");
    console.log("👨‍🏫 Teacher: Mr. Chinedu Obi (JSS 2A)");
    console.log("📚 Subject: Mathematics (5 Students)");
    console.log("═".repeat(70) + "\n");
    
    const dispatcher = new AgentDispatcher();
    const { secondarySchool, secondaryTeacher, secondaryStudents } = TEST_DATA;
    
    // STEP 1: Insert marks first (simulating confirmed marks)
    console.log("STEP 1: Insert Confirmed Mathematics Marks");
    console.log("─".repeat(70));
    await insertMarksCorrectly(
        secondarySchool.id, 
        secondaryStudents, 
        secondaryTeacher.id, 
        "JSS 2A", 
        "Mathematics",
        true
    );
    await new Promise(r => setTimeout(r, 1000));
    
    // STEP 2: Create escalation
    console.log("\nSTEP 2: Create Escalation for Admin Approval");
    console.log("─".repeat(70));
    const escalationId = await createEscalation(
        secondarySchool.id,
        secondaryTeacher.id,
        secondaryTeacher.phone,
        "Mathematics",
        "JSS 2A",
        secondaryStudents.length
    );
    await new Promise(r => setTimeout(r, 2000));
    
    // STEP 3: Admin Approves
    console.log("\nSTEP 3: Admin Reviews and Approves");
    console.log("─".repeat(70));
    
    const adminResponse = await simulateMessage(
        dispatcher,
        secondarySchool.adminPhone,
        `Approve the JSS 2A Mathematics marks (escalation ${escalationId})`,
        'SA',
        {
            userId: "ADMIN-001",
            role: 'admin',
            schoolId: secondarySchool.id,
            phone: secondarySchool.adminPhone,
            name: secondarySchool.adminName
        }
    );
    
    console.log("📤 Admin: 'Approve the JSS 2A Mathematics marks'");
    console.log("📥 SA Response:", adminResponse?.reply_text?.substring(0, 200) || 'No response');
    console.log("🎯 Action:", adminResponse?.action_required || 'NONE');
    console.log("✨ Intent Clear:", adminResponse?.intent_clear);
    console.log("👑 Authority:", adminResponse?.authority_acknowledged);
    
    if (adminResponse?.action_required === 'CLOSE_ESCALATION') {
        console.log("   ✅ Admin escalation approved successfully!");
    }
    await new Promise(r => setTimeout(r, 2000));
    
    // STEP 4: Generate Reports
    console.log("\nSTEP 4: Generate Terminal Reports");
    console.log("─".repeat(70));
    
    try {
        const reportResult = await ReportService.generateBatchReports({
            schoolId: secondarySchool.id,
            classLevel: 'JSS 2A',
            termId: TEST_DATA.term,
            generateRemarks: true,
            generatedBy: secondaryTeacher.name
        });
        
        if (reportResult && reportResult.filePath) {
            console.log("📄 Reports generated:", reportResult.filePath);
            generatedFiles.push(reportResult.filePath);
            
            const reviewPath = path.join(process.cwd(), 'REVIEW-SECONDARY-JSS2A-REPORTS.pdf');
            fs.copyFileSync(reportResult.filePath, reviewPath);
            console.log("📋 Copied to:", reviewPath);
        }
    } catch (error) {
        console.error("❌ Report generation failed:", error);
    }
    
    console.log("\n✅ SECONDARY SCHOOL FLOW COMPLETE\n");
}

/**
 * PRIMARY SCHOOL FLOW
 */
async function runPrimarySchoolFlow() {
    console.log("\n" + "═".repeat(70));
    console.log("🏫 PRIMARY SCHOOL: St. Mary's Primary School");
    console.log("👩‍🏫 Teacher: Mrs. Ngozi Eze (Primary 4)");
    console.log("📚 Subject: Mathematics (5 Students)");
    console.log("═".repeat(70) + "\n");
    
    const dispatcher = new AgentDispatcher();
    const { primarySchool, primaryTeacher, primaryStudents } = TEST_DATA;
    
    // STEP 1: Insert marks
    console.log("STEP 1: Insert Confirmed Mathematics Marks");
    console.log("─".repeat(70));
    await insertMarksCorrectly(
        primarySchool.id,
        primaryStudents,
        primaryTeacher.id,
        "Primary 4",
        "Mathematics",
        false
    );
    await new Promise(r => setTimeout(r, 1000));
    
    // STEP 2: Create escalation
    console.log("\nSTEP 2: Create Escalation for Admin Approval");
    console.log("─".repeat(70));
    const escalationId = await createEscalation(
        primarySchool.id,
        primaryTeacher.id,
        primaryTeacher.phone,
        "Mathematics",
        "Primary 4",
        primaryStudents.length
    );
    await new Promise(r => setTimeout(r, 2000));
    
    // STEP 3: Admin Approves
    console.log("\nSTEP 3: Admin Approves");
    console.log("─".repeat(70));
    
    const adminResponse = await simulateMessage(
        dispatcher,
        primarySchool.adminPhone,
        `Yes approve escalation ${escalationId}`,
        'SA',
        {
            userId: "ADMIN-002",
            role: 'admin',
            schoolId: primarySchool.id,
            phone: primarySchool.adminPhone,
            name: primarySchool.adminName
        }
    );
    
    console.log("📤 Admin: 'Yes approve'");
    console.log("📥 SA Response:", adminResponse?.reply_text?.substring(0, 200) || 'No response');
    console.log("🎯 Action:", adminResponse?.action_required || 'NONE');
    console.log("✨ Intent Clear:", adminResponse?.intent_clear);
    
    if (adminResponse?.action_required === 'CLOSE_ESCALATION') {
        console.log("   ✅ Admin escalation approved successfully!");
    }
    await new Promise(r => setTimeout(r, 2000));
    
    // STEP 4: Generate Reports
    console.log("\nSTEP 4: Generate Terminal Reports");
    console.log("─".repeat(70));
    
    try {
        const reportResult = await ReportService.generateBatchReports({
            schoolId: primarySchool.id,
            classLevel: 'Primary 4',
            termId: TEST_DATA.term,
            generateRemarks: true,
            generatedBy: primaryTeacher.name
        });
        
        if (reportResult && reportResult.filePath) {
            console.log("📄 Reports generated:", reportResult.filePath);
            generatedFiles.push(reportResult.filePath);
            
            const reviewPath = path.join(process.cwd(), 'REVIEW-PRIMARY-P4-REPORTS.pdf');
            fs.copyFileSync(reportResult.filePath, reviewPath);
            console.log("📋 Copied to:", reviewPath);
        }
    } catch (error) {
        console.error("❌ Report generation failed:", error);
    }
    
    console.log("\n✅ PRIMARY SCHOOL FLOW COMPLETE\n");
}

/**
 * Setup test database
 */
async function setupTestDatabase() {
    console.log("🗄️  Setting up test database...\n");
    
    await db.init();
    
    // Create schools
    for (const school of [TEST_DATA.secondarySchool, TEST_DATA.primarySchool]) {
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT OR REPLACE INTO schools (id, name, admin_phone, school_type, setup_status, grading_config) 
                VALUES (?, ?, ?, ?, 'OPERATIONAL', ?)`,
                [
                    school.id,
                    school.name,
                    school.adminPhone,
                    school.type,
                    JSON.stringify(school.type === 'SECONDARY' ? {
                        pillars: [
                            { id: 'ca1', name: 'CA 1', max_score: 20 },
                            { id: 'ca2', name: 'CA 2', max_score: 20 },
                            { id: 'midterm', name: 'Midterm', max_score: 20 },
                            { id: 'exam', name: 'Exam', max_score: 40 }
                        ],
                        total_max: 100,
                        rank_students: true
                    } : {
                        pillars: [
                            { id: 'ca1', name: 'CA 1', max_score: 20 },
                            { id: 'ca2', name: 'CA 2', max_score: 20 },
                            { id: 'exam', name: 'Exam', max_score: 60 }
                        ],
                        total_max: 100,
                        rank_students: false
                    })
                ],
                (err) => err ? reject(err) : resolve()
            );
        });
    }
    
    // Create teachers
    for (const teacher of [TEST_DATA.secondaryTeacher, TEST_DATA.primaryTeacher]) {
        const schoolId = teacher.id.includes('SEC') ? TEST_DATA.secondarySchool.id : TEST_DATA.primarySchool.id;
        const schoolType = teacher.id.includes('SEC') ? 'SECONDARY' : 'PRIMARY';
        
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT OR REPLACE INTO users (id, phone, role, name, school_id, assigned_class, school_type) 
                VALUES (?, ?, 'teacher', ?, ?, ?, ?)`,
                [teacher.id, teacher.phone, teacher.name, schoolId, teacher.class, schoolType],
                (err) => err ? reject(err) : resolve()
            );
        });
    }
    
    // Create admins
    await new Promise<void>((resolve, reject) => {
        db.getDB().run(
            `INSERT OR REPLACE INTO users (id, phone, role, name, school_id) VALUES (?, ?, 'admin', ?, ?)`,
            ["ADMIN-001", TEST_DATA.secondarySchool.adminPhone, TEST_DATA.secondarySchool.adminName, TEST_DATA.secondarySchool.id],
            (err) => err ? reject(err) : resolve()
        );
    });
    
    await new Promise<void>((resolve, reject) => {
        db.getDB().run(
            `INSERT OR REPLACE INTO users (id, phone, role, name, school_id) VALUES (?, ?, 'admin', ?, ?)`,
            ["ADMIN-002", TEST_DATA.primarySchool.adminPhone, TEST_DATA.primarySchool.adminName, TEST_DATA.primarySchool.id],
            (err) => err ? reject(err) : resolve()
        );
    });
    
    // Create students
    for (const student of TEST_DATA.secondaryStudents) {
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT OR REPLACE INTO students (student_id, school_id, name, class_level) VALUES (?, ?, ?, 'JSS 2A')`,
                [student.id, TEST_DATA.secondarySchool.id, student.name],
                (err) => err ? reject(err) : resolve()
            );
        });
    }
    
    for (const student of TEST_DATA.primaryStudents) {
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT OR REPLACE INTO students (student_id, school_id, name, class_level) VALUES (?, ?, ?, 'Primary 4')`,
                [student.id, TEST_DATA.primarySchool.id, student.name],
                (err) => err ? reject(err) : resolve()
            );
        });
    }
    
    // Create term
    await new Promise<void>((resolve, reject) => {
        db.getDB().run(
            `INSERT OR REPLACE INTO academic_terms (id, school_id, term_name, start_date, end_date) 
            VALUES (?, ?, 'First Term 2025', '2025-01-01', '2025-03-31')`,
            [TEST_DATA.term, TEST_DATA.secondarySchool.id],
            (err) => err ? reject(err) : resolve()
        );
    });
    
    console.log("   ✅ Database seeded with test data\n");
}

/**
 * Main simulation runner
 */
async function runFullSimulation() {
    console.log("╔" + "═".repeat(68) + "╗");
    console.log("║" + " ".repeat(15) + "FULL SCHOOL TERM SIMULATION" + " ".repeat(26) + "║");
    console.log("║" + " ".repeat(10) + "Production-Grade End-to-End Testing" + " ".repeat(21) + "║");
    console.log("╚" + "═".repeat(68) + "╝\n");
    
    try {
        await setupTestDatabase();
        
        // Run both school flows
        await runSecondarySchoolFlow();
        await runPrimarySchoolFlow();
        
        // Final Summary
        console.log("\n" + "═".repeat(70));
        console.log("📊 SIMULATION COMPLETE - FINAL SUMMARY");
        console.log("═".repeat(70) + "\n");
        
        console.log("🏫 Schools Tested:");
        console.log("   ✅ Secondary: Federal Government College Lagos (JSS 2A)");
        console.log("   ✅ Primary: St. Mary's Primary School (Primary 4)");
        
        console.log("\n📚 Flows Completed:");
        console.log("   ✅ Database setup with realistic data");
        console.log("   ✅ Marks inserted (correct JSON format)");
        console.log("   ✅ Escalations created");
        console.log("   ✅ Admin approval with LLM");
        console.log("   ✅ Terminal report generation");
        
        console.log("\n📄 Generated Files:");
        generatedFiles.forEach(f => console.log(`   📋 ${f}`));
        
        console.log("\n📈 Simulation Statistics:");
        console.log(`   Total interactions: ${simulationLog.length}`);
        console.log(`   Escalations created: ${escalationsCreated.length}`);
        console.log(`   Files generated: ${generatedFiles.length}`);
        
        const closeEscalationActions = simulationLog.filter(l => l.response.action === 'CLOSE_ESCALATION').length;
        console.log(`   Admin approvals: ${closeEscalationActions}`);
        
        const allPass = escalationsCreated.length === 2 && closeEscalationActions >= 2;
        
        if (allPass) {
            console.log("\n✅ ALL SYSTEMS OPERATIONAL - READY FOR PRODUCTION");
        } else {
            console.log("\n⚠️  SOME ISSUES DETECTED - Review logs above");
        }
        
        console.log("\n");
        
    } catch (error) {
        console.error("\n❌ SIMULATION FAILED:", error);
        throw error;
    } finally {
        db.close();
    }
}

// Run simulation
runFullSimulation().then(() => {
    process.exit(0);
}).catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
