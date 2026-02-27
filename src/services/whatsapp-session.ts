import { db } from '../db';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://zmfsigqfvbjsllrklqdy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const BUCKET_NAME = 'whatsapp-sessions';

/**
 * WhatsApp session storage with file-based + Supabase Storage backup
 * This preserves binary data correctly
 */
export class WhatsAppSessionService {
    private supabase: any = null;
    private initialized: boolean = false;
    private bucketChecked: boolean = false;

    private async getSupabase() {
        if (!this.initialized && supabaseKey) {
            this.supabase = createClient(supabaseUrl, supabaseKey);
            this.initialized = true;
            
            // Try to create bucket if it doesn't exist
            await this.ensureBucket();
        }
        return this.supabase;
    }

    private async ensureBucket(): Promise<void> {
        if (this.bucketChecked) return;
        this.bucketChecked = true;
        
        try {
            // Check if bucket exists
            const { data: buckets } = await this.supabase.storage.listBuckets();
            const bucketExists = buckets?.find((b: any) => b.name === BUCKET_NAME);
            
            if (!bucketExists) {
                // Create bucket
                await this.supabase.storage.createBucket(BUCKET_NAME, {
                    public: false,
                    fileSizeLimit: 10485760 // 10MB
                });
                logger.info({ bucket: BUCKET_NAME }, 'Created WhatsApp sessions bucket');
            }
        } catch (err: any) {
            logger.warn({ err }, 'Could not ensure bucket exists');
        }
    }

    /**
     * Save session data to local file AND backup to Supabase Storage
     */
    async saveSession(schoolId: string, sessionData: any): Promise<void> {
        try {
            // Save to local file (for immediate use)
            const sessionDir = path.join('/tmp', 'whatsapp-sessions', schoolId);
            if (!fs.existsSync(sessionDir)) {
                fs.mkdirSync(sessionDir, { recursive: true });
            }

            // Save creds.json locally
            if (sessionData.creds) {
                const credsPath = path.join(sessionDir, 'creds.json');
                fs.writeFileSync(credsPath, JSON.stringify(sessionData.creds));
            }

            // Backup to Supabase Storage
            await this.backupToStorage(schoolId, sessionData);
            
            // Update DB record
            await this.updateDbRecord(schoolId, true);
            logger.info({ schoolId }, 'WhatsApp session saved');
        } catch (err) {
            logger.error({ err, schoolId }, 'Failed to save WhatsApp session');
        }
    }

    /**
     * Load session from local file first, then try Supabase Storage
     */
    async loadSession(schoolId: string): Promise<any> {
        try {
            // First try local file
            const sessionDir = path.join('/tmp', 'whatsapp-sessions', schoolId);
            const credsPath = path.join(sessionDir, 'creds.json');

            if (fs.existsSync(credsPath)) {
                const credsData = fs.readFileSync(credsPath, 'utf-8');
                const creds = JSON.parse(credsData);
                if (creds?.registered) {
                    logger.info({ schoolId }, 'WhatsApp session loaded from local file');
                    return { creds };
                }
            }

            // Try Supabase Storage
            const storageSession = await this.loadFromStorage(schoolId);
            if (storageSession) {
                // Restore to local file
                if (!fs.existsSync(sessionDir)) {
                    fs.mkdirSync(sessionDir, { recursive: true });
                }
                fs.writeFileSync(credsPath, JSON.stringify(storageSession.creds));
                logger.info({ schoolId }, 'WhatsApp session restored from storage');
                return storageSession;
            }

            return null;
        } catch (err) {
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
            const sessionDir = path.join('/tmp', 'whatsapp-sessions', schoolId);
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

    private async backupToStorage(schoolId: string, sessionData: any): Promise<void> {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) return;

            if (sessionData.creds) {
                // Use string directly instead of Buffer (more compatible)
                const credsJson = JSON.stringify(sessionData.creds);
                const { error } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(`${schoolId}/creds.json`, credsJson, {
                        upsert: true,
                        contentType: 'application/json'
                    });

                if (error) {
                    logger.warn({ error: error.message }, 'Failed to backup session to storage');
                } else {
                    logger.info({ schoolId }, 'Session backed up to Supabase Storage');
                }
            }
        } catch (err: any) {
            logger.warn({ err: err.message }, 'Storage backup failed');
        }
    }

    private async loadFromStorage(schoolId: string): Promise<any> {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) return null;

            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .download(`${schoolId}/creds.json`);

            if (error || !data) return null;

            const text = await data.text();
            const creds = JSON.parse(text);
            
            if (creds?.registered) {
                return { creds };
            }
            return null;
        } catch (err) {
            return null;
        }
    }

    private async deleteFromStorage(schoolId: string): Promise<void> {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) return;

            await supabase.storage
                .from(BUCKET_NAME)
                .remove([`${schoolId}/creds.json`]);
        } catch (err) {
            // Ignore errors
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
