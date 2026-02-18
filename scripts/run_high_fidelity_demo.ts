/**
 * GOD MODE DEMO - HIGH FIDELITY SIMULATION
 * 5 Students, 9 Subjects, Real Academic Ranking logic.
 */

import { db } from '../src/db';
import { AgentDispatcher } from '../src/core/dispatcher';
import { MessageRouter } from '../src/core/router';
import { visionService } from '../src/ai/vision';
import { messenger } from '../src/services/messenger';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// --- SIMULATION DATA ---
const schoolId = "SIM-SCHOOL-" + Date.now();
const subjects = [
    "Mathematics", "English Language", "Basic Science", 
    "Social Studies", "Civic Education", "Computer Studies",
    "P.H.E", "Agricultural Science", "Religious Studies"
];

const students = [
    { id: 'S1', name: 'Godwin GodMode' },
    { id: 'S2', name: 'Zainab Musa' },
    { id: 'S3', name: 'Chinedu Obi' },
    { id: 'S4', name: 'Ahmed Ali' },
    { id: 'S5', name: 'Chioma Eze' }
];

// Seeded scores to ensure realistic ranking
const getSeededScores = (studentIdx: number, subIdx: number) => {
    // Variety: some students better than others
    const base = 60 + (5 - studentIdx) * 5; 
    const noise = Math.floor(Math.random() * 15);
    const total = Math.min(98, base + noise - (subIdx * 2));
    
    // Split into CA1(20), CA2(20), Exam(60)
    const ca1 = Math.floor(total * 0.2);
    const ca2 = Math.floor(total * 0.2);
    const exam = total - ca1 - ca2;
    return { ca1, ca2, exam };
};

// --- MOCKS ---
let currentMockSubject = "";
(visionService as any).analyzeImage = async (p: string, prompt: string) => {
    if (prompt.includes('Quickly classify')) return { success: true, data: { classification: 'MARK_SHEET', confidence: 0.99 } };
    
    // Simulate extraction for ALL 5 students for the CURRENT subject
    const marks = students.map((s, idx) => {
        const scores = getSeededScores(idx, subjects.indexOf(currentMockSubject));
        return { student_name: s.name, scores };
    });

    return {
        success: true,
        confidence: 0.99,
        data: {
            doc_type: 'marks_sheet',
            subject: currentMockSubject,
            class_level: 'Primary 1',
            marks: marks
        }
    };
};

// --- HELPERS ---
async function runAsync(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        db.getDB().run(sql, params, (err) => err ? reject(err) : resolve());
    });
}

async function getAsync(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
        db.getDB().get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
}

async function simulate(dispatcher: AgentDispatcher, from: string, body: string, type = 'text', imagePath?: string) {
    const msg = { id: `M-${Date.now()}`, from, to: "BOT", type, body, mediaPath: imagePath, timestamp: Date.now(), source: 'user', isGroup: false };
    const routed = await MessageRouter.route(msg as any);
    const user = await getAsync("SELECT * FROM users WHERE phone = ?", [from]);
    if (user) {
        routed.schoolId = user.school_id;
        routed.identity = { userId: user.id, role: user.role as any, schoolId: user.school_id, phone: user.phone, name: user.name, assignedClass: user.assigned_class };
        routed.context = (user.role === 'admin' ? 'SA' : 'TA');
    }
    await dispatcher.dispatch(routed);
}

// --- MAIN ---
async function runHighFidelityDemo() {
    console.log("🧬 STARTING HIGH-FIDELITY GOD-MODE SIMULATION...");
    if (!fs.existsSync('pdf-output')) fs.mkdirSync('pdf-output');

    await db.init();
    const dispatcher = new AgentDispatcher();

    console.log("📝 Initializing School & Students...");
    const gradingConfig = {
        pillars: [
            { id: 'ca1', name: 'CA 1', max_score: 20 },
            { id: 'ca2', name: 'CA 2', max_score: 20 },
            { id: 'exam', name: 'Exam', max_score: 60 }
        ],
        total_max: 100,
        rank_students: true // Enabled for this demo
    };

    await runAsync(`INSERT INTO schools (id, name, admin_phone, school_type, grading_config, setup_status) VALUES (?, 'St. Kumo Excellence Academy', '2348000000001', 'PRIMARY', ?, 'OPERATIONAL')`, 
        [schoolId, JSON.stringify(gradingConfig)]);
    
    await runAsync(`INSERT INTO users (id, phone, role, name, school_id, assigned_class, school_type) VALUES ('T-DEMO', '2348000000002', 'teacher', 'Mrs. Benson', ?, 'Primary 1', 'PRIMARY')`, [schoolId]);
    await runAsync(`INSERT INTO users (id, phone, role, name, school_id) VALUES ('A-DEMO', '2348000000001', 'admin', 'Principal Okafor', ?)`, [schoolId]);
    
    for (const s of students) {
        await runAsync(`INSERT INTO students (student_id, school_id, name, class_level) VALUES (?, ?, ?, 'Primary 1')`, [s.id, schoolId, s.name]);
        await runAsync(`INSERT INTO class_student_mapping (id, school_id, teacher_id, class_level, student_id, student_name, roll_number, term_id) VALUES (?, ?, 'T-DEMO', 'Primary 1', ?, ?, ?, 'current')`, 
            [uuidv4(), schoolId, s.id, s.name, '00' + s.id.substring(1)]);
    }

    console.log(`📸 Simulating Mark Uploads for ${subjects.length} Subjects...`);
    
    for (const sub of subjects) {
        currentMockSubject = sub;
        process.stdout.write(`   Uploading ${sub}... `);
        
        // 1. Send image
        await simulate(dispatcher, '2348000000002', `Here are the ${sub} marks`, 'image', 'C:\fake.jpg');
        await new Promise(r => setTimeout(r, 500)); // Fast loop
        
        // 2. Confirm
        await simulate(dispatcher, '2348000000002', "Confirm");
        await new Promise(r => setTimeout(r, 500));
        
        console.log("✅");
    }

    console.log("👑 [ADMIN] Final Approval for Primary 1 Academic Cycle...");
    // Approve the LAST subject to trigger the batch generation
    await simulate(dispatcher, '2348000000001', "Approve all Primary 1 marks and generate terminal reports.");

    console.log("\n⏳ Orchestrating Ranking & AI Synthesis (15s)...");
    await new Promise(r => setTimeout(r, 15000));

    console.log("\n--- SIMULATION COMPLETE ---");
    console.log("📂 Check 'pdf-output/' for the 'batch_report_cards-*.pdf'.");
    console.log("📊 Verify columns: SUBJECT, CA 1, CA 2, EXAM, TOTAL, POS, GRADE.");
    console.log("🏆 Sorting order: Highest Aggregate Performer first.");
    
    process.exit(0);
}

runHighFidelityDemo().catch(console.error);
