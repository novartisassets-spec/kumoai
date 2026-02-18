#!/usr/bin/env node
/**
 * Diagnostic script to check school universe data
 * Run with: npx ts-node scripts/check-school-data.ts <school_id>
 */

import { db } from '../src/db';

async function checkSchoolData(schoolId?: string) {
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('🔍 KUMO SCHOOL DATA DIAGNOSTIC');
    console.log('════════════════════════════════════════════════════════════\n');

    try {
        await db.init();
        
        // If no school ID provided, show all schools
        if (!schoolId) {
            const schools: any[] = await new Promise((resolve) => {
                db.getDB().all('SELECT id, name, setup_status FROM schools', (err, rows) => resolve(rows || []));
            });
            
            console.log('📚 Available Schools:');
            schools.forEach(s => {
                console.log(`  • ${s.name} (${s.id}) - Status: ${s.setup_status}`);
            });
            console.log('\nRun with a school ID to see details: npx ts-node scripts/check-school-data.ts <school_id>\n');
            return;
        }

        // Check school record
        console.log(`🔍 Checking School: ${schoolId}\n`);
        
        const school: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT id, name, admin_phone, setup_status, school_type, 
                        classes_json, subjects_json, grading_config, active_term
                 FROM schools WHERE id = ?`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });

        if (!school) {
            console.log('❌ School not found!\n');
            return;
        }

        console.log('📋 SCHOOL RECORD:');
        console.log(`  Name: ${school.name}`);
        console.log(`  ID: ${school.id}`);
        console.log(`  Status: ${school.setup_status}`);
        console.log(`  Type: ${school.school_type}`);
        console.log(`  Active Term: ${school.active_term}`);
        console.log();

        // Parse and display classes
        console.log('📚 CLASSES:');
        let classes: string[] = [];
        if (school.classes_json) {
            try {
                classes = JSON.parse(school.classes_json);
                if (classes.length > 0) {
                    classes.forEach(c => console.log(`  • ${c}`));
                } else {
                    console.log('  ⚠️  Empty classes array');
                }
            } catch (e) {
                console.log(`  ❌ Error parsing: ${school.classes_json}`);
            }
        } else {
            console.log('  ❌ No classes_json data');
        }
        console.log();

        // Parse and display subjects
        console.log('📖 SUBJECTS (from JSON):');
        let subjects: string[] = [];
        if (school.subjects_json) {
            try {
                subjects = JSON.parse(school.subjects_json);
                if (subjects.length > 0) {
                    subjects.forEach(s => console.log(`  • ${s}`));
                } else {
                    console.log('  ⚠️  Empty subjects array');
                }
            } catch (e) {
                console.log(`  ❌ Error parsing: ${school.subjects_json}`);
            }
        } else {
            console.log('  ❌ No subjects_json data');
        }
        console.log();

        // Check subjects table
        console.log('📖 SUBJECTS (from relational table):');
        const tableSubjects: any[] = await new Promise((resolve) => {
            db.getDB().all(
                `SELECT name, class_level, code FROM subjects WHERE school_id = ? ORDER BY class_level, name`,
                [schoolId],
                (err, rows) => resolve(rows || [])
            );
        });
        
        if (tableSubjects.length > 0) {
            console.log(`  Found ${tableSubjects.length} subject entries:\n`);
            // Group by class level
            const byClass: { [key: string]: string[] } = {};
            tableSubjects.forEach(s => {
                if (!byClass[s.class_level]) byClass[s.class_level] = [];
                byClass[s.class_level].push(s.name);
            });
            
            Object.entries(byClass).forEach(([className, subs]) => {
                console.log(`  ${className}:`);
                const uniqueSubs = [...new Set(subs)];
                uniqueSubs.forEach(s => console.log(`    • ${s}`));
            });
        } else {
            console.log('  ❌ No subjects in relational table');
        }
        console.log();

        // Parse and display grading config
        console.log('📊 GRADING CONFIG:');
        if (school.grading_config) {
            try {
                const grading = JSON.parse(school.grading_config);
                if (grading.pillars && grading.pillars.length > 0) {
                    console.log(`  Total Max: ${grading.totalMax || 'N/A'}`);
                    console.log(`  Rank Students: ${grading.rankStudents ? 'Yes' : 'No'}`);
                    console.log('  Pillars:');
                    grading.pillars.forEach((p: any) => {
                        console.log(`    • ${p.name}: ${p.max_score} points`);
                    });
                } else {
                    console.log('  ⚠️  No pillars defined');
                }
            } catch (e) {
                console.log(`  ❌ Error parsing: ${school.grading_config}`);
            }
        } else {
            console.log('  ❌ No grading_config data');
        }
        console.log();

        // Check terms
        console.log('📅 ACADEMIC TERMS:');
        const terms: any[] = await new Promise((resolve) => {
            db.getDB().all(
                `SELECT id, term_name, start_date, end_date FROM academic_terms WHERE school_id = ? ORDER BY start_date`,
                [schoolId],
                (err, rows) => resolve(rows || [])
            );
        });
        
        if (terms.length > 0) {
            terms.forEach(t => {
                const now = new Date();
                const start = new Date(t.start_date);
                const end = new Date(t.end_date);
                const isCurrent = now >= start && now <= end;
                console.log(`  ${isCurrent ? '▶' : ' '} ${t.term_name} (${t.start_date} to ${t.end_date})`);
            });
        } else {
            console.log('  ❌ No terms defined');
        }
        console.log();

        // Check teachers
        console.log('👨‍🏫 TEACHERS:');
        const teachers: any[] = await new Promise((resolve) => {
            db.getDB().all(
                `SELECT name, phone, assigned_class FROM users WHERE school_id = ? AND role = 'teacher'`,
                [schoolId],
                (err, rows) => resolve(rows || [])
            );
        });
        
        if (teachers.length > 0) {
            teachers.forEach(t => {
                console.log(`  • ${t.name} (${t.phone})${t.assigned_class ? ` - ${t.assigned_class}` : ''}`);
            });
        } else {
            console.log('  ❌ No teachers registered');
        }
        console.log();

        // Check setup state
        console.log('⚙️  SETUP STATE:');
        const setupState: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT current_step, completed_steps, is_active FROM setup_state WHERE school_id = ?`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });
        
        if (setupState) {
            console.log(`  Current Step: ${setupState.current_step}`);
            console.log(`  Is Active: ${setupState.is_active ? 'Yes' : 'No'}`);
            try {
                const completed = JSON.parse(setupState.completed_steps || '[]');
                console.log(`  Completed Steps: ${completed.length > 0 ? completed.join(', ') : 'None'}`);
            } catch (e) {
                console.log(`  Completed Steps: ${setupState.completed_steps}`);
            }
        } else {
            console.log('  ❌ No setup state record');
        }
        console.log();

        // Summary
        console.log('════════════════════════════════════════════════════════════');
        console.log('📊 DATA COMPLETENESS SUMMARY');
        console.log('════════════════════════════════════════════════════════════');
        const checks = [
            { name: 'School Name', status: !!school.name },
            { name: 'Classes (JSON)', status: classes.length > 0 },
            { name: 'Subjects (JSON)', status: subjects.length > 0 },
            { name: 'Subjects (Table)', status: tableSubjects.length > 0 },
            { name: 'Terms', status: terms.length > 0 },
            { name: 'Teachers', status: teachers.length > 0 },
            { name: 'Grading Config', status: !!school.grading_config },
        ];
        
        checks.forEach(c => {
            console.log(`  ${c.status ? '✅' : '❌'} ${c.name}`);
        });
        
        const completeCount = checks.filter(c => c.status).length;
        const percent = Math.round((completeCount / checks.length) * 100);
        console.log(`\n  📈 Completeness: ${completeCount}/${checks.length} (${percent}%)`);
        
        if (percent === 100) {
            console.log('\n  ✅ All data is present! If frontend still shows empty, check:');
            console.log('     1. Browser console for errors');
            console.log('     2. Network tab for API responses');
            console.log('     3. JWT token has correct schoolId');
        } else {
            console.log('\n  ⚠️  Missing data detected. Run the sync endpoint:');
            console.log(`     POST /api/setup/sync-universe/${schoolId}`);
        }
        
        console.log('\n════════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        db.close();
    }
}

// Get school ID from command line args
const schoolId = process.argv[2];
checkSchoolData(schoolId);
