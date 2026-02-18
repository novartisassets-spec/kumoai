import { db } from '..';
import { logger } from '../../utils/logger';

export class StudentRepository {
    static async validateParentAccessCode(code: string): Promise<{ studentId: string, parentPhone?: string } | null> {
        // Find student with this code
        const sql = `SELECT student_id, parent_access_code FROM students WHERE parent_access_code = ?`;
        
        return new Promise((resolve, reject) => {
            db.getDB().get(sql, [code], (err, row: any) => {
                if (err) {
                    logger.error({ err }, 'Error validating parent code');
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve({
                        studentId: row.student_id
                    });
                }
            });
        });
    }

    static async getStudentDetails(studentId: string): Promise<any> {
        const sql = `SELECT * FROM students WHERE student_id = ?`;
         return new Promise((resolve, reject) => {
            db.getDB().get(sql, [studentId], (err, row: any) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}
