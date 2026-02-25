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

    public getDB(): any {
        return this;
    }

    private async getPool(): Promise<pg.Pool> {
        if (!this.pool) {
            const poolerUrl = ENV.SUPABASE_URL.replace('https://', 'postgres://');
            const connectionString = `${poolerUrl}:5432/postgres?sslmode=require`;
            
            this.pool = new Pool({
                connectionString: `postgres://postgres.zmfzigfqvbjsllrklqdy:${encodeURIComponent('kumo090kumo')}@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require`,
                ssl: { rejectUnauthorized: false }
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
            await this.setupExecSQLFunction();
            
            const { data, error } = await this.supabase.from('schools').select('id').limit(1);
            if (error) {
                logger.warn({ error }, 'Tables may not exist, running migrations');
            }
            
            this.isConnected = true;
            logger.info('Connected to Supabase database');
            
            await this.loadSchemas();
        } catch (err) {
            logger.error({ err }, 'Failed to connect to Supabase, running schema migration');
            await this.loadSchemas();
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
            const statements = sql.split(';').map(st => st.trim()).filter(st => st.length > 0 && !st.startsWith('--'));

            for (const statement of statements) {
                try {
                    await this.executeSQL(statement);
                } catch (err: any) {
                    const errorMsg = err.message || String(err);
                    if (errorMsg.includes('duplicate table') || 
                        errorMsg.includes('already exists') ||
                        errorMsg.includes('duplicate column') ||
                        (errorMsg.includes('relation') && errorMsg.includes('already exists'))) {
                        // Silent skip for idempotent operations
                    } else {
                        logger.error({ err, schema: s.name, statement: statement.substring(0, 100) }, 'Failed to execute statement');
                    }
                }
            }
            logger.info({ schema: s.name }, 'Schema component processed');
        }
    }

    private async executeSQL(sql: string): Promise<void> {
        const { error } = await this.supabase.rpc('exec_sql', { sql_text: sql });
        
        if (error) {
            const errorMsg = error.message || String(error);
            if (errorMsg.includes('does not exist') || errorMsg.includes('already exists')) {
                return;
            }
            throw error;
        }
    }

    public async run(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
        try {
            const { error } = await this.supabase.rpc('exec_sql', { 
                sql_text: sql,
                params: params 
            });
            
            if (error) throw error;
            return { changes: 1, lastInsertRowid: 0 };
        } catch (err) {
            logger.error({ sql: sql.substring(0, 100), params }, 'SQL run error');
            throw err;
        }
    }

    public async get(sql: string, params: any[] = []): Promise<any> {
        try {
            const { data, error } = await this.supabase.rpc('exec_sql', { 
                sql_text: sql,
                params: params 
            });
            
            if (error) throw error;
            return data?.[0] || null;
        } catch (err) {
            logger.error({ sql: sql.substring(0, 100), params }, 'SQL get error');
            throw err;
        }
    }

    public async all(sql: string, params: any[] = []): Promise<any[]> {
        try {
            const { data, error } = await this.supabase.rpc('exec_sql', { 
                sql_text: sql,
                params: params 
            });
            
            if (error) throw error;
            return data || [];
        } catch (err) {
            logger.error({ sql: sql.substring(0, 100), params }, 'SQL all error');
            throw err;
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
