/**
 * Fluid Name Standardization Service
 * 
 * INTELLIGENT but NON-RESTRICTIVE standardization:
 * - Only standardizes obvious common patterns (CA1, Maths, etc.)
 * - Preserves custom names and structures
 * - Admins can use ANY pillar names and point systems
 * - Teachers use school universe subjects exactly as defined
 * - Maintains fluidity while ensuring report-friendliness
 */

import { logger } from '../utils/logger';

export interface StandardizedPillar {
    id: string;
    name: string;           // Short display name (for reports)
    full_name: string;      // Original full name
    max_score: number;
}

export interface StandardizedSubject {
    id: string;
    name: string;           // Short display name (for reports)
    full_name: string;      // Original full name
}

class NameStandardizationService {
    
    // 🧠 SMART MAPPINGS: Only common abbreviations that everyone uses
    // These are RECOMMENDATIONS, not restrictions
    private static readonly SMART_PILLAR_ABBREVIATIONS: Record<string, string> = {
        // Only the most obvious ones - leave everything else as-is
        'continuous assessment 1': 'CA1',
        'continuous assessment 2': 'CA2', 
        'continuous assessment': 'CA',
        'ca 1': 'CA1',
        'ca 2': 'CA2',
        'exam': 'Exam',
        'examination': 'Exam',
        'test': 'Test',
        'classwork': 'CW',
        'class work': 'CW',
        'assignment': 'Ass.',
        'homework': 'HW',
        'project': 'Proj.',
        'practical': 'Prac.',
        'midterm': 'Midterm',
        'mid term': 'Midterm',
        'mid-term': 'Midterm',
        'quiz': 'Quiz',
    };

    private static readonly SMART_SUBJECT_ABBREVIATIONS: Record<string, string> = {
        // Only universally recognized abbreviations
        'mathematics': 'Maths',
        'math': 'Maths',
        'english language': 'English',
        'civic education': 'Civic',
        'basic science': 'Science',
        'social studies': 'Social Studies', // Keep full, well-known
        'physical education': 'P.E.',
        'computer studies': 'Computing',
        'christian religious studies': 'C.R.S.',
        'islamic religious studies': 'I.R.S.',
        'further mathematics': 'F.Maths',
        'literature in english': 'Literature',
    };

    /**
     * 🧠 FLUID STANDARDIZATION:
     * - Checks for common abbreviations
     * - If found, suggests short form but preserves original meaning
     * - If not found, creates intelligent abbreviation
     * - NEVER forces a specific name - admin's choice is king
     */
    static standardizePillar(inputName: string, maxScore: number): StandardizedPillar {
        const normalized = inputName.toLowerCase().trim();
        
        // Check if it's a common abbreviation pattern
        const commonAbbrev = this.SMART_PILLAR_ABBREVIATIONS[normalized];
        if (commonAbbrev) {
            return {
                id: this.generateId(commonAbbrev),
                name: commonAbbrev,
                full_name: inputName,
                max_score: maxScore
            };
        }

        // Check for partial match (e.g., "First Continuous Assessment")
        for (const [pattern, abbrev] of Object.entries(this.SMART_PILLAR_ABBREVIATIONS)) {
            if (normalized.includes(pattern) || pattern.includes(normalized)) {
                return {
                    id: this.generateId(abbrev),
                    name: abbrev,
                    full_name: inputName,
                    max_score: maxScore
                };
            }
        }

        // 🎯 CUSTOM NAME: Admin wants something unique - respect it!
        // Just ensure it's not too long for reports
        const displayName = this.ensureReportFriendly(inputName);
        
        return {
            id: this.generateId(inputName),
            name: displayName,
            full_name: inputName,
            max_score: maxScore
        };
    }

    /**
     * 🧠 FLUID SUBJECT STANDARDIZATION:
     * - Only converts universally known abbreviations
     * - Preserves custom subject names exactly as admin defines them
     * - Teachers will see subjects exactly as stored in universe
     */
    static standardizeSubject(inputName: string): StandardizedSubject {
        const normalized = inputName.toLowerCase().trim();
        
        // Check for common subject abbreviations
        const commonAbbrev = this.SMART_SUBJECT_ABBREVIATIONS[normalized];
        if (commonAbbrev) {
            return {
                id: this.generateId(commonAbbrev),
                name: commonAbbrev,
                full_name: inputName
            };
        }

        // Check partial matches
        for (const [pattern, abbrev] of Object.entries(this.SMART_SUBJECT_ABBREVIATIONS)) {
            if (normalized.includes(pattern)) {
                return {
                    id: this.generateId(abbrev),
                    name: abbrev,
                    full_name: inputName
                };
            }
        }

        // 🎯 CUSTOM SUBJECT: Keep exactly as admin specified
        return {
            id: this.generateId(inputName),
            name: this.ensureReportFriendly(inputName),
            full_name: inputName
        };
    }

    /**
     * Process pillars while respecting custom structures
     * Admins can have ANY combination of pillars with ANY names
     */
    static standardizePillars(pillars: Array<{name: string; max_score: number}>): StandardizedPillar[] {
        return pillars.map((pillar, index) => {
            const standardized = this.standardizePillar(pillar.name, pillar.max_score);
            
            // Ensure unique IDs
            if (pillars.filter((p, i) => p.name === pillar.name && i !== index).length > 0) {
                standardized.id = `${standardized.id}_${index + 1}`;
            }
            
            this.logStandardization(pillar.name, standardized);
            return standardized;
        });
    }

    /**
     * Process subjects while preserving custom names
     */
    static standardizeSubjects(subjects: string[]): StandardizedSubject[] {
        const seen = new Set<string>();
        
        return subjects.map((subject, index) => {
            const standardized = this.standardizeSubject(subject);
            
            // Handle duplicates by appending number
            let uniqueName = standardized.name;
            let counter = 1;
            while (seen.has(uniqueName.toLowerCase())) {
                uniqueName = `${standardized.name} ${counter}`;
                counter++;
            }
            seen.add(uniqueName.toLowerCase());
            
            if (uniqueName !== standardized.name) {
                standardized.name = uniqueName;
            }
            
            this.logStandardization(subject, standardized);
            return standardized;
        });
    }

    /**
     * 🎯 Ensure name fits in reports but don't force changes
     * Only abbreviates if name is very long (>20 chars)
     */
    private static ensureReportFriendly(name: string): string {
        // If already short, keep as-is
        if (name.length <= 15) {
            return name;
        }
        
        // If medium length, just trim slightly
        if (name.length <= 20) {
            return name;
        }
        
        // Only for very long names, create smart abbreviation
        return this.createSmartAbbreviation(name);
    }

    /**
     * Create abbreviation only when necessary
     */
    private static createSmartAbbreviation(name: string): string {
        const words = name.split(/\s+/);
        
        // For long names, take first 2-3 letters of each word
        if (words.length >= 2) {
            const initials = words
                .slice(0, 3) // Max 3 words
                .map(w => w.substring(0, 2)) // First 2 letters
                .join('');
            
            if (initials.length <= 8) {
                return initials;
            }
        }
        
        // Fallback: first 12 chars + ...
        return name.substring(0, 12) + (name.length > 12 ? '..' : '');
    }

    /**
     * Generate clean ID
     */
    private static generateId(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 20);
    }

    /**
     * Log for debugging
     */
    private static logStandardization(original: string, standardized: StandardizedPillar | StandardizedSubject): void {
        // Only log if actually changed
        if (original !== standardized.name) {
            logger.debug(
                { original, shortened: standardized.name },
                '🧠 Name standardized for reports'
            );
        }
    }

    /**
     * 🎯 VALIDATE: Check if standardization is safe
     * Returns true if name is appropriate for reports
     */
    static isReportFriendly(name: string): boolean {
        return name.length <= 20;
    }

    /**
     * 🔄 REVERSIBLE: Get original name from standardized
     * Preserves the full_name for display purposes
     */
    static getDisplayName(standardized: StandardizedPillar | StandardizedSubject, preferFull = false): string {
        if (preferFull && standardized.full_name) {
            return standardized.full_name;
        }
        return standardized.name;
    }
}

export const nameStandardizer = NameStandardizationService;
