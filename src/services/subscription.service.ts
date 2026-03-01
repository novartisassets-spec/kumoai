import { db } from '../db';
import { logger } from '../utils/logger';
import { messenger } from './messenger';

export interface PlanLimits {
    students: number;
    teachers: number;
    classes: number;
    features: string[];
}

export const PLAN_CONFIG: Record<string, PlanLimits> = {
    'Free': {
        students: 50,
        teachers: 1,
        classes: 1,
        features: ['basic_reports']
    },
    'Starter': {
        students: 200,
        teachers: 5,
        classes: 3,
        features: ['basic_reports', 'whatsapp_support']
    },
    'Professional': {
        students: 1000,
        teachers: 1000000, // Unlimited
        classes: 1000000,  // Unlimited
        features: ['advanced_reports', 'analytics', 'api_access', 'priority_support']
    },
    'Enterprise': {
        students: 1000000, // Unlimited
        teachers: 1000000,
        classes: 1000000,
        features: ['multi_branch', 'custom_integrations', 'white_label', 'dedicated_manager']
    }
};

export class SubscriptionService {
    /**
     * Checks if a school has reached its limit for a specific resource
     */
    static async checkLimit(schoolId: string, resource: 'students' | 'teachers' | 'classes'): Promise<{ allowed: boolean; limit: number; current: number }> {
        const school = await db.get(
            `SELECT subscription_plan FROM schools WHERE id = ?`,
            [schoolId]
        );

        const planName = school?.subscription_plan || 'Free';
        const limits = PLAN_CONFIG[planName] || PLAN_CONFIG['Free'];
        const limit = limits[resource];

        let current = 0;
        if (resource === 'students') {
            const res = await db.get(`SELECT COUNT(*) as count FROM students WHERE school_id = ?`, [schoolId]);
            current = parseInt(res?.count || '0');
        } else if (resource === 'teachers') {
            const res = await db.get(`SELECT COUNT(*) as count FROM users WHERE school_id = ? AND role = 'teacher' AND is_active = 1`, [schoolId]);
            current = parseInt(res?.count || '0');
        } else if (resource === 'classes') {
            // Check classes count from students table (distinct class_level) or a dedicated classes table if it exists
            const res = await db.get(`SELECT COUNT(DISTINCT class_level) as count FROM students WHERE school_id = ?`, [schoolId]);
            current = parseInt(res?.count || '0');
        }

        return {
            allowed: current < limit,
            limit,
            current
        };
    }

    /**
     * Handles successful payment from Paystack
     */
    static async handlePaymentSuccess(reference: string, schoolId: string, planName: string, termMonths: number = 3) {
        try {
            logger.info({ reference, schoolId, planName }, '💳 Processing successful payment');

            // 1. Update Payment Record
            await db.run(
                `UPDATE subscription_payments 
                 SET payment_status = 'success', paid_at = CURRENT_TIMESTAMP, payment_method = 'paystack'
                 WHERE transaction_ref = ?`,
                [reference]
            );

            // 2. Calculate Dates
            const months = parseInt(termMonths.toString()) || 3;
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + months);
            
            // Set to end of day for consistency
            endDate.setHours(23, 59, 59, 999);

            // 3. Update School Plan
            await db.run(
                `UPDATE schools 
                 SET subscription_plan = ?, subscription_status = 'active', 
                     subscription_start_date = ?, subscription_end_date = ?
                 WHERE id = ?`,
                [planName, startDate.toISOString(), endDate.toISOString(), schoolId]
            );

            // 4. Get Admin Info for Notification
            const school = await db.get(`SELECT name, admin_phone FROM schools WHERE id = ?`, [schoolId]);
            
            if (school && school.admin_phone) {
                const message = `🎉 *Payment Confirmed!* 

Hello Admin, your payment for the *${planName}* plan has been successfully processed.

School: ${school.name}
Expiry Date: ${endDate.toLocaleDateString()}

Thank you for choosing KUMO-AI! 🚀`;
                
                try {
                    await messenger.sendPush(schoolId, school.admin_phone, message);
                    logger.info({ schoolId, adminPhone: school.admin_phone }, '✅ Admin notified of payment success');
                } catch (notifyErr) {
                    logger.error({ notifyErr, schoolId }, '❌ Failed to notify admin of payment');
                }
            }

            logger.info({ schoolId, planName }, '✅ School plan upgraded successfully');
            return true;
        } catch (error) {
            logger.error({ error, reference, schoolId }, '❌ Error handling payment success');
            throw error;
        }
    }
}
