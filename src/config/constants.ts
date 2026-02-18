/**
 * Application-wide constants
 * All magic numbers and strings should be defined here
 */

export const CONSTANTS = {
    VISION: {
        CONFIDENCE_THRESHOLD: 0.85,
        MIN_CONFIDENCE_WARNING: 0.70,
        MAX_IMAGE_SIZE_BYTES: 25 * 1024 * 1024, // 25MB
    },
    SESSION: {
        TTL_MINUTES: 180,
        MESSAGE_HISTORY_LIMIT: 15,
    },
    MEMORY: {
        SLIDING_WINDOW_SIZE: 10,
        MAX_RELEVANT_SUMMARIES: 2,
        MESSAGES_BEFORE_SUMMARY: 13,  // Lower to ~150 words instead of 250, trigger summaries earlier
    },
    RATE_LIMIT: {
        LLM_CALLS_PER_MINUTE: 3, // Per agent, per phone
        MESSAGES_PER_MINUTE: 10,
        MESSAGES_PER_HOUR: 100,
        WINDOW_MS: 60 * 1000, // 1 minute
    },
    FILE_STORAGE: {
        MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
        ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/jpg'],
        CLEANUP_INTERVAL_HOURS: 24,
    },
    TOKEN: {
        SALT_ROUNDS: 10,
    },
    LLM: {
        MAX_TOKENS: 8000,
        SAFETY_THRESHOLD: 6000,
        TOKEN_BUFFER: 500,
        TOKENS_PER_CHAR_ESTIMATE: 0.25,
    },
    SETUP: {
        VALID_SCHOOL_TYPES: ['PRIMARY', 'SECONDARY', 'BOTH'] as const,
        DEFAULT_SCHOOL_TYPE: null as string | null,
    },
    TEACHER: {
        TOKEN_PREFIX: 'TEA-KUMO-',
    },
    PHONE: {
        DEFAULT_COUNTRY_CODE: '234',
        SUPPORTED_COUNTRY_CODES: ['234', '233', '229', '225', '221'],
    },
} as const;

export type ValidSchoolType = typeof CONSTANTS.SETUP.VALID_SCHOOL_TYPES[number];

