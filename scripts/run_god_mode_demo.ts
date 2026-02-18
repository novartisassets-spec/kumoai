/**
 * GOD MODE DEMO - PERSISTENT RUN
 * Runs the full proactive flow on kumo.db and keeps all artifacts.
 */

import { db } from '../src/db';
import { AgentDispatcher } from '../src/core/dispatcher';
import { MessageRouter } from '../src/core/router';
import { visionService } from '../src/ai/vision';
import { messenger } from '../src/services/messenger';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// --- CONFIG ---
const schoolId = "DEMO-SCHOOL-" + Date.now();
const studentName = "John Demo student";

// --- MOCKS ---
// Mock Vision to simulate mark extraction
(visionService as any).analyzeImage = async (p: string, prompt: string) => {
    if (prompt.includes('Quickly classify')) return { success: true, data: { classification: 'MARK_SHEET', confidence: 0.99 } };
    return {
        success: true,
        confidence: 0.99,
        data: {
            doc_type: 'marks_sheet',
            subject: 'Mathematics',
            class_level: 'Primary 1',
            marks: [{ student_name: studentName, scores: { ca1: 18, ca2: 19, exam: 55 } }]
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
    const user = await getAsync("SELECT * FROM users WHERE phone = ?", [from]);
    if (user) {
        routed.schoolId = user.school_id;
        routed.identity = { 
            userId: user.id, 
            role: user.role as any, 
            schoolId: user.school_id, 
            phone: user.phone, 
            name: user.name,
            assignedClass: user.assigned_class
        };
        routed.context = (user.role === 'admin' ? 'SA' : 'TA');
    }
    await dispatcher.dispatch(routed);
}

// --- MAIN ---
async function runDemo() {
    console.log("🚀 STARTING PERSISTENT GOD-MODE DEMO...");
    
    // Ensure pdf-output exists
    if (!fs.existsSync('pdf-output')) fs.mkdirSync('pdf-output');

    // Initialize database (since hard-reset was run)
    await db.init();
    const dispatcher = new AgentDispatcher();

    console.log("📝 Setting up Demo Data...");
    
    const gradingConfig = {
        pillars: [
            { id: 'ca1', name: 'CA 1', max_score: 20 },
            { id: 'ca2', name: 'CA 2', max_score: 20 },
            { id: 'exam', name: 'Exam', max_score: 60 }
        ],
        total_max: 100,
        rank_students: false
    };

    await runAsync(`INSERT INTO schools (id, name, admin_phone, school_type, grading_config, setup_status) VALUES (?, 'Demo Excellence Academy', '2348000000001', 'PRIMARY', ?, 'OPERATIONAL')`, 
        [schoolId, JSON.stringify(gradingConfig)]);
    
    await runAsync(`INSERT INTO users (id, phone, role, name, school_id, assigned_class, school_type) VALUES ('T-DEMO', '2348000000002', 'teacher', 'Mr. Teacher', ?, 'Primary 1', 'PRIMARY')`, [schoolId]);
    await runAsync(`INSERT INTO users (id, phone, role, name, school_id) VALUES ('A-DEMO', '2348000000001', 'admin', 'Principal Admin', ?)`, [schoolId]);
    
    await runAsync(`INSERT INTO students (student_id, school_id, name, class_level) VALUES ('S-DEMO', ?, ?, 'Primary 1')`, [schoolId, studentName]);
    await runAsync(`INSERT INTO class_student_mapping (id, school_id, teacher_id, class_level, student_id, student_name, roll_number, term_id) VALUES ('M-DEMO', ?, 'T-DEMO', 'Primary 1', 'S-DEMO', ?, '001', 'current')`, [schoolId, studentName]);

    console.log("📸 [TEACHER] Sending Marks Image...");
    await simulate(dispatcher, '2348000000002', "Here are the Math marks for Primary 1", 'image', 'C:\\fake.jpg');
    
    console.log("💬 [TEACHER] Confirming Extracted Data...");
    await new Promise(r => setTimeout(r, 3000));
    await simulate(dispatcher, '2348000000002', "I confirm these marks are correct.");

    console.log("👑 [ADMIN] Approving and Triggering God-Mode...");
    await new Promise(r => setTimeout(r, 5000));
    await simulate(dispatcher, '2348000000001', "Approved. Generate the reports now.");

    console.log("\n⏳ Orchestrating AI Remarks and PDFs (10s)...");
    await new Promise(r => setTimeout(r, 10000));

    console.log("\n--- DEMO COMPLETE ---");
    console.log("📂 Check the 'pdf-output/' directory for the 'batch_report_cards-*.pdf' file.");
    console.log("🗄️ Database 'kumo.db' now contains the full history of this run.");
    
    process.exit(0);
}

runDemo().catch(console.error);
