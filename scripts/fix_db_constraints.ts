import { db } from '../src/db';
import { logger } from '../src/utils/logger';

async function fixConstraints() {
    try {
        logger.info('🛠️ Fixing database constraints for School Universe...');
        await db.init();
        
        // SQLite trick: to 'change' a check constraint, we need to recreate the table.
        // But for now, we'll try a simpler approach if possible, or just recreate.
        
        const sqlite = db.getDB();
        
        await new Promise<void>((resolve, reject) => {
            sqlite.serialize(() => {
                sqlite.run('BEGIN TRANSACTION;');
                
                // 1. Create temporary table without the restrictive check
                sqlite.run(`
                    CREATE TABLE schools_new (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        admin_phone TEXT NOT NULL,
                        connected_whatsapp_jid TEXT,
                        whatsapp_group_jid TEXT,
                        whatsapp_group_link TEXT,
                        setup_status TEXT DEFAULT 'PENDING_SETUP',
                        config_json TEXT DEFAULT '{}',
                        school_type TEXT DEFAULT 'SECONDARY' CHECK(school_type IN ('PRIMARY', 'SECONDARY', 'BOTH')),
                        grading_config TEXT,
                        active_term TEXT,
                        classes_json TEXT,
                        subjects_json TEXT,
                        fees_config TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                
                // 2. Copy data
                sqlite.run(`
                    INSERT INTO schools_new (id, name, admin_phone, connected_whatsapp_jid, whatsapp_group_jid, whatsapp_group_link, setup_status, config_json, school_type, grading_config, active_term, classes_json, subjects_json)
                    SELECT id, name, admin_phone, connected_whatsapp_jid, whatsapp_group_jid, whatsapp_group_link, setup_status, config_json, school_type, grading_config, active_term, classes_json, subjects_json FROM schools;
                `);
                
                // 3. Drop old table and rename new one
                sqlite.run('DROP TABLE schools;');
                sqlite.run('ALTER TABLE schools_new RENAME TO schools;');
                
                sqlite.run('COMMIT;', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        logger.info('✅ Database constraints updated successfully.');
        process.exit(0);
    } catch (error) {
        logger.error({ error }, '❌ Failed to fix constraints');
        process.exit(1);
    }
}

fixConstraints();
