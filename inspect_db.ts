import { Database } from './src/db';
const db = Database.getInstance();

async function inspect() {
    try {
        const schools: any[] = await new Promise((resolve, reject) => {
            db.getDB().all('SELECT id, name, school_type, setup_status, classes_json, subjects_json, grading_config FROM schools ORDER BY created_at DESC LIMIT 5', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log('--- LATEST SCHOOLS ---');
        for (const school of schools) {
            console.log(`\n🏫 School: ${school.name} (ID: ${school.id})`);
            console.log(`   Type: ${school.school_type}, Status: ${school.setup_status}`);
            console.log(`   Classes: ${school.classes_json}`);
            console.log(`   Subjects Count: ${school.subjects_json ? JSON.parse(school.subjects_json).length : 0}`);
            console.log(`   Grading Config: ${school.grading_config}`);
            
            const terms: any[] = await new Promise((resolve) => {
                db.getDB().all('SELECT * FROM academic_terms WHERE school_id = ?', [school.id], (err, rows) => resolve(rows || []));
            });
            console.log(`   Terms: ${terms.length}`);

            const subjects: any[] = await new Promise((resolve) => {
                db.getDB().all('SELECT COUNT(*) as count FROM subjects WHERE school_id = ?', [school.id], (err, row: any) => resolve(row?.count || 0));
            });
            console.log(`   Subjects in Table: ${subjects}`);
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

inspect();
