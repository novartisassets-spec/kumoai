import { db } from '../../db';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface AuthState {
    creds: any;
    keys: any;
}

interface DBSessionData {
    school_id: string;
    auth_data: Buffer | null;
    phone_number?: string;
    connected_at?: string;
    last_active_at?: string;
}

function getSessionDir(schoolId: string): string {
    const authBaseDir = path.resolve('kumo_auth_info');
    return path.join(authBaseDir, schoolId);
}

export async function useDBAuthState(schoolId: string): Promise<{
    state: AuthState;
    saveCreds: () => Promise<void>;
    saveState: (keys: any) => Promise<void>;
}> {
    const tableName = 'whatsapp_sessions';
    const sessionDir = getSessionDir(schoolId);
    
    let creds: any = {};
    let keys: any = {};
    
    async function loadFromFiles(): Promise<void> {
        try {
            const credsPath = path.join(sessionDir, 'creds.json');
            if (fs.existsSync(credsPath)) {
                const credsContent = fs.readFileSync(credsPath, 'utf-8');
                creds = JSON.parse(credsContent);
            }
            
            const keysDir = path.join(sessionDir, 'keys');
            if (fs.existsSync(keysDir)) {
                const keyFiles = fs.readdirSync(keysDir);
                for (const file of keyFiles) {
                    if (file.endsWith('.json')) {
                        const keyPath = path.join(keysDir, file);
                        const keyContent = fs.readFileSync(keyPath, 'utf-8');
                        keys[file.replace('.json', '')] = JSON.parse(keyContent);
                    }
                }
            }
            
            if (Object.keys(creds).length > 0 || Object.keys(keys).length > 0) {
                logger.info({ schoolId, credsKeys: Object.keys(creds).length, keyFiles: Object.keys(keys).length }, 'Loaded auth from files');
            }
        } catch (err) {
            logger.warn({ err, schoolId }, 'Failed to load auth from files');
        }
    }
    
    async function saveToFiles(): Promise<void> {
        try {
            if (!fs.existsSync(sessionDir)) {
                fs.mkdirSync(sessionDir, { recursive: true });
            }
            
            const credsPath = path.join(sessionDir, 'creds.json');
            fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
            
            const keysDir = path.join(sessionDir, 'keys');
            if (!fs.existsSync(keysDir)) {
                fs.mkdirSync(keysDir, { recursive: true });
            }
            
            for (const [keyName, keyValue] of Object.entries(keys)) {
                const keyPath = path.join(keysDir, `${keyName}.json`);
                fs.writeFileSync(keyPath, JSON.stringify(keyValue, null, 2));
            }
        } catch (err) {
            logger.warn({ err, schoolId }, 'Failed to save auth to files');
        }
    }
    
    async function syncToDB(): Promise<void> {
        if (!db.isSupabase()) return;
        
        try {
            const authData = {
                creds,
                keys,
                sessionDir: sessionDir
            };
            
            const compressed = zlib.deflateSync(JSON.stringify(authData));
            
            const { error } = await db.getClient()
                .from(tableName)
                .upsert({
                    school_id: schoolId,
                    auth_data: compressed.toString('base64'),
                    last_active_at: new Date().toISOString()
                }, {
                    onConflict: 'school_id'
                });
            
            if (error) {
                logger.warn({ error, schoolId }, 'Failed to sync auth to DB');
            } else {
                logger.info({ schoolId }, 'Synced auth to DB');
            }
        } catch (err) {
            logger.warn({ err, schoolId }, 'Failed to sync auth to DB');
        }
    }
    
    async function loadFromDB(): Promise<boolean> {
        if (!db.isSupabase()) return false;
        
        try {
            const { data, error } = await db.getClient()
                .from(tableName)
                .select('auth_data')
                .eq('school_id', schoolId)
                .single();
            
            if (error || !data?.auth_data) {
                return false;
            }
            
            const decompressed = zlib.inflateSync(Buffer.from(data.auth_data, 'base64'));
            const authData = JSON.parse(decompressed.toString());
            
            creds = authData.creds || {};
            keys = authData.keys || {};
            
            await saveToFiles();
            
            logger.info({ schoolId }, 'Loaded auth from DB and synced to files');
            return true;
        } catch (err) {
            logger.warn({ err, schoolId }, 'Failed to load auth from DB, falling back to files');
            return false;
        }
    }
    
    const loadedFromDB = await loadFromDB();
    
    if (!loadedFromDB) {
        await loadFromFiles();
    }
    
    async function saveCredsInternal(): Promise<void> {
        await saveToFiles();
        await syncToDB();
    }
    
    return {
        state: { creds, keys },
        saveCreds: saveCredsInternal,
        saveState: async (newKeys: any) => {
            keys = { ...keys, ...newKeys };
            await saveCredsInternal();
        }
    };
}

export async function deleteDBSession(schoolId: string): Promise<void> {
    try {
        if (db.isSupabase()) {
            await db.getClient()
                .from('whatsapp_sessions')
                .delete()
                .eq('school_id', schoolId);
        }
        
        const sessionDir = getSessionDir(schoolId);
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        
        logger.info({ schoolId }, 'Deleted WhatsApp session from DB and files');
    } catch (err) {
        logger.warn({ err, schoolId }, 'Failed to delete WhatsApp session');
    }
}
