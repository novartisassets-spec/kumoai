/**
 * Admin Setup API Routes
 * Handles school configuration, grading, terms, teachers, and policies
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
}

function requireSchoolOwnership(req: AuthRequest, res: Response, next: Function) {
    const schoolId = req.params.schoolId;
    const userSchoolId = req.user?.schoolId;
    
    console.log(`🔐 SCHOOL OWNERSHIP CHECK:`);
    console.log(`   Requested schoolId: ${schoolId}`);
    console.log(`   User's schoolId: ${userSchoolId}`);
    console.log(`   User ID: ${req.user?.userId}`);
    console.log(`   Match: ${schoolId === userSchoolId ? 'YES ✓' : 'NO ✗'}`);
    
    if (!schoolId || !userSchoolId) {
        console.log(`   ❌ Missing school ID`);
        return res.status(400).json({ success: false, error: 'School ID required' });
    }
    
    if (schoolId !== userSchoolId) {
        logger.warn({ 
            requestedSchoolId: schoolId, 
            userSchoolId, 
            userId: req.user?.userId 
        }, 'Unauthorized access attempt to different school');
        console.log(`   ❌ Access denied - school ID mismatch`);
        return res.status(403).json({ success: false, error: 'Access denied to this school' });
    }
    
    console.log(`   ✅ School ownership verified`);
    next();
}

interface SetupPayload {
    schoolInfo: {
        name: string;
        type: 'PRIMARY' | 'SECONDARY' | 'BOTH';
        address: string;
        phone: string;
        email: string;
        whatsappGroupLink?: string;
        registrationNumber?: string;
    };
    terms: Array<{
        id: string;
        name: string;
        startDate: string;
        endDate: string;
    }>;
    gradingConfig: {
        pillars: Array<{
            id: string;
            name: string;
            maxScore: number;
        }>;
        totalMax: number;
        gradingScale: string;
        rankStudents: boolean;
    };
    universe: {
        classes: Array<{ id: string; name: string; type: string }>;
        subjects: Array<{ id: string; name: string }>;
    };
    teachers: Array<any>;
    feesPolicies: {
        fees: Array<{ id: string; name: string; amount: number; category: string }>;
        policies: Array<{ id: string; title: string; content: string }>;
    };
}

/**
 * POST /api/setup/save/:schoolId
 * Save complete school setup configuration
 */
router.post('/save/:schoolId', requireSchoolOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;
        const payload: SetupPayload = req.body;

        logger.info({ schoolId, step: 'setup_save' }, 'Saving school setup');

        // 1. Update school basic info and universe (classes/subjects)
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `UPDATE schools SET
                    name = ?,
                    admin_phone = ?,
                    config_json = ?,
                    classes_json = ?,
                    subjects_json = ?,
                    setup_status = 'IN_PROGRESS'
                WHERE id = ?`,
                [
                    payload.schoolInfo.name,
                    payload.schoolInfo.phone,
                    JSON.stringify({
                        address: payload.schoolInfo.address,
                        email: payload.schoolInfo.email,
                        whatsappGroupLink: payload.schoolInfo.whatsappGroupLink,
                        registrationNumber: payload.schoolInfo.registrationNumber,
                        schoolType: payload.schoolInfo.type,
                    }),
                    JSON.stringify(payload.universe.classes.map(c => c.name)),
                    JSON.stringify(payload.universe.subjects.map(s => s.name)),
                    schoolId
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        // 2. Save grading configuration (FLUID pillars)
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `UPDATE schools SET grading_config = ? WHERE id = ?`,
                [JSON.stringify({
                    pillars: payload.gradingConfig.pillars,
                    totalMax: payload.gradingConfig.totalMax,
                    gradingScale: payload.gradingConfig.gradingScale,
                    rankStudents: payload.gradingConfig.rankStudents,
                    variant: 'custom',
                }), schoolId],
                (err) => err ? reject(err) : resolve()
            );
        });

        // 3. Save academic terms
        for (const term of payload.terms) {
            await new Promise<void>((resolve, reject) => {
                db.getDB().run(
                    `INSERT INTO academic_terms (id, school_id, term_name, start_date, end_date)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET term_name = ?, start_date = ?, end_date = ?`,
                    [
                        term.id, schoolId, term.name, term.startDate, term.endDate,
                        term.name, term.startDate, term.endDate
                    ],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // 4. Save classes and subjects universe
        // Clear existing subjects for this school to avoid duplicates or orphans
        await new Promise<void>((resolve) => {
            db.getDB().run(`DELETE FROM subjects WHERE school_id = ?`, [schoolId], () => resolve());
        });

        for (const cls of payload.universe.classes) {
            for (const subj of payload.universe.subjects) {
                const subjectId = uuidv4();
                await new Promise<void>((resolve, reject) => {
                    db.getDB().run(
                        `INSERT INTO subjects (id, school_id, name, class_level, is_core, code)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            subjectId, 
                            schoolId, 
                            subj.name, 
                            cls.name, 
                            1, 
                            subj.name.substring(0, 3).toUpperCase()
                        ],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }
        }

        // 5. Update setup_state record
        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `INSERT INTO setup_state (school_id, current_step, completed_steps, is_active)
                 VALUES (?, ?, ?, 1)
                 ON CONFLICT(school_id) DO UPDATE SET
                    current_step = 'SETUP_SCHOOL',
                    completed_steps = ?,
                    is_active = 1`,
                [schoolId, JSON.stringify(['info', 'type', 'terms', 'grading', 'universe', 'teachers', 'fees'])],
                (err) => err ? reject(err) : resolve()
            );
        });

        // 6. Track in history
        await new Promise<void>((resolve) => {
            db.getDB().run(
                `INSERT INTO message_history (id, school_id, from_phone, content, sender_role, timestamp, context)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    `setup-${Date.now()}`,
                    schoolId,
                    'system',
                    'School setup completed via Admin UI',
                    'admin',
                    Date.now(),
                    'SYSTEM'
                ],
                () => resolve()
            );
        });

        logger.info({ schoolId }, '✅ School setup saved successfully');

        res.json({
            success: true,
            message: 'Setup saved successfully',
            data: {
                schoolId,
                schoolType: payload.schoolInfo.type,
                pillarsCount: payload.gradingConfig.pillars.length,
                termsCount: payload.terms.length,
                classesCount: payload.universe.classes.length,
                subjectsCount: payload.universe.subjects.length,
            }
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.params.schoolId }, 'Failed to save setup');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/setup/status/:schoolId
 * Get current setup status and data
 */
router.get('/status/:schoolId', requireSchoolOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;

        // Get school info (including config_json for address, email, schoolType, etc.)
        const school: any = await new Promise((resolve, reject) => {
            db.getDB().get(
                `SELECT id, name, admin_phone, setup_status, grading_config, classes_json, subjects_json, config_json FROM schools WHERE id = ?`,
                [schoolId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!school) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        // Get terms
        const terms: any[] = await new Promise((resolve) => {
            db.getDB().all(
                `SELECT * FROM academic_terms WHERE school_id = ? ORDER BY start_date`,
                [schoolId],
                (err, rows) => {
                    if (err) {
                        logger.error({ err, schoolId }, 'Failed to fetch academic terms');
                    }
                    logger.info({ schoolId, termCount: rows?.length || 0, terms: rows }, 'Fetched academic terms');
                    resolve(rows || [])
                }
            );
        });

        // Get setup state
        const setupState: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT * FROM setup_state WHERE school_id = ?`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });

        // Get teachers count
        const teachersCount: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT COUNT(*) as count FROM users WHERE school_id = ? AND role = 'teacher'`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });

        // Get admin name from users table (fallback to config or empty)
        const adminUser: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT name FROM users WHERE school_id = ? AND role = 'admin' LIMIT 1`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });

        // Parse grading config
        let gradingConfig = null;
        logger.info({ schoolId, hasGradingConfig: !!school.grading_config, gradingConfigRaw: school.grading_config?.substring(0, 200) }, 'Parsing grading config');
        if (school.grading_config) {
            try {
                gradingConfig = typeof school.grading_config === 'string'
                    ? JSON.parse(school.grading_config)
                    : school.grading_config;
                logger.info({ schoolId, gradingConfigParsed: gradingConfig }, 'Grading config parsed successfully');
            } catch (e) {
                logger.error({ error: e, schoolId, gradingConfigRaw: school.grading_config }, 'Failed to parse grading config');
                gradingConfig = null;
            }
        }

        // Parse school config (address, email, schoolType, etc.)
        let schoolConfig: any = {};
        if (school.config_json) {
            try {
                schoolConfig = typeof school.config_json === 'string'
                    ? JSON.parse(school.config_json)
                    : school.config_json;
            } catch (e) {
                schoolConfig = {};
            }
        }

        logger.info({ 
            schoolId, 
            termCount: terms.length,
            gradingConfigExists: !!gradingConfig,
            gradingPillarCount: gradingConfig?.pillars?.length || 0,
            responsePreview: {
                schoolName: school.name,
                hasTerms: terms.length > 0,
                hasGrading: !!gradingConfig,
                configFields: Object.keys(schoolConfig)
            }
        }, 'Setup status endpoint - preparing response');

        res.json({
            success: true,
            data: {
                school: {
                    id: school.id,
                    name: school.name,
                    adminPhone: school.admin_phone,
                    setupStatus: school.setup_status,
                    classes: school.classes_json ? JSON.parse(school.classes_json) : [],
                    subjects: school.subjects_json ? JSON.parse(school.subjects_json) : [],
                    // Include all config fields for prefilling
                    schoolType: schoolConfig.schoolType || schoolConfig.type || 'SECONDARY',
                    address: schoolConfig.address || '',
                    email: schoolConfig.email || '',
                    whatsappGroupLink: schoolConfig.whatsappGroupLink || '',
                    registrationNumber: schoolConfig.registrationNumber || '',
                    country: schoolConfig.country || 'Nigeria',
                    state: schoolConfig.state || '',
                    city: schoolConfig.city || '',
                    adminName: adminUser?.name || schoolConfig.adminName || school.admin_name || '',
                },
                setupState: setupState ? {
                    currentStep: setupState.current_step,
                    completedSteps: JSON.parse(setupState.completed_steps || '[]'),
                    isActive: !!setupState.is_active,
                } : null,
                config: {
                    grading: gradingConfig,
                },
                terms,
                stats: {
                    teachersCount: teachersCount?.count || 0,
                }
            }
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.params.schoolId }, 'Failed to get setup status');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/setup/complete/:schoolId
 * Mark setup as complete
 */
router.post('/complete/:schoolId', requireSchoolOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;

        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `UPDATE schools SET setup_status = 'OPERATIONAL' WHERE id = ?`,
                [schoolId],
                (err) => err ? reject(err) : resolve()
            );
        });

        await new Promise<void>((resolve, reject) => {
            db.getDB().run(
                `UPDATE setup_state SET is_active = 0, current_step = 'COMPLETE' WHERE school_id = ?`,
                [schoolId],
                (err) => err ? reject(err) : resolve()
            );
        });

        res.json({ success: true, message: 'Setup marked as complete' });

    } catch (error: any) {
        logger.error({ error, schoolId: req.params.schoolId }, 'Failed to complete setup');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/setup/sync-universe/:schoolId
 * Sync universe data from JSON columns to relational tables
 * This fixes schools that were set up before the subjects table population fix
 */
router.post('/sync-universe/:schoolId', requireSchoolOwnership, async (req: AuthRequest, res: Response) => {
    try {
        const schoolId = req.params.schoolId as string;
        const { v4: uuidv4 } = require('uuid');

        logger.info({ schoolId }, '🔄 Syncing universe data from JSON to relational tables');

        // Get school universe data
        const school: any = await new Promise((resolve) => {
            db.getDB().get(
                `SELECT classes_json, subjects_json, name FROM schools WHERE id = ?`,
                [schoolId],
                (err, row) => resolve(row)
            );
        });

        if (!school) {
            return res.status(404).json({ success: false, error: 'School not found' });
        }

        let classes: string[] = [];
        let subjects: string[] = [];

        try {
            if (school.classes_json) {
                classes = JSON.parse(school.classes_json);
            }
            if (school.subjects_json) {
                subjects = JSON.parse(school.subjects_json);
            }
        } catch (e) {
            logger.error({ error: e, schoolId }, 'Failed to parse JSON columns');
            return res.status(400).json({ success: false, error: 'Invalid JSON in school data' });
        }

        if (classes.length === 0 || subjects.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No universe data found. Please complete school setup first.' 
            });
        }

        // Clear existing subjects
        await new Promise<void>((resolve) => {
            db.getDB().run(`DELETE FROM subjects WHERE school_id = ?`, [schoolId], () => resolve());
        });

        // Populate subjects table
        let insertedCount = 0;
        for (const cls of classes) {
            for (const subj of subjects) {
                const subjectId = uuidv4();
                await new Promise<void>((resolve, reject) => {
                    db.getDB().run(
                        `INSERT INTO subjects (id, school_id, name, class_level, is_core, code)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            subjectId,
                            schoolId,
                            subj,
                            cls,
                            1,
                            subj.substring(0, 3).toUpperCase()
                        ],
                        (err) => {
                            if (err) {
                                logger.error({ err, subjectId, schoolId, subject: subj, class: cls }, 
                                    'Failed to insert subject during sync');
                                reject(err);
                            } else {
                                insertedCount++;
                                resolve();
                            }
                        }
                    );
                });
            }
        }

        logger.info({ schoolId, classesCount: classes.length, subjectsCount: subjects.length, totalInserted: insertedCount }, 
            '✅ Universe sync completed');

        res.json({
            success: true,
            message: 'Universe data synced successfully',
            data: {
                schoolName: school.name,
                classesCount: classes.length,
                subjectsCount: subjects.length,
                totalInserted: insertedCount
            }
        });

    } catch (error: any) {
        logger.error({ error, schoolId: req.params.schoolId }, 'Failed to sync universe');
        res.status(500).json({ success: false, error: error.message });
    }
});

export { router as setupRouter };
