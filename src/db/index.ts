import { createClient, SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';

const { Pool } = pg;

export class Database {
    private static instance: Database;
    private supabase: SupabaseClient;
    private pool: pg.Pool | null = null;
    private isConnected: boolean = false;
    private isSupabaseMode: boolean = false;

    private constructor() {
        this.isSupabaseMode = !!ENV.SUPABASE_URL && !!ENV.SUPABASE_SERVICE_KEY;

        if (!this.isSupabaseMode) {
            logger.warn('Supabase credentials not found, using SQLite mode');
            this.supabase = createClient('https://placeholder.supabase.co', 'placeholder');
            return;
        }

        this.supabase = createClient(
            ENV.SUPABASE_URL,
            ENV.SUPABASE_SERVICE_KEY,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            }
        );
        logger.info({ supabaseUrl: ENV.SUPABASE_URL }, 'Supabase client initialized');
    }

    public static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    public static resetInstance(): void {
        Database.instance = null as any;
    }

    public getClient(): SupabaseClient {
        return this.supabase;
    }

    public isSupabase(): boolean {
        return this.isSupabaseMode;
    }

    // Legacy callback-style interface for compatibility with existing code
    public getDB(): any {
        const self = this;
        return {
            all: (sql: string, ...args: any[]) => {
                let params: any[] = [];
                let callback: any = null;
                
                if (args.length >= 2) {
                    if (Array.isArray(args[0])) {
                        params = args[0];
                        callback = args[1];
                    } else if (typeof args[0] === 'function') {
                        callback = args[0];
                    } else {
                        params = [args[0]];
                        callback = args[1];
                    }
                } else if (args.length === 1) {
                    if (Array.isArray(args[0])) {
                        params = args[0];
                    } else if (typeof args[0] === 'function') {
                        callback = args[0];
                    } else {
                        params = [args[0]];
                    }
                }
                
                if (callback) {
                    self.all(sql, params).then(rows => callback(null, rows)).catch(err => callback(err, []));
                } else {
                    return self.all(sql, params);
                }
            },
            get: (sql: string, ...args: any[]) => {
                let params: any[] = [];
                let callback: any = null;
                
                if (args.length >= 2) {
                    if (Array.isArray(args[0])) {
                        params = args[0];
                        callback = args[1];
                    } else if (typeof args[0] === 'function') {
                        callback = args[0];
                    } else {
                        params = [args[0]];
                        callback = args[1];
                    }
                } else if (args.length === 1) {
                    if (Array.isArray(args[0])) {
                        params = args[0];
                    } else if (typeof args[0] === 'function') {
                        callback = args[0];
                    } else {
                        params = [args[0]];
                    }
                }
                
                if (callback) {
                    self.get(sql, params).then(row => callback(null, row)).catch(err => callback(err, null));
                } else {
                    return self.get(sql, params);
                }
            },
            run: (sql: string, ...args: any[]) => {
                let params: any[] = [];
                let callback: any = null;
                
                if (args.length >= 2) {
                    if (Array.isArray(args[0])) {
                        params = args[0];
                        callback = args[1];
                    } else if (typeof args[0] === 'function') {
                        callback = args[0];
                    } else {
                        params = [args[0]];
                        callback = args[1];
                    }
                } else if (args.length === 1) {
                    if (Array.isArray(args[0])) {
                        params = args[0];
                    } else if (typeof args[0] === 'function') {
                        callback = args[0];
                    } else {
                        params = [args[0]];
                    }
                }
                
                if (callback) {
                    self.run(sql, params).then(() => callback(null)).catch(err => callback(err));
                } else {
                    return self.run(sql, params);
                }
            }
        };
    }

    private async getPool(): Promise<pg.Pool> {
        if (!this.pool) {
            this.pool = new Pool({
                host: 'aws-1-eu-west-2.pooler.supabase.com',
                port: 6543,
                database: 'postgres',
                user: 'postgres.zmfzigfqvbjsllrklqdy',
                password: 'kumo090kumo',
                ssl: {
                    rejectUnauthorized: false
                },
                connectionTimeoutMillis: 10000,
                idleTimeoutMillis: 30000
            });
        }
        return this.pool;
    }

    public async init(): Promise<void> {
        if (!this.isSupabaseMode) {
            logger.info('Running in SQLite mode - schema loading skipped');
            return;
        }

        try {
            // Test pooler connection first
            const pool = await this.getPool();
            await pool.query('SELECT 1');
            logger.info('Pooler connection verified');
            
            // Setup exec_sql function
            await this.setupExecSQLFunction();
            
            this.isConnected = true;
            logger.info('Connected to Supabase via pooler');
            
            // Check if tables exist, if not create base schema first
            const tablesExist = await this.checkTablesExist();
            if (!tablesExist) {
                logger.info('No tables found - running base schema first');
                await this.loadBaseSchema();
            }
            
            await this.loadSchemas();
        } catch (err) {
            logger.error({ err }, 'Failed to initialize Supabase');
            // Try to load schemas anyway
            await this.loadSchemas();
        }
    }

    private async checkTablesExist(): Promise<boolean> {
        try {
            const pool = await this.getPool();
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    AND table_name = 'schools'
                ) as exists
            `);
            return result.rows[0]?.exists || false;
        } catch (e) {
            return false;
        }
    }

    private async loadBaseSchema(): Promise<void> {
        try {
            const pool = await this.getPool();
            const baseSchema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
            const statements = baseSchema.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
            
            for (const statement of statements) {
                try {
                    await pool.query(statement);
                } catch (e: any) {
                    if (!e.message?.includes('already exists')) {
                        logger.debug({ statement: statement.substring(0, 50), error: e.message }, 'Statement error (continuing)');
                    }
                }
            }
            logger.info('Base schema created successfully');
        } catch (err) {
            logger.error({ err }, 'Failed to load base schema');
        }
    }

    private async setupExecSQLFunction(): Promise<void> {
        try {
            const pool = await this.getPool();
            
            const createFunctionSQL = `
                CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT)
                RETURNS void 
                LANGUAGE plpgsql
                SECURITY DEFINER
                AS $$
                BEGIN
                    EXECUTE sql_text;
                END;
                $$;
            `;
            
            await pool.query(createFunctionSQL);
            logger.info('exec_sql function created/verified');
        } catch (err) {
            logger.debug({ err }, 'Failed to create exec_sql function via pg, trying alternative method');
            try {
                const { error } = await this.supabase.rpc('exec_sql', { sql_text: 'SELECT 1' });
                if (!error || error.message.includes('already exists')) {
                    logger.info('exec_sql function already exists');
                }
            } catch (e) {
                logger.warn({ e }, 'Could not verify exec_sql function');
            }
        }
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
            { path: path.join(__dirname, 'schema_escalation_audit_log.sql'), name: 'Escalation Audit Log Table' },
            { path: path.join(__dirname, 'schema_escalation_admin_decision.sql'), name: 'Escalation Admin Decision' },
            { path: path.join(__dirname, 'schema_harper_escalation_enhancements.sql'), name: 'Harper Escalation Enhancements' },
            { path: path.join(__dirname, 'schema_primary_secondary.sql'), name: 'Primary/Secondary Support' },
            { path: path.join(__dirname, 'schema_user_schooltype.sql'), name: 'User School Type' },
            { path: path.join(__dirname, 'schema_mark_submission_workflow.sql'), name: 'Mark Submission Workflow' },
            { path: path.join(__dirname, 'schema_parent_flow.sql'), name: 'Parent Flow' },
            { path: path.join(__dirname, 'schema_universe.sql'), name: 'School Universe Config' },
            { path: path.join(__dirname, 'schema_terminal_reports.sql'), name: 'Terminal Reports' },
            { path: path.join(__dirname, 'schema_whatsapp_connection.sql'), name: 'WhatsApp Connection' },
            { path: path.join(__dirname, 'schema_whatsapp_sessions.sql'), name: 'WhatsApp Sessions' }
        ];

        for (const s of schemas) {
            logger.info({ path: s.path, name: s.name }, 'Checking schema file');
            if (!fs.existsSync(s.path)) {
                logger.warn({ path: s.path }, 'Schema file not found');
                continue;
            }
            
            const sql = fs.readFileSync(s.path, 'utf-8');
            
            // Split SQL by semicolon but preserve DO $$ blocks
            // This is a simple approach: we'll run the whole file if it contains DO $$
            let statements: string[];
            if (sql.includes('DO $$')) {
                // For files with DO $$ blocks, we need to be smarter
                // Split by ';' but reconstruct statements that contain $$
                const parts = sql.split(';');
                statements = [];
                let current = '';
                let inDollarQuote = false;
                let dollarChar = '';
                
                for (const part of parts) {
                    current += part;
                    // Check for dollar quote start/end
                    const dollarMatch = part.match(/\$([a-zA-Z_]*)\$/);
                    if (dollarMatch) {
                        if (!inDollarQuote) {
                            inDollarQuote = true;
                            dollarChar = dollarMatch[0];
                        } else if (dollarMatch[0] === dollarChar) {
                            inDollarQuote = false;
                            dollarChar = '';
                        }
                    }
                    
                    if (!inDollarQuote && current.trim().length > 0) {
                        statements.push(current.trim());
                        current = '';
                    }
                }
                if (current.trim().length > 0) {
                    statements.push(current.trim());
                }
            } else {
                statements = sql.split(';').map(st => st.trim()).filter(st => st.length > 0 && !st.startsWith('--'));
            }

            for (const statement of statements) {
                try {
                    await this.executeSQL(statement);
                } catch (err: any) {
                    const errorMsg = err.message || String(err);
                    // Only silent skip for:
                    // - duplicate/already exists (idempotent operations)
                    // - relation does not exist (indexes on tables not yet created)
                    // - column does not exist (indexes on columns not yet created)
                    if (errorMsg.includes('duplicate') || 
                        errorMsg.includes('already exists') ||
                        errorMsg.includes('relation') && errorMsg.includes('does not exist') ||
                        errorMsg.includes('column') && errorMsg.includes('does not exist')) {
                        // Silent skip for these harmless errors
                    } else {
                        logger.error({ err, schema: s.name, statement: statement.substring(0, 100) }, 'Failed to execute statement');
                    }
                }
            }
            logger.info({ schema: s.name }, 'Schema component processed');
        }
    }

    private async executeSQL(sql: string, retries = 3): Promise<void> {
        for (let i = 0; i < retries; i++) {
            try {
                const pool = await this.getPool();
                await pool.query(sql);
                return;
            } catch (err: any) {
                const errorMsg = err.message || String(err);
                // Only ignore "already exists" errors
                if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
                    return;
                }
                // Retry on network errors
                if (errorMsg.includes('fetch failed') || errorMsg.includes('ECONNREFUSED')) {
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                // Log and skip other errors
                logger.debug({ sql: sql.substring(0, 50), error: errorMsg }, 'Statement error (continuing)');
                return;
            }
        }
    }

    // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
    // Also convert SQLite boolean syntax (= 1, = 0) to PostgreSQL (= true, = false)
    // And convert SQLite date functions to PostgreSQL
    private convertParams(sql: string, params: any[] = []): { sql: string, params: any[] } {
        let newSql = sql;
        
        // Convert SQLite date functions to PostgreSQL
        newSql = newSql.replace(/datetime\('now'\)/gi, 'NOW()');
        newSql = newSql.replace(/date\('now'\)/gi, 'CURRENT_DATE');
        
        // Convert SQLite datetime('now', '+N minutes/hours/days') to PostgreSQL INTERVAL
        // datetime('now', '+15 minutes') -> NOW() + INTERVAL '15 minutes'
        newSql = newSql.replace(/datetime\('now',\s*'([^']+)'\)/gi, (match, interval) => {
            // Convert SQLite interval format to PostgreSQL
            const pgInterval = interval.replace(/^(\d+)\s+(minute|hour|day|month|year)s?$/i, '$1 $2');
            return `NOW() + INTERVAL '${pgInterval}'`;
        });
        
        if (params.length === 0) return { sql: newSql, params };
        
        // Replace ? placeholders with $1, $2, etc.
        let paramIndex = 0;
        newSql = newSql.replace(/\?/g, () => {
            paramIndex++;
            return `$${paramIndex}`;
        });
        return { sql: newSql, params };
    }

    public async run(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
        try {
            const converted = this.convertParams(sql, params);
            console.log('[DB] Running SQL:', sql.substring(0, 80));
            console.log('[DB] Params:', JSON.stringify(params));
            console.log('[DB] Converted SQL:', converted.sql.substring(0, 80));
            const pool = await this.getPool();
            const result = await pool.query(converted.sql, converted.params);
            console.log('[DB] Result:', result.rowCount);
            return { changes: result.rowCount || 0, lastInsertRowid: 0 };
        } catch (err: any) {
            const errorMsg = err.message || String(err);
            // Only silently ignore "already exists" and "duplicate" errors - don't print them
            const isHarmless = errorMsg.includes('already exists') || errorMsg.includes('duplicate');
            if (!isHarmless) {
                console.log('[DB] ERROR:', errorMsg);
                console.log('[DB] Stack:', err.stack);
            }
            // Only log and re-throw if not a harmless error
            if (!isHarmless) {
                logger.error({ sql: sql.substring(0, 100), params, error: errorMsg }, 'SQL run error');
                throw err;
            }
            return { changes: 0, lastInsertRowid: 0 };
        }
    }

    public async get(sql: string, params: any[] = []): Promise<any> {
        try {
            const converted = this.convertParams(sql, params);
            const pool = await this.getPool();
            const result = await pool.query(converted.sql, converted.params);
            return result.rows?.[0] || null;
        } catch (err: any) {
            logger.error({ sql: sql.substring(0, 100), params, error: err.message }, 'SQL get error');
            return null;
        }
    }

    public async all(sql: string, params: any[] = []): Promise<any[]> {
        try {
            const converted = this.convertParams(sql, params);
            const pool = await this.getPool();
            if (!pool) {
                logger.warn('Database pool not available');
                return [];
            }
            const result = await pool.query(converted.sql, converted.params);
            return (result?.rows) || [];
        } catch (err: any) {
            logger.error({ sql: sql.substring(0, 100), params, error: err.message }, 'SQL all error');
            return [];
        }
    }

    public close(): void {
        if (this.pool) {
            this.pool.end();
        }
        logger.info('Supabase connection closed');
    }
}

export const db = Database.getInstance();
