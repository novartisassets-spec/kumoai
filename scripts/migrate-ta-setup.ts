/**
 * TA Setup Flow Migration
 * Adds missing columns and tables for the enterprise-grade TA setup implementation
 */

import { db } from '../src/db';
import { logger } from '../src/utils/logger';

async function runTAMigration(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║        TA SETUP FLOW MIGRATION                            ║');
    console.log('║        February 6, 2026                                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    try {
        console.log('📋 Running TA Setup Flow migrations...\n');
        
        // 1. Add workload_json column to ta_setup_state
        console.log('1️⃣  Adding workload_json column to ta_setup_state...');
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `ALTER TABLE ta_setup_state ADD COLUMN workload_json TEXT DEFAULT '{}'`,
                (err) => {
                    if (err) {
                        if (err.message.includes('duplicate column')) {
                            console.log('   ⚠️  Column already exists');
                            resolve();
                        } else {
                            reject(err);
                        }
                    } else {
                        console.log('   ✅ workload_json column added');
                        resolve();
                    }
                }
            );
        });
        
        // 2. Create broadsheet_assignments table
        console.log('\n2️⃣  Creating broadsheet_assignments table...');
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `CREATE TABLE IF NOT EXISTS broadsheet_assignments (
                    id TEXT PRIMARY KEY,
                    school_id TEXT NOT NULL,
                    teacher_id TEXT NOT NULL,
                    subjects TEXT NOT NULL,
                    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1,
                    FOREIGN KEY(school_id) REFERENCES schools(id),
                    FOREIGN KEY(teacher_id) REFERENCES users(id)
                )`,
                (err) => {
                    if (err) reject(err);
                    else {
                        console.log('   ✅ broadsheet_assignments table created');
                        resolve();
                    }
                }
            );
        });
        
        // 3. Create indexes for broadsheet_assignments
        console.log('\n3️⃣  Creating indexes for broadsheet_assignments...');
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `CREATE INDEX IF NOT EXISTS idx_broadsheet_assignments_teacher ON broadsheet_assignments(teacher_id)`,
                (err) => {
                    if (err) reject(err);
                    else {
                        console.log('   ✅ idx_broadsheet_assignments_teacher index created');
                        resolve();
                    }
                }
            );
        });
        
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `CREATE INDEX IF NOT EXISTS idx_broadsheet_assignments_school ON broadsheet_assignments(school_id)`,
                (err) => {
                    if (err) reject(err);
                    else {
                        console.log('   ✅ idx_broadsheet_assignments_school index created');
                        resolve();
                    }
                }
            );
        });
        
        // Verify migration
        console.log('\n4️⃣  Verifying migration...');
        const workloadColumn: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT name FROM pragma_table_info('ta_setup_state') WHERE name='workload_json'`,
                (err, row) => resolve(row)
            );
        });
        
        if (workloadColumn) {
            console.log('   ✅ workload_json column exists');
        } else {
            console.log('   ❌ workload_json column not found');
        }
        
        const broadsheetTable: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT name FROM sqlite_master WHERE type='table' AND name='broadsheet_assignments'`,
                (err, row) => resolve(row)
            );
        });
        
        if (broadsheetTable) {
            console.log('   ✅ broadsheet_assignments table exists');
        } else {
            console.log('   ❌ broadsheet_assignments table not found');
        }
        
        console.log('\n' + '═'.repeat(60));
        console.log('✅ TA Setup Flow Migration Complete!');
        console.log('═'.repeat(60) + '\n');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
runTAMigration().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
});
