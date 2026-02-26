import { db } from '../../db';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import pg from 'pg';

const { Pool } = pg;

let sharedPool: pg.Pool | null = null;

function getSharedPool(): pg.Pool {
    if (!sharedPool) {
        sharedPool = new Pool({
            host: 'aws-1-eu-west-2.pooler.supabase.com',
            port: 6543,
            database: 'postgres',
            user: 'postgres.zmfzigfqvbjsllrklqdy',
            password: 'kumo090kumo',
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000,
            max: 5 // Limit connections
        });
    }
    return sharedPool;
}

interface SerializedBuffer {
    type: string;
    data: number[];
}

function isSerializedBuffer(obj: any): obj is SerializedBuffer {
    return obj && obj.type === 'Buffer' && (Array.isArray(obj.data) || typeof obj.data === 'string');
}

function reviveBuffers(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (isSerializedBuffer(obj)) {
        if (Array.isArray(obj.data)) {
            return Buffer.from(obj.data);
        } else if (typeof obj.data === 'string') {
            return Buffer.from(obj.data, 'base64');
        }
        return Buffer.from(obj.data);
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => reviveBuffers(item));
    }
    
    if (typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            result[key] = reviveBuffers(obj[key]);
        }
        return result;
    }
    
    return obj;
}

function prepareForSerialization(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (Buffer.isBuffer(obj)) {
        return { type: 'Buffer', data: Array.from(obj) };
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => prepareForSerialization(item));
    }
    
    if (typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            result[key] = prepareForSerialization(obj[key]);
        }
        return result;
    }
    
    return obj;
}

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
                const parsed = JSON.parse(credsContent);
                creds = reviveBuffers(parsed);
            }
            
            const keysDir = path.join(sessionDir, 'keys');
            if (fs.existsSync(keysDir)) {
                const keyFiles = fs.readdirSync(keysDir);
                for (const file of keyFiles) {
                    if (file.endsWith('.json')) {
                        const keyPath = path.join(keysDir, file);
                        const keyContent = fs.readFileSync(keyPath, 'utf-8');
                        const parsed = JSON.parse(keyContent);
                        keys[file.replace('.json', '')] = reviveBuffers(parsed);
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
            fs.writeFileSync(credsPath, JSON.stringify(prepareForSerialization(creds), null, 2));
            
            const keysDir = path.join(sessionDir, 'keys');
            if (!fs.existsSync(keysDir)) {
                fs.mkdirSync(keysDir, { recursive: true });
            }
            
            for (const [keyName, keyValue] of Object.entries(keys)) {
                const keyPath = path.join(keysDir, `${keyName}.json`);
                fs.writeFileSync(keyPath, JSON.stringify(prepareForSerialization(keyValue), null, 2));
            }
        } catch (err) {
            logger.warn({ err, schoolId }, 'Failed to save auth to files');
        }
    }
    
    async function syncToDB(): Promise<void> {
        if (!db.isSupabase()) {
            logger.debug({ schoolId }, 'Supabase not configured, skipping DB sync');
            return;
        }
        
        try {
            const authData = {
                creds: prepareForSerialization(creds),
                keys: prepareForSerialization(keys),
                sessionDir: sessionDir
            };
            
            const compressed = zlib.deflateSync(JSON.stringify(authData));
            const authDataBase64 = compressed.toString('base64');
            
            // Use shared pg pool
            const pool = getSharedPool();
            
            await pool.query(`
                INSERT INTO whatsapp_sessions (school_id, auth_data, last_active_at, is_active)
                VALUES ($1, $2, NOW(), 1)
                ON CONFLICT (school_id) DO UPDATE SET
                    auth_data = EXCLUDED.auth_data,
                    last_active_at = EXCLUDED.last_active_at,
                    is_active = EXCLUDED.is_active
            `, [schoolId, authDataBase64]);
            
            logger.info({ schoolId, dataSize: authDataBase64.length }, 'Synced auth to DB via pg');
        } catch (err: any) {
            logger.error({ err: err.message, schoolId }, 'Failed to sync auth to DB');
        }
    }
    
    async function loadFromDB(): Promise<boolean> {
        if (!db.isSupabase()) return false;
        
        try {
            // Use shared pg pool
            const pool = getSharedPool();
            
            const result = await pool.query(
                'SELECT auth_data FROM whatsapp_sessions WHERE school_id = $1',
                [schoolId]
            );
            
            if (result.rows.length === 0 || !result.rows[0].auth_data) {
                return false;
            }
            
            const decompressed = zlib.inflateSync(Buffer.from(result.rows[0].auth_data, 'base64'));
            const authData = JSON.parse(decompressed.toString());
            
            creds = reviveBuffers(authData.creds) || {};
            keys = reviveBuffers(authData.keys) || {};
            
            await saveToFiles();
            
            logger.info({ schoolId }, 'Loaded auth from DB and synced to files');
            return true;
        } catch (err: any) {
            logger.warn({ err: err.message, schoolId }, 'Failed to load auth from DB, falling back to files');
            return false;
        }
    }
    
    const loadedFromDB = await loadFromDB();
    
    if (!loadedFromDB) {
        await loadFromFiles();
        // IMPORTANT: After loading from files, immediately sync to DB for persistence
        await syncToDB();
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
