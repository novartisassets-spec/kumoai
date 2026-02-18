import { db } from '..';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface Transaction {
    id: string;
    schoolId: string;
    studentId: string;
    payerPhone: string;
    amount: number;
    currency: string;
    status: 'pending_review' | 'confirmed' | 'rejected';
    popImagePath: string;
    reviewedBy?: string;
    reviewNote?: string;
    createdAt: Date;
    updatedAt: Date;
}

export class TransactionRepository {
    
    static async createTransaction(
        schoolId: string,
        studentId: string,
        payerPhone: string,
        amount: number,
        popImagePath: string,
        currency: string = 'NGN'
    ): Promise<string> {
        const id = uuidv4();
        const sql = `
            INSERT INTO transactions (id, school_id, student_id, payer_phone, amount, currency, status, pop_image_path)
            VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?)
        `;
        
        return new Promise((resolve, reject) => {
            db.getDB().run(sql, [id, schoolId, studentId, payerPhone, amount, currency, popImagePath], (err) => {
                if (err) {
                    logger.error({ error: err, schoolId, studentId }, 'Failed to create transaction');
                    reject(err);
                } else {
                    logger.info({ transactionId: id, amount, status: 'pending_review' }, 'Transaction created');
                    resolve(id);
                }
            });
        });
    }

    static async getTransaction(transactionId: string): Promise<Transaction | null> {
        const sql = `SELECT * FROM transactions WHERE id = ?`;
        
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, [transactionId], (err, row: any) => {
                if (err) {
                    logger.error({ error: err, transactionId }, 'Failed to fetch transaction');
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve({
                        id: row.id,
                        schoolId: row.school_id,
                        studentId: row.student_id,
                        payerPhone: row.payer_phone,
                        amount: row.amount,
                        currency: row.currency,
                        status: row.status,
                        popImagePath: row.pop_image_path,
                        reviewedBy: row.reviewed_by,
                        reviewNote: row.review_note,
                        createdAt: new Date(row.created_at),
                        updatedAt: new Date(row.updated_at)
                    });
                }
            });
        });
    }

    static async confirmTransaction(
        transactionId: string,
        reviewedByPhone: string,
        reviewNote?: string
    ): Promise<void> {
        const sql = `
            UPDATE transactions 
            SET status = 'confirmed', reviewed_by = ?, review_note = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        const auditSql = `
            INSERT INTO audit_logs (id, actor_phone, action, target_resource, details, timestamp)
            VALUES (?, ?, 'CONFIRM_PAYMENT', ?, ?, ?)
        `;
        
        return new Promise((resolve, reject) => {
            const auditId = uuidv4();
            const details = JSON.stringify({ action: 'CONFIRMED', note: reviewNote });
            
            db.getDB().run('BEGIN TRANSACTION', (beginErr) => {
                if (beginErr) {
                    logger.error({ error: beginErr }, 'Failed to begin transaction');
                    reject(beginErr);
                    return;
                }
                
                db.getDB().run(sql, [reviewedByPhone, reviewNote || null, transactionId], (err) => {
                    if (err) {
                        logger.error({ error: err, transactionId }, 'Failed to confirm transaction');
                        db.getDB().run('ROLLBACK', () => {});
                        reject(err);
                        return;
                    }
                    
                    db.getDB().run(auditSql, [auditId, reviewedByPhone, `transaction:${transactionId}`, details, Date.now()], (auditErr) => {
                        if (auditErr) {
                            logger.error({ error: auditErr, transactionId }, 'Failed to log payment confirmation');
                            db.getDB().run('ROLLBACK', () => {});
                            reject(auditErr);
                            return;
                        }
                        
                        db.getDB().run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                logger.error({ error: commitErr }, 'Failed to commit transaction');
                                reject(commitErr);
                                return;
                            }
                            logger.info({ transactionId, reviewedBy: reviewedByPhone }, 'Transaction confirmed');
                            resolve();
                        });
                    });
                });
            });
        });
    }

    static async rejectTransaction(
        transactionId: string,
        reviewedByPhone: string,
        reason: string
    ): Promise<void> {
        const sql = `
            UPDATE transactions 
            SET status = 'rejected', reviewed_by = ?, review_note = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        const auditSql = `
            INSERT INTO audit_logs (id, actor_phone, action, target_resource, details, timestamp)
            VALUES (?, ?, 'REJECT_PAYMENT', ?, ?, ?)
        `;
        
        return new Promise((resolve, reject) => {
            const auditId = uuidv4();
            const details = JSON.stringify({ action: 'REJECTED', reason });
            
            db.getDB().run('BEGIN TRANSACTION', (beginErr) => {
                if (beginErr) {
                    logger.error({ error: beginErr }, 'Failed to begin transaction');
                    reject(beginErr);
                    return;
                }
                
                db.getDB().run(sql, [reviewedByPhone, reason, transactionId], (err) => {
                    if (err) {
                        logger.error({ error: err, transactionId }, 'Failed to reject transaction');
                        db.getDB().run('ROLLBACK', () => {});
                        reject(err);
                        return;
                    }
                    
                    db.getDB().run(auditSql, [auditId, reviewedByPhone, `transaction:${transactionId}`, details, Date.now()], (auditErr) => {
                        if (auditErr) {
                            logger.error({ error: auditErr, transactionId }, 'Failed to log payment rejection');
                            db.getDB().run('ROLLBACK', () => {});
                            reject(auditErr);
                            return;
                        }
                        
                        db.getDB().run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                logger.error({ error: commitErr }, 'Failed to commit transaction');
                                reject(commitErr);
                                return;
                            }
                            logger.info({ transactionId, reviewedBy: reviewedByPhone, reason }, 'Transaction rejected');
                            resolve();
                        });
                    });
                });
            });
        });
    }

    static async getPendingTransactions(schoolId: string): Promise<Transaction[]> {
        const sql = `SELECT * FROM transactions WHERE school_id = ? AND status = 'pending_review' ORDER BY created_at ASC`;
        
        return new Promise((resolve, reject) => {
            db.getDB().all(sql, [schoolId], (err, rows: any[]) => {
                if (err) {
                    logger.error({ error: err, schoolId }, 'Failed to fetch pending transactions');
                    reject(err);
                } else {
                    resolve(rows.map(r => ({
                        id: r.id,
                        schoolId: r.school_id,
                        studentId: r.student_id,
                        payerPhone: r.payer_phone,
                        amount: r.amount,
                        currency: r.currency,
                        status: r.status,
                        popImagePath: r.pop_image_path,
                        reviewedBy: r.reviewed_by,
                        reviewNote: r.review_note,
                        createdAt: new Date(r.created_at),
                        updatedAt: new Date(r.updated_at)
                    })));
                }
            });
        });
    }

    static async getTransactionsByStudent(studentId: string): Promise<Transaction[]> {
        const sql = `SELECT * FROM transactions WHERE student_id = ? ORDER BY created_at DESC`;
        
        return new Promise((resolve, reject) => {
            db.getDB().all(sql, [studentId], (err, rows: any[]) => {
                if (err) {
                    logger.error({ error: err, studentId }, 'Failed to fetch student transactions');
                    reject(err);
                } else {
                    resolve(rows.map(r => ({
                        id: r.id,
                        schoolId: r.school_id,
                        studentId: r.student_id,
                        payerPhone: r.payer_phone,
                        amount: r.amount,
                        currency: r.currency,
                        status: r.status,
                        popImagePath: r.pop_image_path,
                        reviewedBy: r.reviewed_by,
                        reviewNote: r.review_note,
                        createdAt: new Date(r.created_at),
                        updatedAt: new Date(r.updated_at)
                    })));
                }
            });
        });
    }
}
