/**
 * Database Migration Runner
 * Handles versioned schema migrations
 */

import { db } from '..';
import { logger } from '../../utils/logger';
import fs from 'fs';
import path from 'path';

interface Migration {
    version: number;
    name: string;
    up: string;
    down?: string;
}

export class MigrationRunner {
    private static migrationsTable = 'schema_migrations';

    /**
     * Initialize migrations table
     */
    static async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            db.getDB().run(
                `CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
                    version INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Get applied migrations
     */
    static async getAppliedMigrations(): Promise<number[]> {
        return new Promise((resolve, reject) => {
            db.getDB().all(
                `SELECT version FROM ${this.migrationsTable} ORDER BY version`,
                [],
                (err, rows: any[]) => {
                    if (err) reject(err);
                    else resolve(rows.map(r => r.version));
                }
            );
        });
    }

    /**
     * Mark migration as applied
     */
    static async markApplied(version: number, name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO ${this.migrationsTable} (version, name) VALUES (?, ?)`,
                [version, name],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Run all pending migrations
     */
    static async runMigrations(): Promise<void> {
        await this.init();
        
        const applied = await this.getAppliedMigrations();
        const migrationsDir = path.join(__dirname, 'versions');
        
        if (!fs.existsSync(migrationsDir)) {
            logger.warn('Migrations directory not found, skipping migrations');
            return;
        }

        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            const version = parseInt(file.split('-')[0]);
            if (isNaN(version)) continue;
            
            if (applied.includes(version)) {
                logger.debug({ version, file }, 'Migration already applied');
                continue;
            }

            logger.info({ version, file }, 'Running migration');
            
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
            const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

            try {
                for (const statement of statements) {
                    await new Promise<void>((resolve, reject) => {
                        db.getDB().run(statement, (err) => {
                            if (err) {
                                // Skip duplicate column/table errors
                                if (err.message.includes('duplicate column name') ||
                                    err.message.includes('already exists') ||
                                    err.message.includes('duplicate table name')) {
                                    logger.debug({ statement: statement.substring(0, 50) }, 'Skipping duplicate');
                                    resolve();
                                } else {
                                    reject(err);
                                }
                            } else {
                                resolve();
                            }
                        });
                    });
                }

                await this.markApplied(version, file);
                logger.info({ version, file }, 'Migration applied successfully');
            } catch (error) {
                logger.error({ error, version, file }, 'Migration failed');
                throw error;
            }
        }

        logger.info('All migrations completed');
    }
}

