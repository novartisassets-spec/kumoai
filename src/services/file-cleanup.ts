/**
 * File Cleanup Service
 * Periodically cleans up orphaned files and expired files
 */

import { logger } from '../utils/logger';
import { getFileStorage } from './file-storage';
import fs from 'fs';
import path from 'path';
import { CONSTANTS } from '../config/constants';

export class FileCleanupService {
    private cleanupInterval: NodeJS.Timeout | null = null;

    /**
     * Start periodic cleanup job
     */
    start(intervalHours: number = CONSTANTS.FILE_STORAGE.CLEANUP_INTERVAL_HOURS): void {
        if (this.cleanupInterval) {
            logger.warn('Cleanup service already running');
            return;
        }

        logger.info({ intervalHours }, 'Starting file cleanup service');

        // Run immediately, then on interval
        this.runCleanup();

        this.cleanupInterval = setInterval(() => {
            this.runCleanup();
        }, intervalHours * 60 * 60 * 1000);
    }

    /**
     * Stop cleanup service
     */
    stop(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.info('File cleanup service stopped');
        }
    }

    /**
     * Run cleanup tasks
     */
    private async runCleanup(): Promise<void> {
        try {
            logger.info('Running file cleanup...');

            // 1. Cleanup expired files via FileStorageService
            const fileStorage = getFileStorage();
            const expiredResult = await fileStorage.cleanupExpiredFiles();
            logger.info({ 
                deletedCount: expiredResult.deletedCount, 
                freedMB: Math.round(expiredResult.freedBytes / 1024 / 1024) 
            }, 'Expired files cleaned up');

            // 2. Cleanup orphaned files in media_cache (not referenced in DB)
            await this.cleanupOrphanedMediaCache();

            logger.info('File cleanup completed');
        } catch (error) {
            logger.error({ error }, 'File cleanup failed');
        }
    }

    /**
     * Cleanup orphaned files in media_cache that are not referenced in database
     */
    private async cleanupOrphanedMediaCache(): Promise<void> {
        try {
            const mediaCacheDir = path.join(process.cwd(), 'media_cache');
            if (!fs.existsSync(mediaCacheDir)) {
                return;
            }

            const files = fs.readdirSync(mediaCacheDir);
            let orphanedCount = 0;
            let freedBytes = 0;

            for (const file of files) {
                const filePath = path.join(mediaCacheDir, file);
                const stats = fs.statSync(filePath);

                // Delete files older than 7 days that are not in database
                const ageDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                if (ageDays > 7) {
                    try {
                        fs.unlinkSync(filePath);
                        orphanedCount++;
                        freedBytes += stats.size;
                        logger.debug({ file, ageDays: Math.round(ageDays) }, 'Deleted orphaned file from media_cache');
                    } catch (err) {
                        logger.warn({ error: err, file }, 'Failed to delete orphaned file');
                    }
                }
            }

            if (orphanedCount > 0) {
                logger.info({ 
                    orphanedCount, 
                    freedMB: Math.round(freedBytes / 1024 / 1024) 
                }, 'Orphaned media_cache files cleaned up');
            }
        } catch (error) {
            logger.error({ error }, 'Failed to cleanup orphaned media_cache files');
        }
    }
}

// Singleton instance
let cleanupInstance: FileCleanupService | null = null;

export function getFileCleanupService(): FileCleanupService {
    if (!cleanupInstance) {
        cleanupInstance = new FileCleanupService();
    }
    return cleanupInstance;
}

