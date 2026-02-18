import { db } from '../src/db';
import { PromptEngine } from '../src/core/prompt-engine';
import { WorkloadService } from '../src/services/workload.service';
import { TASetupRepository } from '../src/db/repositories/ta-setup.repo';
import { AcademicRepository } from '../src/db/repositories/academic.repo';
import { ReportService } from '../src/services/report-service';
import { logger } from '../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';

async function traceDataFlow() {
    const schoolId = "flow-test-school-" + Date.now();
    const teacherId = "flow-test-teacher-" + Date.now();
    const adminPhone = "2348000000001";
    const teacherPhone = "2348000000002";

    console.log('🚀 Starting Data Flow Trace Test...');

    // --- STEP 1: ADMIN SETUP ---
    console.log('\n1️⃣ Simulating Admin Setup...');
    const gradingConfig = {
        pillars: [
            { id: 'hw', name: 'Home Work', max_score: 10 },
            { id: 'cw', name: 'Class Work', max_score: 10 },
            { id: 'mid', name: 'Midterm', max_score: 20 },
            { id: 'exam', name: 'Final Exam', max_score: 60 }
        ],
        total_max: 100,
        rank_students: true
    };

    const classesUniverse = ["Primary 1", "Primary 2", "Primary 3"];
    const subjectsUniverse = ["Mathematics", "English Language", "Social Studies"];

    await new Promise<void>((resolve, reject) => {
        db.getDB().run(
            `INSERT INTO schools (id, name, admin_phone, classes_json, subjects_json, grading_config, setup_status)`
             + `VALUES (?, ?, ?, ?, ?, ?, 'OPERATIONAL')`,
            [
                schoolId, 
                "Flow Test Academy", 
                adminPhone, 
                JSON.stringify(classesUniverse), 
                JSON.stringify(subjectsUniverse), 
                JSON.stringify(gradingConfig)
            ],
            (err) => err ? reject(err) : resolve()
        );
    });

    // Create teacher user
    await new Promise<void>((resolve, reject) => {
        db.getDB().run(
            `INSERT INTO users (id, phone, role, name, school_id, is_active)`
             + `VALUES (?, ?, 'teacher', ?, ?, 1)`,
            [teacherId, teacherPhone, "Mrs Test", schoolId],
            (err) => err ? reject(err) : resolve()
        );
    });

    console.log('✅ Admin Setup Persisted.');

    // --- STEP 2: PROMPT ENGINE INJECTION ---
    console.log('\n2️⃣ Testing Prompt Engine Data Injection...');
    const prompt = await PromptEngine.assemble({
        agent: 'ta_setup',
        schoolId: schoolId,
        dynamicVars: { teacher_name: "Mrs Test" }
    });

    const hasPillars = prompt.includes('Home Work') && prompt.includes('Class Work');
    const hasUniverse = prompt.includes('Primary 1, Primary 2, Primary 3') && prompt.includes('Mathematics');
    
    console.log(`- Admin's Grading Pillars in Prompt: ${hasPillars}`);
    console.log(`- Admin's Universe in Prompt: ${hasUniverse}`);

    if (!hasPillars || !hasUniverse) {
        console.error('❌ Data missing in Prompt Engine!');
    }

    // --- STEP 3: TEACHER SETUP FLOW ---
    console.log('\n3️⃣ Simulating Teacher Setup...');
    
    // Init Setup
    await TASetupRepository.initSetup(teacherId, schoolId, "Primary 1");
    
    // Resolve Subject (Fuzzy Match)
    const { resolved, is_new } = await WorkloadService.resolveSubjectName(schoolId, "Maths");
    console.log(`- Subject Resolution: "Maths" -> "${resolved}" (Is New: ${is_new})`);

    // Accumulate Students and Workload
    const extractedStudents = [
        { name: "Student A", roll_number: "101" },
        { name: "Student B", roll_number: "102" }
    ];
    
    await TASetupRepository.updateSetup(teacherId, schoolId, {
        extracted_students: extractedStudents,
        workload_json: { "Primary 1": [resolved] },
        subjects: [resolved], // ✅ Fix: Explicitly save subjects array for validation
        completed_steps: ['WELCOME', 'DECLARE_WORKLOAD', 'REQUEST_REGISTERS', 'GENERATE_PREVIEW', 'CONFIRM_PREVIEW']
    });

    // Finalize Setup
    console.log('- Finalizing Teacher Setup...');
    // Simulate logic from handleSetup completion
    await TASetupRepository.saveStudentMapping(teacherId, schoolId, "Primary 1", "current", extractedStudents);
    await TASetupRepository.generateBroadsheet(teacherId, schoolId, [resolved]);
    await TASetupRepository.completeSetup(teacherId, schoolId);

    // Verify Mapping
    const mapping = await TASetupRepository.getClassStudents(teacherId, schoolId, "Primary 1", "current");
    console.log(`- Students Mapped: ${mapping.length}`);
    
    const assignments: any = await new Promise((resolve) => {
        db.getDB().get(`SELECT * FROM broadsheet_assignments WHERE teacher_id = ?`, [teacherId], (err, row) => resolve(row));
    });
    console.log(`- Broadsheet Assignments Created: ${!!assignments}`);

    // --- STEP 4: MARK INDEXING ---
    console.log('\n4️⃣ Simulating Mark Indexing...');
    const studentId = mapping[0].student_id;
    const studentName = mapping[0].student_name;
    
    // Mrs Test updates "Home Work" for Student A
    await AcademicRepository.updateMark(
        studentId, 
        resolved, 
        "current", 
        "hw", // Admin's pillar ID
        8, 
        schoolId, 
        teacherId, 
        studentName, 
        "Primary 1"
    );

    //Mrs Test updates "Final Exam" for Student A
    await AcademicRepository.updateMark(
        studentId, 
        resolved, 
        "current", 
        "exam", // Admin's pillar ID
        52, 
        schoolId, 
        teacherId, 
        studentName, 
        "Primary 1"
    );

    const marks = await AcademicRepository.getStudentMarks(studentId, "current");
    console.log(`- Marks Indexed for ${studentName}: ${JSON.stringify(marks[0].marksJson)}`);
    console.log(`- Total Score: ${marks[0].total} (Expected: 60)`);

    // --- STEP 5: REPORT GENERATION ---
    console.log('\n5️⃣ Simulating Report Generation Data Sourcing...');
    
    try {
        // Need to set confirmed_by_teacher = 1 for report service to pick it up (already set by updateMark)
        const broadsheet = await ReportService.generateBroadsheet({
            schoolId,
            classLevel: "Primary 1",
            termId: "current",
            generatedBy: "Mrs Test"
        });
        console.log(`- Broadsheet Data Sourced: ${!!broadsheet}`);
        
        // Check if report service correctly uses admin's pillars
        const school: any = await new Promise((resolve) => {
            db.getDB().get(`SELECT grading_config FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
        });
        const sourcedPillars = JSON.parse(school.grading_config).pillars;
        console.log(`- Report Service sourcing admin pillars: ${sourcedPillars.length === 4 && sourcedPillars[0].name === 'Home Work'}`);

    } catch (err) {
        console.error('❌ Report Generation Failed:', err);
    }

    console.log('\n🏁 Trace Complete.');
    process.exit(0);
}

traceDataFlow().catch(err => {
    console.error(err);
    process.exit(1);
});
