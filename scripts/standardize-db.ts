import { db } from '../src/db';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../src/utils/logger';

async function runStandardization(): Promise<void> {
    const sqlPath = path.join(__dirname, '../src/db/migrate_standardize_ta.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Running standardization migration...');

    // Split by semicolon and run each statement
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const statement of statements) {
        try {
            await new Promise<void>((resolve, reject) => {
                db.getDB().run(statement, (err) => {
                    if (err) {
                        // Ignore errors about columns already existing
                        if (err.message.includes('duplicate column name')) {
                            console.log(`ℹ️  Skipping duplicate column in: ${statement.substring(0, 50)}...`);
                            resolve();
                        } else if (err.message.includes('already exists')) {
                            console.log(`ℹ️  Skipping existing resource in: ${statement.substring(0, 50)}...`);
                            resolve();
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.error(`❌ Error executing statement: ${statement}`);
            console.error(error);
        }
    }

    console.log('✅ Standardization migration completed!');
    process.exit(0);
}

runStandardization().catch(err => {
    console.error(err);
    process.exit(1);
});
