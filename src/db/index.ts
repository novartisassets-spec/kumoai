import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';

export class Database {
    private static instance: Database;
    private db: sqlite3.Database;
    private currentDbPath: string;

    private constructor(dbPath?: string) {
        this.currentDbPath = dbPath || ENV.DB_PATH;
        this.db = new sqlite3.Database(this.currentDbPath, (err) => {
            if (err) {
                logger.error({ err }, 'Could not connect to database');
                process.exit(1);
            } else {
                logger.info({ dbPath: this.currentDbPath }, 'Connected to SQLite database');
            }
        });
    }

    public static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    public static resetInstance(): Database {
        if (Database.instance) {
            Database.instance.close();
            Database.instance = null as any;
        }
        return Database.getInstance();
    }

    public static reconnect(dbPath: string): Database {
        if (Database.instance) {
            Database.instance.close();
            Database.instance = null as any;
        }
        Database.instance = new Database(dbPath);
        return Database.instance;
    }

    public getDB(): sqlite3.Database {
        return this.db;
    }

    public getCurrentPath(): string {
        return this.currentDbPath;
    }

    public async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run('PRAGMA foreign_keys = ON', (err) => {
                if (err) {
                    logger.error({ err }, 'Failed to enable foreign keys');
                    reject(err);
                    return;
                }
                logger.info('Foreign key enforcement enabled');
            });
            this.db.serialize(() => {
                resolve(this.loadSchemas().then(() => {
                    this.runAuthMigration();
                }));
            });
        });
    }

    private runAuthMigration(): void {
        const addColumnSafe = (table: string, column: string, definition: string, desc: string) => {
            this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (err) => {
                if (err) {
                    const msg = err.message.toLowerCase();
                    if (msg.includes('duplicate column name') || msg.includes('already exists')) {
                        logger.info(`${desc} column already exists`);
                    } else {
                        logger.warn({ err, table, column }, `Failed to add ${desc} column`);
                    }
                } else {
                    logger.info(`${desc} column added`);
                }
            });
        };
        
        addColumnSafe('users', 'password_hash', 'TEXT', 'password_hash');
        addColumnSafe('users', 'email', 'TEXT', 'email');
        addColumnSafe('users', 'is_active', 'INTEGER DEFAULT 1', 'is_active');
        addColumnSafe('schools', 'whatsapp_number', 'TEXT', 'whatsapp_number');
        addColumnSafe('schools', 'admin_name', 'TEXT', 'admin_name');
        addColumnSafe('ta_setup_state', 'progress_percentage', 'INTEGER DEFAULT 0', 'progress_percentage');
        this.db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            token TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`, (err) => {
            if (err && !err.message.includes('already exists')) {
                logger.warn({ err }, 'password_reset_tokens table creation');
            }
        });
        this.db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            school_id TEXT NOT NULL,
            token_jti TEXT NOT NULL UNIQUE,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            expires_at INTEGER NOT NULL,
            is_revoked INTEGER DEFAULT 0
        )`, (err) => {
            if (err && !err.message.includes('already exists')) {
                logger.warn({ err }, 'user_sessions table creation');
            }
        });
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`, (err) => {
            if (err && !err.message.includes('already exists')) {
                logger.warn({ err }, 'idx_users_phone index');
            }
        });
    }
    
    private async loadSchemas(): Promise<void> {
        const schemas = [
            { path: path.join(__dirname, 'schema.sql'), name: 'Base' },
            { path: path.join(__dirname, 'schema_phase3.sql'), name: 'Phase 3' },
            { path: path.join(__dirname, 'schema_phase4.sql'), name: 'Phase 4' },
            { path: path.join(__dirname, 'schema_amendments.sql'), name: 'Amendments' },
            { path: path.join(__dirname, 'schema_temporal.sql'), name: 'Temporal' },
            { path: path.join(__dirname, 'schema_setup.sql'), name: 'Setup' },
            { path: path.join(__dirname, 'schema_ta_setup.sql'), name: 'TA Setup' },
            { path: path.join(__dirname, 'schema_teacher_sessions.sql'), name: 'Teacher Sessions' },
            { path: path.join(__dirname, 'schema_memory.sql'), name: 'Memory' },
            { path: path.join(__dirname, 'schema_teacher_confirmation.sql'), name: 'Teacher Confirmation' },
            { path: path.join(__dirname, 'schema_student_marks_indexed.sql'), name: 'Student Marks Indexed' },
            { path: path.join(__dirname, 'schema_pdf_storage_marks.sql'), name: 'PDF Storage & Marks' },
            { path: path.join(__dirname, 'schema_sessions.sql'), name: 'Sessions' },
            { path: path.join(__dirname, 'schema_file_storage.sql'), name: 'File Storage' },
            { path: path.join(__dirname, 'schema_pdf_audit.sql'), name: 'PDF Audit Trail' },
            { path: path.join(__dirname, 'schema_escalation_system.sql'), name: 'Escalation System' },
            { path: path.join(__dirname, 'schema_escalation_audit.sql'), name: 'Escalation Audit Log' },
            { path: path.join(__dirname, 'schema_escalation_admin_decision.sql'), name: 'Escalation Admin Decision' },
            { path: path.join(__dirname, 'schema_harper_escalation_enhancements.sql'), name: 'Harper Escalation Enhancements' },
            { path: path.join(__dirname, 'schema_primary_secondary.sql'), name: 'Primary/Secondary Support' },
            { path: path.join(__dirname, 'schema_user_schooltype.sql'), name: 'User School Type' },
            { path: path.join(__dirname, 'schema_mark_submission_workflow.sql'), name: 'Mark Submission Workflow' },
            { path: path.join(__dirname, 'schema_parent_flow.sql'), name: 'Parent Flow' },
            { path: path.join(__dirname, 'schema_universe.sql'), name: 'School Universe Config' },
            { path: path.join(__dirname, 'schema_terminal_reports.sql'), name: 'Terminal Reports' }
        ];

        for (const s of schemas) {
            logger.info({ path: s.path, name: s.name }, 'Checking schema file');
            if (!fs.existsSync(s.path)) {
                logger.warn({ path: s.path }, 'Schema file not found');
                continue;
            }
            
            const sql = fs.readFileSync(s.path, 'utf-8');
            // Split by semicolon but preserve those inside quotes or strings? 
            // Simple split for now as our schemas are clean.
            const statements = sql.split(';').map(st => st.trim()).filter(st => st.length > 0);

            for (const statement of statements) {
                await new Promise<void>((resolve) => {
                    this.db.run(statement, (err) => {
                        if (err) {
                            if (err.message.includes('duplicate column name') || 
                                err.message.includes('already exists') ||
                                err.message.includes('duplicate table name')) {
                                // Silent skip for idempotent columns
                            } else {
                                logger.error({ err, schema: s.name, statement }, 'Failed to execute statement');
                            }
                        }
                        resolve();
                    });
                });
            }
            logger.info({ schema: s.name }, 'Schema component processed');
        }
    }

    public close(): void {
        this.db.close((err) => {
            if (err) {
                logger.error({ err }, 'Error closing database');
            } else {
                logger.info('Database connection closed');
            }
        });
    }
}

export const db = Database.getInstance();