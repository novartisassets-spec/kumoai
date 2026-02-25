import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';

export interface UploadResult {
    success: boolean;
    path: string;
    url: string;
    bucket: string;
}

class SupabaseStorageService {
    private client: SupabaseClient | null = null;
    private initialized: boolean = false;

    private getClient(): SupabaseClient | null {
        if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_KEY) {
            return null;
        }

        if (!this.client) {
            this.client = createClient(
                ENV.SUPABASE_URL,
                ENV.SUPABASE_SERVICE_KEY
            );
        }
        return this.client;
    }

    public isAvailable(): boolean {
        return !!(ENV.SUPABASE_URL && ENV.SUPABASE_SERVICE_KEY);
    }

    public async ensureBuckets(): Promise<void> {
        const client = this.getClient();
        if (!client) {
            logger.warn('Supabase not available, skipping bucket creation');
            return;
        }

        const buckets = ['media', 'pdf-output', 'avatars'];

        for (const bucket of buckets) {
            try {
                const { data, error } = await client.storage.listBuckets();
                
                if (error) {
                    logger.warn({ error, bucket }, 'Failed to list buckets');
                    continue;
                }

                const exists = data?.find(b => b.name === bucket);
                if (!exists) {
                    const { error: createError } = await client.storage.createBucket(bucket, {
                        public: true,
                        allowedMimeTypes: this.getMimeTypesForBucket(bucket),
                        fileSizeLimit: bucket === 'media' ? '10MB' : '50MB'
                    });

                    if (createError) {
                        logger.warn({ error: createError, bucket }, 'Failed to create bucket');
                    } else {
                        logger.info({ bucket }, 'Created Supabase storage bucket');
                    }
                }
            } catch (err) {
                logger.warn({ err, bucket }, 'Error ensuring bucket exists');
            }
        }
    }

    private getMimeTypesForBucket(bucket: string): string[] {
        switch (bucket) {
            case 'media':
                return ['image/*', 'audio/*', 'video/*', 'application/pdf'];
            case 'pdf-output':
                return ['application/pdf'];
            case 'avatars':
                return ['image/*'];
            default:
                return ['*/*'];
        }
    }

    public async uploadFile(
        bucket: string,
        filePath: string,
        fileBuffer: Buffer,
        mimeType: string
    ): Promise<UploadResult> {
        const client = this.getClient();
        if (!client) {
            throw new Error('Supabase not available');
        }

        try {
            const { data, error } = await client.storage
                .from(bucket)
                .upload(filePath, fileBuffer, {
                    contentType: mimeType,
                    upsert: true
                });

            if (error) {
                logger.error({ error, bucket, filePath }, 'Failed to upload to Supabase Storage');
                throw error;
            }

            const { data: urlData } = client.storage
                .from(bucket)
                .getPublicUrl(filePath);

            logger.info({ bucket, filePath }, 'File uploaded to Supabase Storage');

            return {
                success: true,
                path: data.path,
                url: urlData.publicUrl,
                bucket
            };
        } catch (err) {
            logger.error({ err, bucket, filePath }, 'Supabase upload failed');
            throw err;
        }
    }

    public async deleteFile(bucket: string, filePath: string): Promise<void> {
        const client = this.getClient();
        if (!client) {
            throw new Error('Supabase not available');
        }

        try {
            const { error } = await client.storage
                .from(bucket)
                .remove([filePath]);

            if (error) {
                logger.warn({ error, bucket, filePath }, 'Failed to delete from Supabase');
            }
        } catch (err) {
            logger.warn({ err, bucket, filePath }, 'Error deleting from Supabase');
        }
    }

    public getPublicUrl(bucket: string, filePath: string): string {
        if (!ENV.SUPABASE_URL) {
            return '';
        }
        return `${ENV.SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;
    }
}

export const supabaseStorage = new SupabaseStorageService();
