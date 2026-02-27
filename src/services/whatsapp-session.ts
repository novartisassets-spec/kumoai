import { db } from '../db';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://zmfsigqfvbjsllrklqdy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const BUCKET_NAME = 'whatsapp-sessions';

/**
 * WhatsApp session storage - stores entire auth folder in Supabase Storage
 * This preserves all Baileys files (creds.json, keys, etc.) correctly
 */
export class WhatsAppSessionService {
    private supabase: any = null;
    private initialized: boolean = false;
    private bucketChecked: boolean = false;

    private async getSupabase() {
        if (!this.initialized && supabaseKey) {
            this.supabase = createClient(supabaseUrl, supabaseKey);
            this.initialized = true;
            await this.ensureBucket();
        }
        return this.supabase;
    }

    private async ensureBucket(): Promise<void> {
        if (this.bucketChecked) return;
        this.bucketChecked = true;
        
        try {
            const { data: buckets } = await this.supabase.storage.listBuckets();
            const bucketExists = buckets?.find((b: any) => b.name === BUCKET_NAME);
            
            if (!bucketExists) {
                await this.supabase.storage.createBucket(BUCKET_NAME, {
                    public: false,
                    fileSizeLimit: 52428800 // 50MB - larger for full auth folder
                });
                logger.info({ bucket: BUCKET_NAME }, 'Created WhatsApp sessions bucket');
            }
        } catch (err: any) {
            logger.warn({ err }, 'Could not ensure bucket exists');
        }
    }

    /**
     * Get the local session directory path (must match multi-socket-manager.ts)
     */
    private getSessionDir(schoolId: string): string {
        return path.resolve('kumo_auth_info', schoolId);
    }

    /**
     * Save auth folder to Supabase Storage by copying files individually
     */
    async saveSession(schoolId: string): Promise<void> {
        try {
            const sessionDir = this.getSessionDir(schoolId);
            
            // Check if directory exists
            if (!fs.existsSync(sessionDir)) {
                logger.debug({ schoolId, sessionDir }, 'Session directory does not exist yet, skipping backup');
                return;
            }

            // Check if creds.json exists (session not yet created)
            const credsPath = path.join(sessionDir, 'creds.json');
            if (!fs.existsSync(credsPath)) {
                logger.debug({ schoolId, sessionDir }, 'No creds.json yet, skipping backup');
                return;
            }

            const supabase = await this.getSupabase();
            if (!supabase) return;

            // Copy all files from session dir to storage
            const files = fs.readdirSync(sessionDir);
            for (const file of files) {
                const filePath = path.join(sessionDir, file);
                try {
                    const stat = fs.statSync(filePath);
                    if (stat.isFile()) {
                        const fileData = fs.readFileSync(filePath);
                        await supabase.storage
                            .from(BUCKET_NAME)
                            .upload(`${schoolId}/${file}`, fileData, {
                                upsert: true,
                                contentType: 'application/octet-stream'
                            });
                    } else if (stat.isDirectory()) {
                        const subfiles = fs.readdirSync(filePath);
                        for (const subfile of subfiles) {
                            const subFilePath = path.join(filePath, subfile);
                            try {
                                const subStat = fs.statSync(subFilePath);
                                if (subStat.isFile()) {
                                    const subFileData = fs.readFileSync(subFilePath);
                                    await supabase.storage
                                        .from(BUCKET_NAME)
                                        .upload(`${schoolId}/${file}/${subfile}`, subFileData, {
                                            upsert: true,
                                            contentType: 'application/octet-stream'
                                        });
                                }
                            } catch (e) {
                                // Subfile doesn't exist, skip
                            }
                        }
                    }
                } catch (e) {
                    // File doesn't exist, skip
                }
            }

            logger.info({ schoolId, fileCount: files.length }, 'Session backed up to Supabase Storage');
            await this.updateDbRecord(schoolId, true);
        } catch (err: any) {
            logger.error({ err, schoolId }, 'Failed to save WhatsApp session');
        }
    }

    /**
     * Fallback: Backup just creds.json directly (when zip unavailable)
     */
    
    /**
     * Load session from Supabase Storage (restore full auth folder)
     */
    async loadSession(schoolId: string): Promise<any> {
        try {
            const sessionDir = this.getSessionDir(schoolId);

            // Check local first
            const localCredsPath = path.join(sessionDir, 'creds.json');
            if (fs.existsSync(localCredsPath)) {
                try {
                    const credsData = fs.readFileSync(localCredsPath, 'utf-8');
                    const creds = JSON.parse(credsData);
                    if (creds?.registered) {
                        logger.info({ schoolId }, 'WhatsApp session loaded from local file');
                        return { creds };
                    }
                } catch (e) {
                    logger.warn({ schoolId }, 'Local creds corrupted, trying storage');
                }
            }

            // Try Supabase Storage - list all files in the school folder
            const supabase = await this.getSupabase();
            if (!supabase) return null;

            const { data: files, error: listError } = await supabase.storage
                .from(BUCKET_NAME)
                .list(schoolId, { limit: 100 });

            if (listError || !files || files.length === 0) {
                logger.info({ schoolId }, 'No session found in storage');
                return null;
            }

            // Create session directory if needed
            if (!fs.existsSync(sessionDir)) {
                fs.mkdirSync(sessionDir, { recursive: true });
            }

            // Download each file
            for (const file of files) {
                const { data, error } = await supabase.storage
                    .from(BUCKET_NAME)
                    .download(`${schoolId}/${file.name}`);

                if (!error && data) {
                    const fileData = Buffer.from(await data.arrayBuffer());
                    const filePath = path.join(sessionDir, file.name);
                    
                    // Handle subdirectories in path
                    const fileDir = path.dirname(filePath);
                    if (!fs.existsSync(fileDir)) {
                        fs.mkdirSync(fileDir, { recursive: true });
                    }
                    
                    fs.writeFileSync(filePath, fileData);
                }
            }

            // Verify creds exist after restore
            if (fs.existsSync(localCredsPath)) {
                const credsData = fs.readFileSync(localCredsPath, 'utf-8');
                const creds = JSON.parse(credsData);
                if (creds?.registered) {
                    logger.info({ schoolId }, 'WhatsApp session restored from storage');
                    return { creds };
                }
            }

            return null;
        } catch (err: any) {
            logger.error({ err, schoolId }, 'Failed to load WhatsApp session');
            return null;
        }
    }

    /**
     * Delete session
     */
    async deleteSession(schoolId: string): Promise<void> {
        try {
            // Delete local files
            const sessionDir = this.getSessionDir(schoolId);
            if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }

            // Delete from storage
            await this.deleteFromStorage(schoolId);

            // Update DB
            await this.updateDbRecord(schoolId, false);
            logger.info({ schoolId }, 'WhatsApp session deleted');
        } catch (err) {
            logger.error({ err, schoolId }, 'Failed to delete WhatsApp session');
        }
    }

    /**
     * Check if session exists
     */
    async sessionExists(schoolId: string): Promise<boolean> {
        try {
            const row = await db.get(
                'SELECT school_id FROM whatsapp_sessions WHERE school_id = ? AND is_active = 1',
                [schoolId]
            );
            return !!row;
        } catch (err) {
            return false;
        }
    }

    private async deleteFromStorage(schoolId: string): Promise<void> {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) return;

            await supabase.storage
                .from(BUCKET_NAME)
                .remove([`${schoolId}/auth.zip`]);
        } catch (err) {
            // Ignore
        }
    }

    private async updateDbRecord(schoolId: string, isActive: boolean): Promise<void> {
        try {
            if (db.isSupabase()) {
                await db.run(
                    `INSERT INTO whatsapp_sessions (school_id, last_active_at, is_active)
                     VALUES ($1, NOW(), $2)
                     ON CONFLICT(school_id) DO UPDATE SET
                     last_active_at = NOW(), is_active = $2`,
                    [schoolId, isActive ? 1 : 0]
                );
            }
        } catch (err) {
            // Ignore
        }
    }
}

export const whatsappSessionService = new WhatsAppSessionService();
