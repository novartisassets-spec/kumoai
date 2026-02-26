/**
 * FILE STORAGE REPOSITORY
 * Database layer for file metadata and tracking
 */

import { db } from '../index';
import { logger } from '../../utils/logger';

export interface FileMetadata {
    fileId: string;
    schoolId: string;
    userId: string;
    fileName: string;
    fileType: 'image' | 'pdf' | 'document' | 'audio';
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    storagePath: string;
    isArchived: boolean;
    uploadedAt: Date;
    expiresAt?: Date;
}

export interface FileRecord extends FileMetadata {
    id?: number;
    createdAt?: Date;
    archivedAt?: Date;
    archiveReason?: string;
}

export class FileStorageRepository {
    /**
     * Create file metadata record
     */
    static async createFileMetadata(metadata: FileMetadata): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sql = `
                INSERT INTO file_storage (
                    file_id, school_id, user_id, file_name, file_type, mime_type,
                    size_bytes, checksum, storage_path, is_archived, uploaded_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.getDB().run(
                sql,
                [
                    metadata.fileId,
                    metadata.schoolId,
                    metadata.userId,
                    metadata.fileName,
                    metadata.fileType,
                    metadata.mimeType,
                    metadata.sizeBytes,
                    metadata.checksum,
                    metadata.storagePath,
                    metadata.isArchived ? true : false,
                    metadata.uploadedAt.toISOString(),
                    metadata.expiresAt ? metadata.expiresAt.toISOString() : null
                ],
                (err: any) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Get file metadata by ID
     */
    static async getFileMetadata(fileId: string): Promise<FileRecord | null> {
        return new Promise<FileRecord | null>((resolve, reject) => {
            const sql = `
                SELECT * FROM file_storage WHERE file_id = ? AND is_archived = false
            `;

            db.getDB().get(sql, [fileId], (err: any, row: any) => {
                if (err) reject(err);
                else if (row) {
                    resolve({
                        ...row,
                        uploadedAt: new Date(row.uploaded_at),
                        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
                        isArchived: row.is_archived === true || row.is_archived === 1
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }

    /**
     * List files for a school or user
     */
    static async listFiles(schoolId: string, userId?: string, fileType?: string): Promise<FileRecord[]> {
        return new Promise<FileRecord[]>((resolve, reject) => {
            let sql = `SELECT * FROM file_storage WHERE school_id = ? AND is_archived = false`;
            const params: any[] = [schoolId];

            if (userId) {
                sql += ` AND user_id = ?`;
                params.push(userId);
            }

            if (fileType) {
                sql += ` AND file_type = ?`;
                params.push(fileType);
            }

            sql += ` ORDER BY uploaded_at DESC`;

            db.getDB().all(sql, params, (err: any, rows: any[]) => {
                if (err) reject(err);
                else {
                    const records = rows.map(row => ({
                        ...row,
                        uploadedAt: new Date(row.uploaded_at),
                        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
                        isArchived: row.is_archived === 1
                    }));
                    resolve(records);
                }
            });
        });
    }

    /**
     * Archive file (soft delete)
     */
    static async archiveFile(fileId: string, reason: string = ''): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sql = `
                UPDATE file_storage 
                SET is_archived = true, archived_at = CURRENT_TIMESTAMP, archive_reason = ?
                WHERE file_id = ?
            `;

            db.getDB().run(sql, [reason, fileId], (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Delete file metadata permanently
     */
    static async deleteFileMetadata(fileId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sql = `DELETE FROM file_storage WHERE file_id = ?`;

            db.getDB().run(sql, [fileId], (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Get expired files (TTL exceeded)
     */
    static async getExpiredFiles(): Promise<FileRecord[]> {
        return new Promise<FileRecord[]>((resolve, reject) => {
            const sql = `
                SELECT * FROM file_storage 
                WHERE is_archived = false AND expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
            `;

            db.getDB().all(sql, [], (err: any, rows: any[]) => {
                if (err) reject(err);
                else {
                    const records = rows.map(row => ({
                        ...row,
                        uploadedAt: new Date(row.uploaded_at),
                        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
                        isArchived: row.is_archived === true || row.is_archived === 1
                    }));
                    resolve(records);
                }
            });
        });
    }

    /**
     * Get storage statistics
     */
    static async getStorageStats(schoolId: string): Promise<{
        totalFiles: number;
        totalSizeBytes: number;
        totalSizeMB: number;
        filesByType: Record<string, number>;
        oldestFile: Date | null;
        newestFile: Date | null;
    }> {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_files,
                    SUM(size_bytes) as total_size_bytes,
                    file_type,
                    MIN(uploaded_at) as oldest,
                    MAX(uploaded_at) as newest
                FROM file_storage
                WHERE school_id = ? AND is_archived = false
                GROUP BY file_type
            `;

            db.getDB().all(sql, [schoolId], (err: any, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }

                let totalFiles = 0;
                let totalSizeBytes = 0;
                const filesByType: Record<string, number> = {};
                let oldestFile: Date | null = null;
                let newestFile: Date | null = null;

                rows.forEach((row: any) => {
                    totalFiles += row.total_files || 0;
                    totalSizeBytes += row.total_size_bytes || 0;
                    filesByType[row.file_type] = row.total_files || 0;

                    if (row.oldest) {
                        const oldDate = new Date(row.oldest);
                        if (!oldestFile || oldDate < oldestFile) oldestFile = oldDate;
                    }
                    if (row.newest) {
                        const newDate = new Date(row.newest);
                        if (!newestFile || newDate > newestFile) newestFile = newDate;
                    }
                });

                resolve({
                    totalFiles,
                    totalSizeBytes,
                    totalSizeMB: Math.round(totalSizeBytes / 1024 / 1024),
                    filesByType,
                    oldestFile,
                    newestFile
                });
            });
        });
    }

    /**
     * Verify file integrity (checksum)
     */
    static async verifyChecksum(fileId: string, checksum: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const sql = `SELECT checksum FROM file_storage WHERE file_id = ?`;

            db.getDB().get(sql, [fileId], (err: any, row: any) => {
                if (err) reject(err);
                else resolve(row && row.checksum === checksum);
            });
        });
    }
}
