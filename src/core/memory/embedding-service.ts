import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../../config/env';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class EmbeddingService {
    private genAI: GoogleGenerativeAI;

    constructor() {
        this.genAI = new GoogleGenerativeAI(ENV.SA_GEMINI_API_KEY);
    }

    async getEmbedding(text: string): Promise<number[]> {
        try {
            const model = this.genAI.getGenerativeModel({ model: ENV.GEMINI_MODEL_EMBEDDING });
            const result = await model.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            logger.error({ error }, 'Failed to generate embedding');
            throw error;
        }
    }

    static cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async storeSnapshot(schoolId: string, identifier: string, summary: string, messageCount: number): Promise<void> {
        const embedding = await this.getEmbedding(summary);
        const sql = `
            INSERT INTO memory_snapshots (id, school_id, user_id, summary_text, embedding, message_count)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        return new Promise((resolve, reject) => {
            db.getDB().run(sql, [uuidv4(), schoolId, identifier, summary, JSON.stringify(embedding), messageCount], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async findRelevantSummaries(identifier: string, query: string, limit: number = 2, textFilter?: string): Promise<string[]> {
        const queryEmbedding = await this.getEmbedding(query);
        let sql = `SELECT summary_text, embedding FROM memory_snapshots WHERE user_id = ?`;
        const params: any[] = [identifier];

        if (textFilter) {
            sql += ` AND summary_text LIKE ?`;
            params.push(`%${textFilter}%`);
        }

        return new Promise((resolve, reject) => {
            db.getDB().all(sql, params, (err, rows: any[]) => {
                if (err) {
                    logger.error({ err }, 'Error fetching snapshots for retrieval');
                    return reject(err);
                }

                const results = rows.map(r => ({
                    text: r.summary_text,
                    similarity: EmbeddingService.cosineSimilarity(queryEmbedding, JSON.parse(r.embedding))
                }));

                results.sort((a, b) => b.similarity - a.similarity);
                resolve(results.slice(0, limit).map(r => r.text));
            });
        });
    }
}

export const embeddingService = new EmbeddingService();
