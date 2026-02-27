import { db } from '../db';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

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
     * Save entire auth folder to Supabase Storage (as zip)
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

            // Zip the entire auth folder - use temp location
            const tempDir = '/tmp';
            const zipPath = `${tempDir}/${schoolId}.zip`;
            
            // Remove existing zip if any
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
            }

            // Create zip using system zip command
            const parentDir = path.dirname(sessionDir);
            try {
                execSync(`cd ${parentDir} && zip -r ${schoolId}.zip ${schoolId}`, { stdio: 'ignore' });
            } catch (zipErr) {
                logger.warn({ schoolId, err: zipErr }, 'Zip command failed, trying alternative method');
                // Fallback: just copy creds.json directly
                await this.backupCredsDirect(schoolId, sessionDir);
                return;
            }

            if (!fs.existsSync(zipPath)) {
                logger.error({ schoolId }, 'Failed to create zip file');
                return;
            }

            // Upload zip to Supabase Storage
            const supabase = await this.getSupabase();
            if (supabase) {
                const zipData = fs.readFileSync(zipPath);
                const { error } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(`${schoolId}/auth.zip`, zipData, {
                        upsert: true,
                        contentType: 'application/zip'
                    });

                if (error) {
                    logger.warn({ error: error.message }, 'Failed to backup session to storage');
                } else {
                    logger.info({ schoolId }, 'Session folder backed up to Supabase Storage');
                }
            }

            // Clean up zip
            fs.unlinkSync(zipPath);
            
            // Update DB record
            await this.updateDbRecord(schoolId, true);
            logger.info({ schoolId }, 'WhatsApp session saved');
        } catch (err: any) {
            logger.error({ err, schoolId }, 'Failed to save WhatsApp session');
        }
    }

    /**
     * Fallback: Backup just creds.json directly (when zip unavailable)
     */
    private async backupCredsDirect(schoolId: string, sessionDir: string): Promise<void> {
        try {
            const credsPath = path.join(sessionDir, 'creds.json');
            if (!fs.existsSync(credsPath)) return;

            const supabase = await this.getSupabase();
            if (!supabase) return;

            const credsData = fs.readFileSync(credsPath, 'utf-8');
            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(`${schoolId}/creds.json`, credsData, {
                    upsert: true,
                    contentType: 'application/json'
                });

            if (error) {
                logger.warn({ error: error.message }, 'Failed to backup creds directly');
            } else {
                logger.info({ schoolId }, 'Session creds backed up directly');
            }
        } catch (err: any) {
            logger.warn({ err: err.message }, 'Direct backup failed');
        }
    }

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

            // Try Supabase Storage
            const supabase = await this.getSupabase();
            if (!supabase) return null;

            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .download(`${schoolId}/auth.zip`);

            if (error || !data) {
                logger.info({ schoolId }, 'No session found in storage');
                return null;
            }

            // Save zip temporarily
            const tempDir = '/tmp';
            const zipPath = `${tempDir}/${schoolId}.zip`;
            const zipBuffer = Buffer.from(await data.arrayBuffer());
            fs.writeFileSync(zipPath, zipBuffer);

            // Create session directory parent if needed
            const parentDir = path.dirname(sessionDir);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }

            // Extract zip to parent dir (will extract to kumo_auth_info/{schoolId})
            execSync(`cd ${parentDir} && unzip -o ${schoolId}.zip`, { stdio: 'ignore' });

            // Clean up zip
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
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
