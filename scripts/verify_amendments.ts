/**
 * VERIFY POST-FINALIZATION AMENDMENT FLOW
 */

const testDbName = `kumo_amendment_test_${Date.now()}.db`;
const path = require('path');
const process = require('process');
const testDbPath = path.join(process.cwd(), testDbName);
process.env.DB_PATH = testDbPath;

import { db } from '../src/db';
import { AgentDispatcher } from '../src/core/dispatcher';
import { MessageRouter } from '../src/core/router';
import { visionService } from '../src/ai/vision';
import { messenger } from '../src/services/messenger';
import { v4 as uuidv4 } from 'uuid';
import { TASetupRepository } from '../src/db/repositories/ta-setup.repo';

// --- MOCKS ---
(visionService as any).analyzeImage = async () => ({ success: true, confidence: 0.9, data: {} });

let lastAdminMsg = "";
(messenger as any).sendPush = async (to: string, body: string) => {
    if (to === "2348011111111") lastAdminMsg = body;
    console.log(`\n📲 [WHATSAPP to ${to}]: ${body}`);
};

(messenger as any).sendDocument = async (to: string, path: string, caption: string) => {
    console.log(`\n📄 [DOCUMENT to ${to}]: ${caption} (Path: ${path})`);
};

async function sendMsg(dispatcher: AgentDispatcher, from: string, body: string, context: string) {
    console.log(`\n👤 [USER ${from}]: ${body}`);
    const msg = {
        id: `MSG-${Date.now()}`,
        from: from,
        to: "234KUMO",
        type: 'text' as const,
        body: body,
        timestamp: Date.now(),
        source: 'user' as const,
        isGroup: false
    };

    const routed = await MessageRouter.route(msg);
    // Force context for test
    routed.context = context as any;
    return await dispatcher.dispatch(routed);
}

async function runTest() {
    console.log(`\n🧪 STARTING AMENDMENT FLOW TEST 🧪\n`);
    
    await db.reconnect(testDbPath);
    await db.init();
    
    const dispatcher = new AgentDispatcher();
    const schoolId = uuidv4();
    const adminPhone = "2348011111111";
    const teacherPhone = "2348022222222";
    const teacherId = uuidv4();

    // 1. SETUP: Operational School & Finalized Mark
    await new Promise<void>((r) => db.getDB().run(`INSERT INTO schools (id, name, admin_phone, school_type, setup_status) VALUES (?, 'Amendment High', ?, 'SECONDARY', 'OPERATIONAL')`, [schoolId, adminPhone], () => r()));
    await new Promise<void>((r) => db.getDB().run(`INSERT INTO users (id, phone, role, name, school_id) VALUES (?, ?, 'admin', 'Admin', ?)`, [uuidv4(), adminPhone, schoolId], () => r()));
    await new Promise<void>((r) => db.getDB().run(`INSERT INTO users (id, phone, role, name, school_id, assigned_class) VALUES (?, ?, 'teacher', 'Mr. Correct', ?, 'JSS 1')`, [teacherId, teacherPhone, schoolId], () => r()));
    
    const studentId = "STUDENT-001";
    await new Promise<void>((r) => db.getDB().run(`INSERT INTO students (student_id, school_id, name, class_level) VALUES (?, ?, 'Musa Ali', 'JSS 1')`, [studentId, schoolId], () => r()));
    
    // Seed the class mapping so identity resolver works
    await TASetupRepository.saveStudentMapping(teacherId, schoolId, 'JSS 1', 'current', [{ student_id: studentId, name: 'Musa Ali' }]);

    // Finalize a mark for Musa
    await new Promise<void>((r) => db.getDB().run(
        `INSERT INTO student_marks_indexed (id, school_id, student_id, student_name, teacher_id, class_level, subject, term_id, marks_json, total_score, confirmed_by_teacher)
         VALUES (?, ?, ?, 'Musa Ali', ?, 'JSS 1', 'Mathematics', 'current', ?, 17, 1)`,
        [uuidv4(), schoolId, studentId, teacherId, JSON.stringify({ exam: 17 })], () => r()
    ));

    console.log("✅ Setup: Musa Ali has a confirmed Math score of 17.");

    // 2. TEST: Teacher attempts to change finalized mark
    console.log("\n--- TEACHER REQUESTS CORRECTION ---");
    const teacherRes = await sendMsg(dispatcher, teacherPhone, "Change Musa Ali's Math score to 70 instead of 17. I made a mistake.", "TA");
    
    // Wait for async escalation notification
    await new Promise(r => setTimeout(r, 2000));

    // ASSERTIONS
    const lowerMsg = lastAdminMsg.toLowerCase();
    if (!lowerMsg.includes("musa") || !lowerMsg.includes("70")) {
        throw new Error(`❌ FAIL: Admin was not notified correctly! Got: ${lastAdminMsg}`);
    }
    console.log("✅ PASS: Admin notified of amendment request.");

    // 3. TEST: Admin approves amendment (God Mode Inference)
    console.log("\n--- ADMIN APPROVES ---");
    await sendMsg(dispatcher, adminPhone, "Yes, I approve the change for Musa.", "SA");

    // 4. VERIFY: DB patched
    const allRows: any[] = await new Promise(r => db.getDB().all("SELECT * FROM student_marks_indexed", (e, rows) => r(rows)));
    console.log(`\n📊 DB DUMP (${allRows.length} rows):`);
    allRows.forEach(r => {
        console.log(`   - [${r.school_id}] ${r.student_name}: Total Score = ${r.total_score} (Sub: ${r.subject}, Term: ${r.term_id})`);
    });
    
    const row = allRows.find(r => r.student_id === studentId);
    if (!row) throw new Error("❌ FAIL: Student record missing from DB!");
    
    console.log(`\n🎯 TARGET CHECK: Musa's final score = ${row.total_score}`);
    
    if (Number(row.total_score) !== 70) {
        throw new Error(`❌ FAIL: Score not updated in DB! Found: ${row.total_score}`);
    }
    console.log("✅ PASS: Database patched with corrected score.");

    console.log("\n🎉 AMENDMENT FLOW VERIFIED SUCCESSFULLY! 🎉");
    db.close();
}

runTest().catch(err => {
    console.error("\n❌ TEST FAILED:", err);
    db.close();
    process.exit(1);
});
