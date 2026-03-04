import { db } from '../src/db';
import { logger } from '../src/utils/logger';

async function standardize() {
    try {
        await db.init();
        const pool = await (db as any).getPool();
        
        console.log('Standardizing database schema for PostgreSQL (Final Sync)...');

        // 1. ta_setup_state columns
        const taSetupStateCols = [
            ['subjects', "TEXT DEFAULT '[]'"],
            ['workload_json', "TEXT DEFAULT '{}'"],
            ['progress_percentage', 'INTEGER DEFAULT 0'],
            ['completed_at', 'TIMESTAMP DEFAULT NULL'],
            ['assigned_class', 'TEXT'],
            ['current_step', 'TEXT'],
            ['completed_steps', "TEXT DEFAULT '[]'"],
            ['config_draft', "TEXT DEFAULT '{}'"],
            ['extracted_students', "TEXT DEFAULT '[]'"]
        ];

        for (const [col, type] of taSetupStateCols) {
            const check = await pool.query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='ta_setup_state' AND column_name=$1
            `, [col]);
            
            if (check.rowCount === 0) {
                console.log(`Adding column: ta_setup_state.${col}`);
                await pool.query(`ALTER TABLE ta_setup_state ADD COLUMN ${col} ${type}`);
            }
        }

        // 2. Add UNIQUE constraint for ON CONFLICT
        const constraintCheck = await pool.query(`
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name='ta_setup_state' AND constraint_name='unique_teacher_school'
        `);
        
        if (constraintCheck.rowCount === 0) {
            console.log('Adding UNIQUE constraint unique_teacher_school to ta_setup_state');
            await pool.query(`ALTER TABLE ta_setup_state ADD CONSTRAINT unique_teacher_school UNIQUE (teacher_id, school_id)`);
        }

        // 3. Convert INTEGER booleans to BOOLEAN
        const boolCols = [
            ['ta_setup_state', 'is_active'],
            ['student_attendance_records', 'present'],
            ['broadsheet_assignments', 'is_active'],
            ['student_marks_indexed', 'confirmed_by_teacher'],
            ['student_marks_indexed', 'manual_entry'],
            ['student_attendance_records', 'manual_entry'],
            ['parent_registry', 'is_active'],
            ['setup_state', 'is_active']
        ];

        for (const [table, col] of boolCols) {
            const check = await pool.query(`
                SELECT data_type FROM information_schema.columns 
                WHERE table_name=$1 AND column_name=$2
            `, [table, col]);
            
            if (check.rowCount > 0 && ['integer', 'int4', 'bigint', 'smallint'].includes(check.rows[0].data_type)) {
                console.log(`Converting ${table}.${col} to BOOLEAN`);
                await pool.query(`ALTER TABLE ${table} ALTER COLUMN ${col} DROP DEFAULT`);
                await pool.query(`ALTER TABLE ${table} ALTER COLUMN ${col} TYPE BOOLEAN USING (${col}::int = 1)`);
                
                const defaultVal = ['is_active', 'present', 'confirmed_by_teacher'].includes(col) ? 'true' : 'false';
                await pool.query(`ALTER TABLE ${table} ALTER COLUMN ${col} SET DEFAULT ${defaultVal}`);
            }
        }

        // 4. pdf_documents columns
        const pdfDocsCols = [
            ['cdn_url', 'TEXT']
        ];

        for (const [col, type] of pdfDocsCols) {
            const check = await pool.query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='pdf_documents' AND column_name=$1
            `, [col]);
            
            if (check.rowCount === 0) {
                console.log(`Adding column: pdf_documents.${col}`);
                await pool.query(`ALTER TABLE pdf_documents ADD COLUMN ${col} ${type}`);
            }
        }

        console.log('✅ Database sync completed.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    }
}

standardize();
