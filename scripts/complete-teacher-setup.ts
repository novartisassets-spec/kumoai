#!/usr/bin/env node
/**
 * MANUAL TEACHER SETUP COMPLETION
 * Use this to manually complete a teacher's setup for testing
 */

const { db } = require('./src/db');
const { TASetupRepository } = require('./src/db/repositories/ta-setup.repo');

async function manualCompleteSetup() {
    console.log('\n🔧 Manual Teacher Setup Completion\n');
    
    try {
        await db.init();
        
        // Find teachers in setup
        const teachers = await new Promise<any[]>((resolve, reject) => {
            db.getDB().all(
                `SELECT t.teacher_id, t.school_id, u.name, u.phone, t.current_step 
                 FROM ta_setup_state t
                 JOIN users u ON t.teacher_id = u.id
                 WHERE t.is_active = 1`,
                (err: any, rows: any[]) => err ? reject(err) : resolve(rows || [])
            );
        });
        
        if (teachers.length === 0) {
            console.log('✅ No teachers currently in SETUP phase');
            console.log('   All teachers are operational!\n');
            return;
        }
        
        console.log(`Found ${teachers.length} teacher(s) in SETUP phase:\n`);
        teachers.forEach((t, i) => {
            console.log(`${i + 1}. ${t.name} (${t.phone})`);
            console.log(`   Step: ${t.current_step}`);
            console.log(`   ID: ${t.teacher_id}`);
            console.log();
        });
        
        // Complete all pending setups
        console.log('📝 Completing setup for all teachers...\n');
        
        for (const teacher of teachers as any[]) {
            // Force complete all setup steps
            const allSteps = ['WELCOME', 'DECLARE_WORKLOAD', 'DECLARE_SUBJECTS', 'REQUEST_REGISTERS', 'FINALIZE'];
            
            await TASetupRepository.updateSetup(teacher.teacher_id, teacher.school_id, {
                completed_steps: allSteps,
                current_step: 'FINALIZE'
            });
            
            await TASetupRepository.completeSetup(teacher.teacher_id, teacher.school_id);
            
            console.log(`✅ ${teacher.name} - Setup completed, now OPERATIONAL`);
        }
        
        console.log('\n🎉 All teachers are now operational!');
        console.log('   They can now submit marks and use all features.\n');
        
    } catch (error) {
        console.error('\n❌ Error:', (error as Error).message);
    } finally {
        db.close();
    }
}

manualCompleteSetup();