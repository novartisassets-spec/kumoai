import { db } from '../db';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';

// Derive the correct Supabase URL from the project ID used in the database
const PROJECT_ID = 'zmfzigfqvbjsllrklqdy';
const supabaseUrl = ENV.SUPABASE_URL || `https://${PROJECT_ID}.supabase.co`;
const supabaseKey = ENV.SUPABASE_SERVICE_KEY || ENV.SUPABASE_ANON_KEY || '';
const BUCKET_NAME = 'whatsapp-sessions';

/**
 * WhatsApp session storage - stores entire auth folder in Supabase Storage
 */
export class WhatsAppSessionService {
    private supabase: any = null;
    private initialized: boolean = false;
    private bucketChecked: boolean = false;

    private async getSupabase() {
        if (!this.initialized && supabaseKey) {
            // Force the correct URL if it's currently pointing to the typo'd version
            const finalUrl = supabaseUrl.includes('zmfsigqf') 
                ? `https://${PROJECT_ID}.supabase.co` 
                : supabaseUrl;

            this.supabase = createClient(finalUrl, supabaseKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            });
            this.initialized = true;
            logger.info({ supabaseUrl: finalUrl, keyPrefix: supabaseKey.substring(0, 10) }, 'Initializing WhatsApp Session Supabase client');
            await this.ensureBucket();
        }
        return this.supabase;
    }

    private async ensureBucket(): Promise<void> {
        if (this.bucketChecked) return;
        this.bucketChecked = true;
        
        logger.info({ bucket: BUCKET_NAME }, 'Ensuring WhatsApp sessions bucket exists');
        
        try {
            const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
            if (listError) {
                logger.error({ listError, message: listError.message }, 'Error listing buckets in WhatsApp service');
                // Don't return, try to create anyway if listing failed
            }
            
            const bucketExists = buckets?.find((b: any) => b.name === BUCKET_NAME);
            
            if (!bucketExists) {
                const { error: createError } = await this.supabase.storage.createBucket(BUCKET_NAME, {
                    public: false,
                    fileSizeLimit: 52428800 // 50MB - larger for full auth folder
                });
                if (createError) {
                    logger.warn({ createError, message: createError.message }, 'Could not create bucket (it might already exist)');
                } else {
                    logger.info({ bucket: BUCKET_NAME }, 'Created WhatsApp sessions bucket');
                }
            } else {
                logger.info({ bucket: BUCKET_NAME }, 'WhatsApp sessions bucket already exists');
            }
        } catch (err: any) {
            logger.warn({ err, message: err.message }, 'Exception while ensuring bucket exists');
        }
    }

    /**
     * Get the local session directory path (must match multi-socket-manager.ts)
     */
    private getSessionDir(schoolId: string): string {
        return path.resolve('kumo_auth_info', schoolId);
    }

    private backupLocks: Map<string, number> = new Map();
    private readonly BACKUP_COOLDOWN = 5000; // 5 seconds

    /**
     * Save auth folder to Supabase Storage by copying files individually
     */
    async saveSession(schoolId: string): Promise<void> {
        try {
            // Throttle backups to prevent "backup storm"
            const lastBackup = this.backupLocks.get(schoolId) || 0;
            if (Date.now() - lastBackup < this.BACKUP_COOLDOWN) {
                return;
            }
            this.backupLocks.set(schoolId, Date.now());

            const sessionDir = this.getSessionDir(schoolId);
            
            // Check if directory exists
            if (!fs.existsSync(sessionDir)) {
                logger.debug({ schoolId, sessionDir }, 'Session directory does not exist yet, skipping backup');
                return;
            }

            // Check if creds.json exists and is registered (valid)
            const credsPath = path.join(sessionDir, 'creds.json');
            if (!fs.existsSync(credsPath)) {
                logger.debug({ schoolId, sessionDir }, 'No creds.json yet, skipping backup');
                return;
            }

            try {
                const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
                if (!creds || !creds.registered) {
                    logger.debug({ schoolId }, 'Session not yet registered, skipping cloud backup');
                    return;
                }
            } catch (e: any) {
                logger.warn({ schoolId, error: e.message }, 'Failed to parse creds for backup check');
                return;
            }

            const supabase = await this.getSupabase();
            if (!supabase) return;

            // Copy all files from session dir to storage
            const files = fs.readdirSync(sessionDir);
            let uploadedCount = 0;

            for (const file of files) {
                const filePath = path.join(sessionDir, file);
                
                // Double check existence to prevent ENOENT (Baileys deletes files dynamically)
                if (!fs.existsSync(filePath)) continue;

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
                        uploadedCount++;
                    } else if (stat.isDirectory()) {
                        const subfiles = fs.readdirSync(filePath);
                        for (const subfile of subfiles) {
                            const subFilePath = path.join(filePath, subfile);
                            
                            if (!fs.existsSync(subFilePath)) continue;
                            
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
                                    uploadedCount++;
                                }
                            } catch (e) {
                                // Subfile doesn't exist or disappeared, skip
                            }
                        }
                    }
                } catch (e) {
                    // File doesn't exist or disappeared, skip
                }
            }

            if (uploadedCount > 0) {
                logger.info({ schoolId, fileCount: uploadedCount }, 'Session backed up to Supabase Storage');
                await this.updateDbRecord(schoolId, true);
            }
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

            if (listError) {
                logger.error({ schoolId, listError }, 'Error listing files from storage');
            }
            if (!files || files.length === 0) {
                logger.info({ schoolId, fileCount: files?.length || 0 }, 'No session found in storage');
                return null;
            }

            logger.info({ schoolId, fileCount: files.length, files: files.slice(0, 5).map(f => f.name) }, 'Found files in storage');

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
                } else {
                    // Not registered - wipe the folder so we start fresh next time
                    // (Baileys requires an empty folder for a clean pairing)
                    logger.warn({ schoolId }, 'Restored session not registered, wiping folder');
                    fs.rmSync(sessionDir, { recursive: true, force: true });
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

            // 1. List files in the root of the schoolId folder
            const { data: files } = await supabase.storage
                .from(BUCKET_NAME)
                .list(schoolId, { limit: 100 });

            if (!files || files.length === 0) return;

            const pathsToRemove: string[] = [];

            for (const file of files) {
                // If it's a file (metadata exists), add to removal list
                if (file.id || file.metadata) {
                    pathsToRemove.push(`${schoolId}/${file.name}`);
                } else {
                    // It's a directory (e.g., 'keys/'), list and add its contents
                    const { data: subfiles } = await supabase.storage
                        .from(BUCKET_NAME)
                        .list(`${schoolId}/${file.name}`, { limit: 100 });
                    
                    if (subfiles) {
                        for (const sub of subfiles) {
                            pathsToRemove.push(`${schoolId}/${file.name}/${sub.name}`);
                        }
                    }
                    // Also try to remove the folder name itself (though remove() usually takes file paths)
                    pathsToRemove.push(`${schoolId}/${file.name}`);
                }
            }

            if (pathsToRemove.length > 0) {
                const { error } = await supabase.storage
                    .from(BUCKET_NAME)
                    .remove(pathsToRemove);
                
                if (error) {
                    logger.warn({ error, schoolId }, 'Partial failure deleting session from storage');
                } else {
                    logger.info({ schoolId, fileCount: pathsToRemove.length }, 'Deleted session files from storage');
                }
            }
        } catch (err) {
            logger.warn({ err, schoolId }, 'Failed to delete session files from storage');
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
