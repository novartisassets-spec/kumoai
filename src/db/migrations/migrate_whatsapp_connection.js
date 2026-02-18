/**
 * Safe migration for WhatsApp multi-connection support
 * Run with: npx ts-node src/db/migrations/migrate_whatsapp_connection.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'kumo.db');
const db = new sqlite3.Database(dbPath);

async function migrate() {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // Add columns one by one, checking if they exist
                const columnsToAdd = [
                    { name: 'whatsapp_connection_status', type: 'TEXT DEFAULT "disconnected"' },
                    { name: 'qr_refresh_count', type: 'INTEGER DEFAULT 0' },
                    { name: 'qr_refresh_locked_until', type: 'DATETIME' },
                    { name: 'last_connection_at', type: 'DATETIME' }
                ];

                for (const col of columnsToAdd) {
                    await checkAndAddColumn(col.name, col.type);
                }

                // Create QR history table
                db.run(`
                    CREATE TABLE IF NOT EXISTS whatsapp_qr_history (
                        id TEXT PRIMARY KEY,
                        school_id TEXT NOT NULL,
                        qr_generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        connection_status TEXT DEFAULT 'pending',
                        qr_data TEXT,
                        FOREIGN KEY (school_id) REFERENCES schools(id))
                `);

                // Create indexes
                db.run(`CREATE INDEX IF NOT EXISTS idx_schools_connection_status ON schools(whatsapp_connection_status)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_schools_admin_phone ON schools(admin_phone)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_qr_history_school ON whatsapp_qr_history(school_id, qr_generated_at DESC)`);

                console.log('✅ Migration completed successfully');
                resolve();
            } catch (err) {
                console.error('❌ Migration failed:', err);
                reject(err);
            }
        });
    });
}

function checkAndAddColumn(columnName, columnType) {
    return new Promise((resolve, reject) => {
        db.run(`ALTER TABLE schools ADD COLUMN ${columnName} ${columnType}`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.log(`⚠️ Could not add ${columnName}: ${err.message}`);
            } else {
                console.log(`✅ Added column: ${columnName}`);
            }
            resolve();
        });
    });
}

migrate().then(() => db.close()).catch(err => { console.error(err); db.close(); process.exit(1); });
