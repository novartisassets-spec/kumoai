/**
 * Data Validation Utilities
 * Phone number, student ID, email validation with African context
 */

import { logger } from '../utils/logger';

export class DataValidator {
    /**
     * Validate phone number in E.164 format or Nigerian variations
     * Accepts: +234XXXXXXXXXX, 234XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX (10 digits)
     */
    static validatePhoneNumber(phone: string): {
        valid: boolean;
        normalized?: string;
        error?: string;
    } {
        if (!phone || typeof phone !== 'string') {
            return { valid: false, error: 'Phone number must be a non-empty string' };
        }

        // Remove whitespace
        const cleaned = phone.trim();

        // Try to normalize to E.164 format
        let normalized = cleaned;

        // Remove leading zeros
        if (cleaned.startsWith('0')) {
            normalized = '234' + cleaned.substring(1);
        }

        // Remove + if present
        if (normalized.startsWith('+')) {
            normalized = normalized.substring(1);
        }

        // Ensure 234 prefix (Nigeria)
        if (!normalized.startsWith('234')) {
            normalized = '234' + cleaned.replace(/^\+?/, '');
        }

        // Must be exactly 13 digits (234 + 10 digit number)
        if (!/^234\d{10}$/.test(normalized)) {
            return {
                valid: false,
                error: `Invalid phone format: ${cleaned}. Expected Nigerian number (11 digits starting with 0 or 234)`
            };
        }

        // Return with + prefix for E.164
        return {
            valid: true,
            normalized: '+' + normalized
        };
    }

    /**
     * Generate deterministic student ID from name, class, and parent phone
     * Ensures consistency across system
     */
    static generateStudentId(studentName: string, classLevel: string, parentPhone: string): string {
        if (!studentName || !classLevel || !parentPhone) {
            logger.error({ studentName, classLevel, parentPhone }, 'Missing required fields for student ID generation');
            throw new Error('Student name, class level, and parent phone are required');
        }

        // Normalize inputs
        const name = studentName.toLowerCase().replace(/\s+/g, '');
        const cls = classLevel.toLowerCase().replace(/\s+/g, '');
        
        // Extract phone digits only
        const phoneDigits = parentPhone.replace(/\D/g, '');
        const phoneSuffix = phoneDigits.slice(-6); // Last 6 digits

        // Create deterministic ID: STU_<classabbr>_<name_hash>_<phone_suffix>
        const nameHash = this.simpleHash(name).toString(16).slice(-4);
        const studentId = `STU_${cls.substring(0, 3)}_${nameHash}_${phoneSuffix}`;

        return studentId;
    }

    /**
     * Validate email address (for teacher/admin setup)
     */
    static validateEmail(email: string): { valid: boolean; error?: string } {
        if (!email || typeof email !== 'string') {
            return { valid: false, error: 'Email must be a non-empty string' };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: `Invalid email format: ${email}` };
        }

        return { valid: true };
    }

    /**
     * Validate and normalize school name
     */
    static validateSchoolName(name: string): { valid: boolean; normalized?: string; error?: string } {
        if (!name || typeof name !== 'string') {
            return { valid: false, error: 'School name must be a non-empty string' };
        }

        const trimmed = name.trim();

        if (trimmed.length < 3) {
            return { valid: false, error: 'School name must be at least 3 characters' };
        }

        if (trimmed.length > 100) {
            return { valid: false, error: 'School name must be less than 100 characters' };
        }

        // Normalize: title case
        const normalized = trimmed
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

        return { valid: true, normalized };
    }

    /**
     * Validate subject name
     */
    static validateSubject(subject: string): { valid: boolean; normalized?: string; error?: string } {
        if (!subject || typeof subject !== 'string') {
            return { valid: false, error: 'Subject must be a non-empty string' };
        }

        const trimmed = subject.trim();

        if (trimmed.length < 2 || trimmed.length > 50) {
            return { valid: false, error: 'Subject name must be between 2 and 50 characters' };
        }

        const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
        return { valid: true, normalized };
    }

    /**
     * Validate class level
     */
    static validateClassLevel(classLevel: string): { valid: boolean; normalized?: string; error?: string } {
        if (!classLevel || typeof classLevel !== 'string') {
            return { valid: false, error: 'Class level must be a non-empty string' };
        }

        const trimmed = classLevel.trim().toUpperCase();

        // Common class levels: JSS1-3, SSS1-3, Primary 1-6, etc.
        if (!/^(JSS|SSS|PRIMARY|PRIMARY\s+|JUNIOR|SENIOR)\s*\d+/.test(trimmed)) {
            return { valid: false, error: `Invalid class level: ${classLevel}. Expected format like "JSS1", "SSS2", "Primary 4"` };
        }

        return { valid: true, normalized: trimmed };
    }

    /**
     * Validate term ID
     */
    static validateTermId(termId: string): { valid: boolean; error?: string } {
        if (!termId || typeof termId !== 'string') {
            return { valid: false, error: 'Term ID must be a non-empty string' };
        }

        // Expected format: YYYY-T1, YYYY-T2, YYYY-T3
        if (!/^\d{4}-T[123]$/.test(termId)) {
            return { valid: false, error: `Invalid term ID: ${termId}. Expected format like "2025-T1"` };
        }

        return { valid: true };
    }

    /**
     * Simple hash function for deterministic ID generation
     */
    private static simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Check for duplicate student registration
     * Returns true if student with same name, class, and parent already exists
     */
    static shouldCheckDuplicateStudent(name: string, classLevel: string, parentPhone: string): string {
        // Generate deterministic ID and check in DB
        // This is a placeholder for the actual DB check
        return this.generateStudentId(name, classLevel, parentPhone);
    }
}

export default DataValidator;
