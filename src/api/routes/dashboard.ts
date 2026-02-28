/**
 * Dashboard & Academic API Routes
 * Provides data for frontend dashboard - students, teachers, marks, reports, transactions, escalations
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface AuthRequest extends Request {
    user?: {
        userId: string;
        phone: string;
        role: 'admin' | 'teacher' | 'parent';
        schoolId: string;
        schoolName?: string;
    };
    body: any;
    query: any;
    params: any;
}

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for a school
 */
router.get('/dashboard/stats', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const stats: any = {};

        // Students count
        const studentsResult: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT COUNT(*) as count FROM students WHERE school_id = ?`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });
        stats.studentsCount = studentsResult?.count || 0;

        // Teachers count
        const teachersResult: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT COUNT(*) as count FROM users WHERE school_id = ? AND role = 'teacher' AND is_active = 1`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });
        stats.teachersCount = teachersResult?.count || 0;

        // Classes count (unique class levels)
        const classesResult: any = await new Promise((resolve) => {
            db.getDB().all(
                `SELECT DISTINCT class_level FROM students WHERE school_id = ?`,
                [schoolId],
                (err, rows) => resolve(rows || [])
            );
        });
        stats.classesCount = classesResult.length;

        // Parents count
        const parentsResult: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT COUNT(*) as count FROM users WHERE school_id = ? AND role = 'parent' AND is_active = 1`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });
        stats.parentsCount = parentsResult?.count || 0;

        // Pending marks (DRAFT status)
        const pendingMarksResult: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT COUNT(*) as count FROM student_marks_indexed WHERE school_id = ? AND status = 'DRAFT'`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });
        stats.pendingMarksCount = pendingMarksResult?.count || 0;

        // Pending transactions
        const pendingTransactionsResult: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT COUNT(*) as count FROM transactions WHERE school_id = ? AND status = 'pending_review'`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });
        stats.pendingTransactionsCount = pendingTransactionsResult?.count || 0;

        // Active escalations
        const escalationsResult: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT COUNT(*) as count FROM escalations WHERE school_id = ? AND status IN ('ESCALATED', 'IN_AUTHORITY')`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });
        stats.activeEscalationsCount = escalationsResult?.count || 0;

        // Current term
        const currentTerm: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT * FROM academic_terms WHERE school_id = ? AND start_date <= date('now') AND end_date >= date('now') ORDER BY start_date DESC LIMIT 1`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });
        stats.currentTerm = currentTerm || null;

        // WhatsApp connection status
        const schoolInfo: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT whatsapp_connection_status, setup_status FROM schools WHERE id = ?`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });
        stats.whatsappStatus = schoolInfo?.whatsapp_connection_status || 'disconnected';
        stats.setupStatus = schoolInfo?.setup_status || 'PENDING_SETUP';

        res.json({
            success: true,
            data: stats
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to get dashboard stats');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/schools/me
 * Get current school info
 */
router.get('/schools/me', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        logger.info({ schoolId, user: req.user?.userId }, '🔍 [API] GET /schools/me - Request received');
        
        if (!schoolId) {
            logger.warn('🔍 [API] GET /schools/me - No schoolId in request');
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const school: any = await new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT * FROM schools WHERE id = ?`,
                [schoolId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!school) {
            logger.warn({ schoolId }, '🔍 [API] GET /schools/me - School not found');
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        // Parse config
        let config = {};
        let gradingConfig = {};
        let classes: string[] = [];
        let subjects: string[] = [];
        
        try {
            if (school.config_json) {
                config = typeof school.config_json === 'string' ? JSON.parse(school.config_json) : school.config_json;
            }
            if (school.grading_config) {
                gradingConfig = typeof school.grading_config === 'string' ? JSON.parse(school.grading_config) : school.grading_config;
            }
            if (school.classes_json) {
                classes = JSON.parse(school.classes_json);
            }
            if (school.subjects_json) {
                subjects = JSON.parse(school.subjects_json);
            }
        } catch (e) {
            logger.error({ error: e, schoolId }, '🔍 [API] GET /schools/me - Error parsing JSON fields');
        }

        logger.info({ 
            schoolId, 
            schoolName: school.name,
            classCount: classes.length, 
            subjectCount: subjects.length,
            hasGradingConfig: Object.keys(gradingConfig).length > 0
        }, '🔍 [API] GET /schools/me - Returning school data');

        res.json({
            success: true,
            data: {
                id: school.id,
                name: school.name,
                adminPhone: school.admin_phone,
                whatsappConnectionStatus: school.whatsapp_connection_status,
                connectedWhatsappJid: school.connected_whatsapp_jid,
                setupStatus: school.setup_status,
                schoolType: school.school_type,
                classes,
                subjects,
                config,
                gradingConfig,
                createdAt: school.created_at
            }
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to get school info');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/students
 * List students with optional filters
 */
router.get('/students', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { class_level, search, limit = 100, offset = 0 } = req.query;

        let sql = `
            SELECT s.*, 
                   (SELECT GROUP_CONCAT(g.guardian_phone) FROM student_guardians g WHERE g.student_id = s.student_id) as guardian_phones
            FROM students s 
            WHERE s.school_id = ?
        `;
        const params: any[] = [schoolId];

        if (class_level) {
            sql += ` AND s.class_level = ?`;
            params.push(class_level);
        }

        if (search) {
            sql += ` AND (s.name LIKE ? OR s.student_id LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY s.name ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const students: any[] = await new Promise((resolve, reject) => {
            db.getDB().all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
        });

        // Get total count
        let countSql = `SELECT COUNT(*) as total FROM students WHERE school_id = ?`;
        const countParams: any[] = [schoolId];
        if (class_level) {
            countSql += ` AND class_level = ?`;
            countParams.push(class_level);
        }
        const countResult: any = await new Promise((resolve) => {
            db.getDB().get(countSql, countParams, (err, row) => resolve(row));
        });

        res.json({
            success: true,
            data: students.map(s => ({
                id: s.student_id,
                name: s.name,
                classLevel: s.class_level,
                parentAccessCode: s.parent_access_code,
                guardianPhones: s.guardian_phones ? s.guardian_phones.split(',') : [],
                createdAt: s.created_at
            })),
            pagination: {
                total: countResult?.total || 0,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string)
            }
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to get students');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/students
 * Add new student
 */
router.post('/students', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Only admins and teachers can add students
        if (!['admin', 'teacher'].includes(req.user?.role || '')) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }

        const { name, classLevel, parentAccessCode, guardianPhones } = req.body;

        if (!name || !classLevel) {
            return res.status(400).json({ success: false, error: 'Name and class level are required' });
        }

        const studentId = uuidv4();
        const accessCode = parentAccessCode || Math.random().toString(36).substring(2, 8).toUpperCase();

        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO students (student_id, school_id, name, class_level, parent_access_code) 
                 VALUES (?, ?, ?, ?, ?)`,
                [studentId, schoolId, name, classLevel, accessCode],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Add guardians if provided
        if (guardianPhones && Array.isArray(guardianPhones)) {
            for (const phone of guardianPhones) {
                await new Promise<void>((resolve) => {
                    db.getDB().run(
                        `INSERT OR IGNORE INTO student_guardians (student_id, guardian_phone, relationship) VALUES (?, ?, ?)`,
                        [studentId, phone, 'parent'],
                        () => resolve()
                    );
                });
            }
        }

        logger.info({ studentId, schoolId, name, classLevel }, 'Student added');

        res.json({
            success: true,
            data: {
                id: studentId,
                name,
                classLevel,
                parentAccessCode: accessCode
            }
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to add student');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/teachers
 * List teachers
 */
router.get('/teachers', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { search, limit = 100, offset = 0 } = req.query;

        let sql = `SELECT * FROM users WHERE school_id = ? AND role = 'teacher' AND is_active = 1`;
        const params: any[] = [schoolId];

        if (search) {
            sql += ` AND (name LIKE ? OR phone LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const teachers: any[] = await new Promise((resolve, reject) => {
            db.getDB().all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
        });

        // Get total count
        const countResult: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT COUNT(*) as total FROM users WHERE school_id = ? AND role = 'teacher' AND is_active = 1`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });

        res.json({
            success: true,
            data: teachers.map(t => ({
                id: t.id,
                name: t.name,
                phone: t.phone,
                email: t.email,
                createdAt: t.created_at,
                lastLoginAt: t.last_login_at
            })),
            pagination: {
                total: countResult?.total || 0,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string)
            }
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to get teachers');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/teachers
 * Add new teacher
 */
router.post('/teachers', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Only admins can add teachers
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only admins can add teachers' });
        }

        const { name, phone, email, password } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ success: false, error: 'Name and phone are required' });
        }

        // Check if phone already exists in school
        const existing: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT id FROM users WHERE phone = ? AND school_id = ?`,
                [phone, schoolId],
                (err, row) => resolve(row)
            );
        });

        if (existing) {
            return res.status(400).json({ success: false, error: 'Teacher with this phone already exists' });
        }

        const teacherId = uuidv4();
        const bcrypt = require('bcryptjs');
        const passwordHash = password ? await bcrypt.hash(password, 10) : null;

        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO users (id, phone, role, name, school_id, password_hash, email, is_active) 
                 VALUES (?, ?, 'teacher', ?, ?, ?, ?, 1)`,
                [teacherId, phone, name, schoolId, passwordHash, email || null],
                (err) => err ? reject(err) : resolve()
            );
        });

        logger.info({ teacherId, schoolId, name }, 'Teacher added');

        res.json({
            success: true,
            data: {
                id: teacherId,
                name,
                phone,
                email
            }
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to add teacher');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/classes
 * List all classes in school
 */
router.get('/classes', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        logger.info({ schoolId, user: req.user }, '🔍 [API] GET /classes - Request received');
        
        if (!schoolId) {
            logger.warn('🔍 [API] GET /classes - No schoolId in request');
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Try to get from schools universe first
        const school: any = await new Promise((resolve) => {
            db.getDB().get(`SELECT classes_json, name FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
        });
        
        logger.info({ schoolId, schoolName: school?.name, hasClassesJson: !!school?.classes_json }, 
            '🔍 [API] GET /classes - School data retrieved');

        let classList: string[] = [];
        if (school?.classes_json) {
            try {
                classList = JSON.parse(school.classes_json);
                logger.info({ schoolId, classCount: classList.length, classes: classList }, 
                    '🔍 [API] GET /classes - Parsed classes_json');
            } catch (e) {
                logger.error({ error: e, classes_json: school.classes_json }, 
                    '🔍 [API] GET /classes - Failed to parse classes_json');
            }
        }

        if (classList.length > 0) {
            // Get student counts for these classes
            const studentCounts: any[] = await new Promise((resolve) => {
                db.getDB().all(
                    `SELECT class_level, COUNT(*) as student_count FROM students WHERE school_id = ? GROUP BY class_level`,
                    [schoolId],
                    (err, rows) => resolve(rows || [])
                );
            });

            const result = classList.map(name => ({
                name,
                studentCount: studentCounts.find(c => c.class_level === name)?.student_count || 0
            }));
            
            logger.info({ schoolId, resultCount: result.length }, 
                '🔍 [API] GET /classes - Returning classes from JSON');

            return res.json({
                success: true,
                data: result
            });
        }

        // Fallback to students table if no universe defined
        logger.info({ schoolId }, '🔍 [API] GET /classes - No classes_json, falling back to students table');
        const classes: any[] = await new Promise((resolve, reject) => {
            db.getDB().all(
                `SELECT class_level, COUNT(*) as student_count 
                 FROM students 
                 WHERE school_id = ? 
                 GROUP BY class_level 
                 ORDER BY class_level ASC`,
                [schoolId],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        logger.info({ schoolId, classCount: classes.length }, 
            '🔍 [API] GET /classes - Returning classes from students table');

        res.json({
            success: true,
            data: classes.map(c => ({
                name: c.class_level,
                studentCount: c.student_count
            }))
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to get classes');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/subjects
 * List all subjects in school
 */
router.get('/subjects', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        const { class_level } = req.query;
        
        logger.info({ schoolId, class_level, user: req.user?.userId }, 
            '🔍 [API] GET /subjects - Request received');
        
        if (!schoolId) {
            logger.warn('🔍 [API] GET /subjects - No schoolId in request');
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Try to get from subjects table first (as it was populated during setup)
        let sql = `SELECT * FROM subjects WHERE school_id = ?`;
        const params: any[] = [schoolId];

        if (class_level) {
            sql += ` AND class_level = ?`;
            params.push(class_level);
        }

        sql += ` ORDER BY name ASC`;

        const subjects: any[] = await new Promise((resolve, reject) => {
            db.getDB().all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
        });
        
        logger.info({ schoolId, class_level, subjectCount: subjects.length }, 
            '🔍 [API] GET /subjects - Retrieved from subjects table');

        if (subjects.length > 0) {
            const result = subjects.map(s => ({
                id: s.id,
                name: s.name,
                code: s.code,
                classLevel: s.class_level,
                aliases: s.aliases ? JSON.parse(s.aliases) : []
            }));
            
            logger.info({ schoolId, resultCount: result.length }, 
                '🔍 [API] GET /subjects - Returning subjects from table');
            
            return res.json({
                success: true,
                data: result
            });
        }

        // Fallback to subjects_json if table is empty (old setups)
        logger.info({ schoolId }, '🔍 [API] GET /subjects - No subjects in table, falling back to JSON');
        const school: any = await new Promise((resolve) => {
            db.getDB().get(`SELECT subjects_json FROM schools WHERE id = ?`, [schoolId], (err, row) => resolve(row));
        });

        let subjectList: string[] = [];
        if (school?.subjects_json) {
            try {
                subjectList = JSON.parse(school.subjects_json);
                logger.info({ schoolId, subjectCount: subjectList.length, subjects: subjectList }, 
                    '🔍 [API] GET /subjects - Parsed subjects_json');
            } catch (e) {
                logger.error({ error: e, subjects_json: school.subjects_json }, 
                    '🔍 [API] GET /subjects - Failed to parse subjects_json');
            }
        }

        res.json({
            success: true,
            data: subjectList.map(name => ({
                id: name.toLowerCase().replace(/\s+/g, '-'),
                name,
                code: name.substring(0, 3).toUpperCase(),
                aliases: []
            }))
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to get subjects');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/terms
 * List academic terms
 */
router.get('/terms', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const terms: any[] = await new Promise((resolve, reject) => {
            db.getDB().all(
                `SELECT * FROM academic_terms WHERE school_id = ? ORDER BY start_date DESC`,
                [schoolId],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        // Find current term
        const now = new Date().toISOString().split('T')[0];
        const currentTerm = terms.find(t => t.start_date <= now && t.end_date >= now);

        res.json({
            success: true,
            data: terms.map(t => ({
                id: t.id,
                name: t.term_name,
                startDate: t.start_date,
                endDate: t.end_date,
                isCurrent: t.id === currentTerm?.id
            })),
            currentTermId: currentTerm?.id || null
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to get terms');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/marks
 * Get marks with filters
 */
router.get('/marks', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { term_id, class_level, subject, status, limit = 100, offset = 0 } = req.query;

        let sql = `SELECT * FROM student_marks_indexed WHERE school_id = ?`;
        const params: any[] = [schoolId];

        if (term_id) {
            sql += ` AND term_id = ?`;
            params.push(term_id);
        }

        if (class_level) {
            sql += ` AND class_level = ?`;
            params.push(class_level);
        }

        if (subject) {
            sql += ` AND subject = ?`;
            params.push(subject);
        }

        if (status) {
            sql += ` AND status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY student_name ASC, subject ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const marks: any[] = await new Promise((resolve, reject) => {
            db.getDB().all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
        });

        res.json({
            success: true,
            data: marks.map(m => ({
                id: m.id,
                studentId: m.student_id,
                studentName: m.student_name,
                classLevel: m.class_level,
                subject: m.subject,
                termId: m.term_id,
                marks: m.marks_json ? JSON.parse(m.marks_json) : {},
                totalScore: m.total_score,
                status: m.status,
                confirmedByTeacher: !!m.confirmed_by_teacher,
                updatedAt: m.updated_at
            }))
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to get marks');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/transactions
 * Get payment transactions
 */
router.get('/transactions', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { status, limit = 100, offset = 0 } = req.query;

        let sql = `SELECT t.*, s.name as student_name FROM transactions t 
                   LEFT JOIN students s ON t.student_id = s.student_id 
                   WHERE t.school_id = ?`;
        const params: any[] = [schoolId];

        if (status) {
            sql += ` AND t.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const transactions: any[] = await new Promise((resolve, reject) => {
            db.getDB().all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
        });

        res.json({
            success: true,
            data: transactions.map(t => ({
                id: t.id,
                studentId: t.student_id,
                studentName: t.student_name,
                payerPhone: t.payer_phone,
                amount: t.amount,
                currency: t.currency,
                status: t.status,
                popImagePath: t.pop_image_path,
                reviewedBy: t.reviewed_by,
                reviewNote: t.review_note,
                createdAt: t.created_at
            }))
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to get transactions');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/transactions/:id/review
 * Review a transaction (approve/reject)
 */
router.post('/transactions/:id/review', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        if (req.user?.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only admins can review transactions' });
        }

        const { id } = req.params;
        const { action, note } = req.body; // action: 'confirm' | 'reject'

        if (!action || !['confirm', 'reject'].includes(action)) {
            return res.status(400).json({ success: false, error: 'Action must be confirm or reject' });
        }

        const newStatus = action === 'confirm' ? 'confirmed' : 'rejected';

        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `UPDATE transactions SET status = ?, reviewed_by = ?, review_note = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ? AND school_id = ?`,
                [newStatus, req.user?.userId, note || null, id, schoolId],
                (err) => err ? reject(err) : resolve()
            );
        });

        logger.info({ transactionId: id, schoolId, action, reviewedBy: req.user?.userId }, 'Transaction reviewed');

        res.json({
            success: true,
            message: `Transaction ${action === 'confirm' ? 'approved' : 'rejected'} successfully`
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to review transaction');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/escalations
 * Get escalations
 */
router.get('/escalations', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { status, limit = 50, offset = 0 } = req.query;

        let sql = `SELECT * FROM escalations WHERE school_id = ?`;
        const params: any[] = [schoolId];

        if (status) {
            sql += ` AND status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const escalations: any[] = await new Promise((resolve, reject) => {
            db.getDB().all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
        });

        res.json({
            success: true,
            data: escalations.map(e => ({
                id: e.id,
                originAgent: e.origin_agent,
                escalationType: e.escalation_type,
                priority: e.priority,
                fromPhone: e.from_phone,
                userName: e.user_name,
                userRole: e.user_role,
                reason: e.reason,
                status: e.status,
                escalationState: e.escalation_state,
                createdAt: e.created_at
            }))
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to get escalations');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/reports
 * Get generated reports
 */
router.get('/reports', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { term_id, class_level, status } = req.query;

        let sql = `SELECT r.*, s.name as student_name FROM terminal_reports r 
                   LEFT JOIN students s ON r.student_id = s.student_id 
                   WHERE r.school_id = ?`;
        const params: any[] = [schoolId];

        if (term_id) {
            sql += ` AND r.term_id = ?`;
            params.push(term_id);
        }

        if (class_level) {
            sql += ` AND r.class_level = ?`;
            params.push(class_level);
        }

        if (status) {
            sql += ` AND r.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY r.generated_at DESC LIMIT 100`;

        const reports: any[] = await new Promise((resolve, reject) => {
            db.getDB().all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
        });

        res.json({
            success: true,
            data: reports.map(r => ({
                id: r.id,
                studentId: r.student_id,
                studentName: r.student_name,
                classLevel: r.class_level,
                termId: r.term_id,
                totalAggregate: r.total_aggregate,
                averageScore: r.average_score,
                position: r.position,
                teacherRemarks: r.teacher_remarks,
                principalRemarks: r.principal_remarks,
                status: r.status,
                generatedAt: r.generated_at
            }))
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to get reports');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/marks
 * Save or update marks
 */
router.post('/marks', async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.user?.schoolId;
        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { marks: marksToSave, status = 'DRAFT' } = req.body;

        if (!Array.isArray(marksToSave)) {
            return res.status(400).json({ success: false, error: 'Marks array required' });
        }

        for (const item of marksToSave) {
            const { studentId, subject, termId, marks: studentMarks, studentName, classLevel } = item;
            
            const totalScore = Object.values(studentMarks).reduce((a: any, b: any) => Number(a) + Number(b), 0);
            
            await new Promise<void>((resolve, reject) => {
                db.getDB().run(
                    `INSERT INTO student_marks_indexed (
                        id, school_id, student_id, student_name, teacher_id, 
                        class_level, subject, term_id, marks_json, total_score, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(school_id, student_id, subject, term_id) DO UPDATE SET
                        marks_json = excluded.marks_json,
                        total_score = excluded.total_score,
                        status = excluded.status,
                        updated_at = CURRENT_TIMESTAMP`,
                    [
                        uuidv4(), schoolId, studentId, studentName, req.user?.userId,
                        classLevel, subject, termId, JSON.stringify(studentMarks),
                        totalScore, status
                    ],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        res.json({ success: true, message: 'Marks saved successfully' });

    } catch (error: any) {
        logger.error({ error, schoolId: req.user?.schoolId }, 'Failed to save marks');
        res.status(500).json({ success: false, error: error.message });
    }
});

export { router as dashboardRouter };
