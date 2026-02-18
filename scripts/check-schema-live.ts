import { db } from '../src/db';

async function checkSchema() {
    const tables = ['class_student_mapping', 'student_broadsheet', 'student_marks_indexed', 'student_attendance_records'];
    
    for (const table of tables) {
        console.log(`\n--- ${table} ---`);
        await new Promise<void>((resolve) => {
            db.getDB().all(`PRAGMA table_info(${table})`, (err, rows: any[]) => {
                if (err) console.error(err);
                else {
                    rows.forEach(row => console.log(`${row.name}: ${row.type}`));
                }
                resolve();
            });
        });
    }
    process.exit(0);
}

checkSchema();
