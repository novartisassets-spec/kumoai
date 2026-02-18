#!/usr/bin/env node
/**
 * Diagnostic script for teacher setup issues
 * Checks what subjects are configured vs what the teacher is seeing
 */

import { db } from '../src/db';

async function diagnoseTeacherSetup(teacherPhone: string) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║      TEACHER SETUP DIAGNOSTIC                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    await db.init();
    
    // Find teacher
    const teacher: any = await new Promise((resolve) => {
        db.getDB().get(
            `SELECT t.*, s.name as school_name, s.id as school_id, 
                    s.subjects_json, s.classes_json, s.school_type
             FROM users t
             JOIN schools s ON t.school_id = s.id
             WHERE t.phone = ? AND t.role = 'teacher'`,
            [teacherPhone.replace(/\D/g, '')],
            (err, row) => resolve(row)
        );
    });
    
    if (!teacher) {
        console.log('❌ Teacher not found with phone:', teacherPhone);
        console.log('   Try without + or spaces, e.g.: 2348012345678\n');
        db.close();
        return;
    }
    
    console.log('👨‍🏫 TEACHER INFO:');
    console.log(`  Name: ${teacher.name}`);
    console.log(`  Phone: ${teacher.phone}`);
    console.log(`  School: ${teacher.school_name} (${teacher.school_id})`);
    console.log(`  School Type: ${teacher.school_type}`);
    console.log();
    
    // Parse school universe
    console.log('📚 SCHOOL UNIVERSE (from schools table):');
    let schoolSubjects: string[] = [];
    let schoolClasses: string[] = [];
    
    try {
        schoolSubjects = JSON.parse(teacher.subjects_json || '[]');
        console.log(`  Subjects (${schoolSubjects.length}): ${schoolSubjects.join(', ')}`);
    } catch (e) {
        console.log('  ❌ Error parsing subjects_json');
    }
    
    try {
        schoolClasses = JSON.parse(teacher.classes_json || '[]');
        console.log(`  Classes (${schoolClasses.length}): ${schoolClasses.join(', ')}`);
    } catch (e) {
        console.log('  ❌ Error parsing classes_json');
    }
    console.log();
    
    // Check subjects table
    console.log('📖 SUBJECTS TABLE (relational):');
    const tableSubjects: any[] = await new Promise((resolve) => {
        db.getDB().all(
            `SELECT DISTINCT name FROM subjects WHERE school_id = ? ORDER BY name`,
            [teacher.school_id],
            (err, rows) => resolve(rows || [])
        );
    });
    
    if (tableSubjects.length > 0) {
        const subjectNames = tableSubjects.map(s => s.name);
        console.log(`  Found ${subjectNames.length} unique subjects:`);
        console.log(`  ${subjectNames.join(', ')}`);
        
        if (subjectNames.length !== schoolSubjects.length) {
            console.log(`\n  ⚠️  MISMATCH: JSON has ${schoolSubjects.length}, Table has ${subjectNames.length}`);
            console.log(`     This explains why "ALL" expands to ${schoolSubjects.length} instead of expected!`);
        }
    } else {
        console.log('  ❌ No subjects in relational table');
    }
    console.log();
    
    // Check TA setup state
    console.log('⚙️  TEACHER SETUP STATE:');
    const setupState: any = await new Promise((resolve) => {
        db.getDB().get(
            `SELECT * FROM ta_setup_state WHERE teacher_id = ?`,
            [teacher.id],
            (err, row) => resolve(row)
        );
    });
    
    if (setupState) {
        console.log(`  Current Step: ${setupState.current_step}`);
        console.log(`  Is Active: ${setupState.is_active}`);
        console.log(`  Completed Steps: ${setupState.completed_steps || 'None'}`);
        
        // Parse workload
        if (setupState.workload_json) {
            try {
                const workload = JSON.parse(setupState.workload_json);
                console.log(`  Workload:`);
                Object.entries(workload).forEach(([cls, subjects]) => {
                    const subjList = Array.isArray(subjects) ? subjects : (subjects as any) === 'ALL' ? ['ALL (will expand to school subjects)'] : subjects;
                    console.log(`    ${cls}: ${Array.isArray(subjList) ? subjList.join(', ') : subjList}`);
                });
            } catch (e) {
                console.log(`  Workload: ${setupState.workload_json}`);
            }
        }
        
        // Parse extracted students
        if (setupState.extracted_students) {
            try {
                const students = JSON.parse(setupState.extracted_students);
                console.log(`  Students (${students.length}): ${students.slice(0, 5).join(', ')}${students.length > 5 ? '...' : ''}`);
            } catch (e) {
                console.log(`  Students: Error parsing`);
            }
        }
        
        if (setupState.preview_pdf_path) {
            console.log(`  Preview PDF: ${setupState.preview_pdf_path}`);
        }
    } else {
        console.log('  ❌ No TA setup state found');
    }
    
    console.log('\n════════════════════════════════════════════════════════════\n');
    console.log('🔍 ANALYSIS:');
    
    if (schoolSubjects.length === 14) {
        console.log('  ⚠️  School has 14 subjects (appears to be DEFAULT secondary subjects)');
        console.log('  🔧 This happens when SA setup doesn\'t properly save custom subjects');
        console.log('  💡 Run the sync endpoint to fix: POST /api/setup/sync-universe/:schoolId');
    }
    
    if (tableSubjects.length > 0 && tableSubjects.length !== schoolSubjects.length) {
        console.log('  ⚠️  Subjects table has different data than subjects_json');
        console.log('  🔧 The "ALL" expansion uses subjects_json, not the relational table');
        console.log('  💡 Need to update subjects_json to match your actual subjects');
    }
    
    console.log('\n════════════════════════════════════════════════════════════\n');
    db.close();
}

// Get teacher phone from command line
const teacherPhone = process.argv[2];
if (!teacherPhone) {
    console.log('Usage: npx ts-node scripts/diagnose-teacher-setup.ts <teacher_phone>');
    console.log('Example: npx ts-node scripts/diagnose-teacher-setup.ts +2348098765432');
    process.exit(1);
}

diagnoseTeacherSetup(teacherPhone);
