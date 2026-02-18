/**
 * Grading Configuration Repository
 * 
 * Fetches grading logic from admin setup (not hardcoded in agent classes)
 * Allows schools to define custom grading for Primary and/or Secondary
 */

import { db } from '../index';
import { logger } from '../../utils/logger';

export interface GradingConfig {
  ca1_max: number;
  ca2_max: number;
  midterm_max: number;
  exam_max: number;
  total_max: number;
  has_midterm: boolean;
  rank_students: boolean;
  variant: string;
}

export class GradingConfigRepository {
  /**
   * Get grading configuration for a specific school
   * 🚨 MANDATORY: Admin MUST configure custom pillars during setup
   * NO FALLBACKS - Each school has unique grading structure
   */
  static getGradingConfig(schoolId: string, schoolType: 'PRIMARY' | 'SECONDARY'): GradingConfig {
    try {
      // 🚨 Look in schools table grading_config JSON column (set during SA setup)
      const sql = `SELECT grading_config FROM schools WHERE id = ? LIMIT 1`;

      const database = db.getDB();
      let result: any;

      database.get(sql, [schoolId], (err: any, row: any) => {
        if (err) {
          logger.error({ error: err, schoolId }, 'Failed to fetch grading config from schools table');
          return;
        }
        result = row;
      });

      // Parse the JSON grading_config from schools table
      if (result?.grading_config) {
        try {
          const config = typeof result.grading_config === 'string' 
            ? JSON.parse(result.grading_config) 
            : result.grading_config;
          
          if (config.pillars && config.pillars.length > 0) {
            logger.debug({ schoolId, pillars: config.pillars.length }, '✅ Loaded custom grading config from admin setup');
            
            // Convert pillar format to legacy format for compatibility
            const ca1Pillar = config.pillars.find((p: any) => p.id === 'ca1' || p.name.toLowerCase().includes('ca1'));
            const ca2Pillar = config.pillars.find((p: any) => p.id === 'ca2' || p.name.toLowerCase().includes('ca2'));
            const midtermPillar = config.pillars.find((p: any) => p.id === 'midterm' || p.name.toLowerCase().includes('midterm'));
            const examPillar = config.pillars.find((p: any) => p.id === 'exam' || p.name.toLowerCase().includes('exam'));
            
            return {
              ca1_max: ca1Pillar?.max_score || 0,
              ca2_max: ca2Pillar?.max_score || 0,
              midterm_max: midtermPillar?.max_score || 0,
              exam_max: examPillar?.max_score || 0,
              total_max: config.total_max || config.pillars.reduce((sum: number, p: any) => sum + (p.max_score || 0), 0),
              has_midterm: !!midtermPillar,
              rank_students: config.rank_students !== false,
              variant: config.variant || 'custom'
            };
          }
        } catch (e) {
          logger.error({ error: e, schoolId }, '❌ Failed to parse grading_config JSON');
        }
      }

      // 🚨 NO FALLBACK - Throw error if admin hasn't configured grading
      logger.error({ schoolId, schoolType }, '❌❌❌ CRITICAL: No grading_config found! Admin must complete setup with custom pillars.');
      throw new Error(
        `School ${schoolId} has no grading configuration. ` +
        `Admin MUST define custom grading pillars during SA setup (e.g., "Assignment 10, Classwork 15, Exam 60"). ` +
        `Each school has unique pillars - no fallbacks allowed.`
      );

    } catch (error) {
      logger.error({ error, schoolId, schoolType }, '❌ Error fetching grading config');
      throw error;
    }
  }

  /**
   * Get default grading configuration for school type
   */
  static getDefaultGradingConfig(schoolType: 'PRIMARY' | 'SECONDARY'): GradingConfig {
    if (schoolType === 'PRIMARY') {
      return {
        ca1_max: 20,
        ca2_max: 20,
        midterm_max: 0,
        exam_max: 60,
        total_max: 100,
        has_midterm: false,
        rank_students: false,
        variant: 'ca1_ca2_exam'
      };
    } else {
      // SECONDARY
      return {
        ca1_max: 10,
        ca2_max: 10,
        midterm_max: 20,
        exam_max: 60,
        total_max: 100,
        has_midterm: true,
        rank_students: true,
        variant: 'ca1_ca2_midterm_exam'
      };
    }
  }

  /**
   * Save or update grading configuration for a school
   */
  static async setGradingConfig(
    schoolId: string,
    schoolType: 'PRIMARY' | 'SECONDARY',
    config: GradingConfig
  ): Promise<void> {
    try {
      const sql = `
        INSERT INTO grading_config 
        (school_id, school_type, ca1_max, ca2_max, midterm_max, exam_max, total_max, has_midterm, rank_students, variant)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(school_id, school_type) 
        DO UPDATE SET 
          ca1_max = excluded.ca1_max,
          ca2_max = excluded.ca2_max,
          midterm_max = excluded.midterm_max,
          exam_max = excluded.exam_max,
          total_max = excluded.total_max,
          has_midterm = excluded.has_midterm,
          rank_students = excluded.rank_students,
          variant = excluded.variant,
          updated_at = CURRENT_TIMESTAMP
      `;

      const database = db.getDB();
      
      return new Promise((resolve, reject) => {
        database.run(
          sql,
          [
            schoolId,
            schoolType,
            config.ca1_max,
            config.ca2_max,
            config.midterm_max,
            config.exam_max,
            config.total_max,
            config.has_midterm ? 1 : 0,
            config.rank_students ? 1 : 0,
            config.variant
          ],
          (err: any) => {
            if (err) {
              logger.error({ error: err, schoolId, schoolType }, 'Failed to save grading config');
              reject(err);
            } else {
              logger.info({ schoolId, schoolType }, 'Grading config saved');
              resolve();
            }
          }
        );
      });

    } catch (error) {
      logger.error({ error, schoolId, schoolType }, 'Error saving grading config');
      throw error;
    }
  }

  /**
   * Get all schools that have both Primary and Secondary grading configured
   */
  static getSchoolsWithBothTypes(): Array<{schoolId: string; primaryConfig: GradingConfig; secondaryConfig: GradingConfig}> {
    try {
      const sql = `
        SELECT 
          school_id,
          ca1_max,
          ca2_max,
          midterm_max,
          exam_max,
          total_max,
          has_midterm,
          rank_students,
          variant,
          school_type
        FROM grading_config
        WHERE school_id IN (
          SELECT school_id 
          FROM grading_config 
          GROUP BY school_id 
          HAVING COUNT(DISTINCT school_type) = 2
        )
        ORDER BY school_id, school_type
      `;

      const database = db.getDB();
      const results: any[] = [];

      database.all(sql, (err: any, rows: any[]) => {
        if (err) {
          logger.error({ error: err }, 'Failed to fetch schools with both types');
          return;
        }
        results.push(...(rows || []));
      });

      // Group by schoolId
      const grouped: Record<string, any> = {};
      results.forEach(row => {
        if (!grouped[row.school_id]) {
          grouped[row.school_id] = {};
        }
        
        const config: GradingConfig = {
          ca1_max: row.ca1_max,
          ca2_max: row.ca2_max,
          midterm_max: row.midterm_max,
          exam_max: row.exam_max,
          total_max: row.total_max,
          has_midterm: Boolean(row.has_midterm),
          rank_students: Boolean(row.rank_students),
          variant: row.variant
        };

        if (row.school_type === 'PRIMARY') {
          grouped[row.school_id].primaryConfig = config;
        } else {
          grouped[row.school_id].secondaryConfig = config;
        }
      });

      return Object.entries(grouped).map(([schoolId, configs]) => ({
        schoolId,
        primaryConfig: configs.primaryConfig,
        secondaryConfig: configs.secondaryConfig
      }));

    } catch (error) {
      logger.error({ error }, 'Error fetching schools with both types');
      return [];
    }
  }
}
