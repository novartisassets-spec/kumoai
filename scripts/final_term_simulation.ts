import { AgentDispatcher } from '../src/core/dispatcher';
import { db } from '../src/db';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { logger } from '../src/utils/logger';
import { TeacherSessionManager } from '../src/services/teacher-session';

async function sendMsg(dispatcher: AgentDispatcher, from: string, body: string, schoolId: string, context: 'TA'|'SA'|'PA'|'GA', mediaPath?: string, extractionData?: any) {
    console.log(`
👤 [USER ${from} (${context})]: ${body}`);
    
    // Fetch user for identity injection
    const user: any = await new Promise(r => db.getDB().get(
        `SELECT id, name, role FROM users WHERE phone = ? AND school_id = ?`,
        [from, schoolId], (e, row) => r(row)
    ));

    const res = await dispatcher.dispatch({
        id: `MSG-${Date.now()}`,
        from,
        schoolId, 
        type: mediaPath ? 'image' : 'text',
        body,
        mediaPath,
        extractionData,
        timestamp: Date.now(),
        source: 'user',
        context: context,
        identity: user ? {
            userId: user.id,
            name: user.name,
            role: user.role,
            schoolId: schoolId,
            phone: from,
            assignedClass: 'Primary 4'
        } : undefined
    });
    console.log(`📲 [KUMO]: ${res.body}`);
    if (res.action_payload?.pdf_path) console.log(`📄 [ATTACHMENT]: ${res.action_payload.pdf_path}`);
    return res;
}

async function runFullTerm() {
    console.log("\n🏫 --- STARTING FULL ACADEMIC TERM SIMULATION --- 🏫");
    
    // UNIQUE DB PER RUN
    const testDbPath = `./kumo_simulation_${Date.now()}.db`;
    process.env.DB_PATH = testDbPath;
    console.log(`🎲 Using unique database: ${testDbPath}`);

    await db.init();
    const dispatcher = new AgentDispatcher();
    const schoolId = uuidv4();
    const adminPhone = "2348011111111";
    const teacherPhone = "2348022222222";
    const parentPhone = "2348033333333";

    // 1. SEED INITIAL IDENTITY
    console.log("\n--- STEP 1: INITIAL SEEDING ---");
    await new Promise<void>(r => db.getDB().run(
        `
        INSERT INTO schools (id, name, admin_phone, school_type, classes_json, subjects_json, grading_config)
        VALUES (?, 'Kumo Elite Academy', ?, 'BOTH', 
        '["Primary 4", "Primary 5", "JSS 1"]',
        '["Mathematics", "English", "Basic Science", "Social Studies"]',
        ?)
    `,
        [schoolId, adminPhone, JSON.stringify({
            pillars: [
                { id: 'ca1', name: 'CA 1', max_score: 15 },
                { id: 'ca2', name: 'CA 2', max_score: 15 },
                { id: 'project', name: 'Project', max_score: 10 },
                { id: 'exam', name: 'Exam', max_score: 60 }
            ],
            total_max: 100,
            rank_students: false
        })], () => r()));

    await new Promise<void>(r => db.getDB().run(`INSERT INTO users (id, phone, role, name, school_id, school_type) VALUES (?, ?, 'admin', 'Proprietor', ?, 'SECONDARY')`, [uuidv4(), adminPhone, schoolId], () => r()));
    await new Promise<void>(r => db.getDB().run(`INSERT INTO users (id, phone, role, name, school_id, school_type) VALUES (?, ?, 'teacher', 'Mrs. Grace', ?, 'PRIMARY')`, [uuidv4(), teacherPhone, schoolId], () => r()));

    // Register Students (Master students table)
    const students = [
        { id: 'STU-001', name: "Chinedu Obi" },
        { id: 'STU-002', name: "Sarah Yusuf" },
        { id: 'STU-003', name: "Ahmed Ali" },
        { id: 'STU-004', name: "Blessing Okafor" },
        { id: 'STU-005', name: "Kofi Mensah" }
    ];
    for (const s of students) {
        await new Promise<void>(r => db.getDB().run(
            `INSERT INTO students (student_id, school_id, name, class_level) VALUES (?, ?, ?, ?)`,
            [s.id, schoolId, s.name, "Primary 4"], () => r()
        ));
    }

    // 2. TEACHER SETUP
    console.log("\n--- STEP 2: TEACHER ONBOARDING ---");
    await sendMsg(dispatcher, teacherPhone, "I am Mrs. Grace. I handle Primary 4 and I teach all subjects.", schoolId, 'TA');
    await sendMsg(dispatcher, teacherPhone, "Yes, finalize my setup.", schoolId, 'TA');

    // 3. SEED THE MARKS DRAFT & LINK TO SESSION
    console.log("\n--- STEP 3: SEEDING MARKS DRAFT & LINKING SESSION ---");
    const draftId = uuidv4();
    const marksData = {
        "STU-001": { student_name: "Chinedu Obi", total: 80, marks: { ca1: 12, ca2: 14, project: 8, exam: 46 } },
        "STU-002": { student_name: "Sarah Yusuf", total: 95, marks: { ca1: 15, ca2: 15, project: 10, exam: 55 } },
        "STU-003": { student_name: "Ahmed Ali", total: 60, marks: { ca1: 10, ca2: 11, project: 7, exam: 32 } },
        "STU-004": { student_name: "Blessing Okafor", total: 85, marks: { ca1: 14, ca2: 13, project: 9, exam: 49 } },
        "STU-005": { student_name: "Kofi Mensah", total: 70, marks: { ca1: 11, ca2: 12, project: 6, exam: 41 } }
    };
    
    await new Promise<void>(r => db.getDB().run(
        `INSERT INTO academic_drafts (id, school_id, teacher_id, subject, class_level, term_id, marks_json, status) VALUES (?, ?, (SELECT id FROM users WHERE phone = ?), ?, ?, ?, ?, 'DRAFT')`,
        [draftId, schoolId, teacherPhone, 'Mathematics', 'Primary 4', 'current', JSON.stringify(marksData)], 
        () => r()
    ));

    // 🚀 CRITICAL: Manually link the draft to the teacher's session context
    TeacherSessionManager.updateContext(teacherPhone, 'current_mark_draft', {
        draft_id: draftId,
        subject: 'Mathematics',
        class_level: 'Primary 4',
        term_id: 'current'
    });
    console.log("🔗 Draft linked to Mrs. Grace's active session.");

    // 4. THE HANDSHAKE (LOCKING RECORDS)
    console.log("\n--- STEP 4: THE HANDSHAKE (LOCKING RECORDS) ---");
    await sendMsg(dispatcher, teacherPhone, "I've reviewed the Math sheet. Confirm it.", schoolId, 'TA');

    // 5. BROADSHEET ANALYSIS
    console.log("\n--- STEP 5: BROADSHEET ANALYSIS ---");
    await sendMsg(dispatcher, teacherPhone, "Show me the broadsheet for Primary 4.", schoolId, 'TA');

    // 6. RESULT RELEASE
    console.log("\n--- STEP 6: RESULT RELEASE ---");
    await sendMsg(dispatcher, adminPhone, "I've signed off. Release Primary 4 results.", schoolId, 'SA');

    // 7. PARENT PULL
    console.log("\n--- STEP 7: PARENT PULL ---");
    const parentId = uuidv4();
    await new Promise<void>(r => db.getDB().run(`INSERT INTO parent_registry (parent_id, school_id, parent_phone, parent_name, parent_access_token, is_active) VALUES (?, ?, ?, 'Mr. Obi', 'PAT-KUMO-123', 1)`, [parentId, schoolId, parentPhone], () => r()));
    await new Promise<void>(r => db.getDB().run(`INSERT INTO parent_children_mapping (parent_id, student_id, school_id) VALUES (?, ?, ?)`, [parentId, 'STU-001', schoolId], () => r()));

    await sendMsg(dispatcher, parentPhone, "Can I see Chinedu's report card?", schoolId, 'PA');

    console.log("\n🏁 --- TERM SIMULATION COMPLETE --- 🏁");
}

runFullTerm().catch(err => {
    console.error("❌ SIMULATION FAILED:", err);
    process.exit(1);
});