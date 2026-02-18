import { logger } from '../utils/logger';

export type ErrorSeverity = 'critical' | 'warning' | 'info';
export type ErrorCategory = 
    | 'database' 
    | 'network' 
    | 'authentication' 
    | 'vision' 
    | 'session'
    | 'permission';

export interface RecoveryError {
    code: string;
    message: string;
    userMessage: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    retryable: boolean;
    context?: Record<string, any>;
}

/**
 * ErrorRecoveryService
 * 
 * Graceful error handling and recovery for transient failures.
 * Provides user-friendly error messages and retry recommendations.
 * 
 * CRITICAL PRINCIPLE: All user-facing errors are friendly, all audit errors are logged completely
 */
export class ErrorRecoveryService {
    
    /**
     * Categorize and handle database errors
     */
    static handleDatabaseError(
        error: any,
        operation: string,
        context?: Record<string, any>
    ): RecoveryError {
        logger.error(
            { error: error.message, operation, stack: error.stack, context },
            'Database error occurred'
        );

        // Determine error category
        if (error.code === 'SQLITE_LOCKED' || error.message.includes('database is locked')) {
            return {
                code: 'DB_LOCKED',
                message: `Database lock timeout during ${operation}`,
                userMessage: "The system is temporarily busy. Please try again in a moment.",
                severity: 'warning',
                category: 'database',
                retryable: true,
                context
            };
        }

        if (error.message.includes('UNIQUE constraint failed')) {
            return {
                code: 'DB_DUPLICATE',
                message: `Duplicate record during ${operation}`,
                userMessage: "This record already exists. Please check and try again.",
                severity: 'warning',
                category: 'database',
                retryable: false,
                context
            };
        }

        if (error.message.includes('FOREIGN KEY constraint failed')) {
            return {
                code: 'DB_FK_CONSTRAINT',
                message: `Foreign key constraint failed during ${operation}`,
                userMessage: "The system encountered a data integrity issue. Please contact support.",
                severity: 'critical',
                category: 'database',
                retryable: false,
                context
            };
        }

        // Generic database error
        return {
            code: 'DB_ERROR',
            message: `Database error during ${operation}: ${error.message}`,
            userMessage: "I'm having trouble accessing the system. Please try again.",
            severity: 'critical',
            category: 'database',
            retryable: true,
            context
        };
    }

    /**
     * Categorize and handle session/token errors
     */
    static handleSessionError(
        error: any,
        operation: string,
        context?: Record<string, any>
    ): RecoveryError {
        logger.warn(
            { error: error.message, operation, context },
            'Session error occurred'
        );

        if (error.message.includes('token') || error.message.includes('expired')) {
            return {
                code: 'TOKEN_EXPIRED',
                message: `Token expired during ${operation}`,
                userMessage: "Your session has expired. Please provide your access token again.",
                severity: 'warning',
                category: 'authentication',
                retryable: true,
                context
            };
        }

        if (error.message.includes('invalid') || error.message.includes('not found')) {
            return {
                code: 'TOKEN_INVALID',
                message: `Invalid token during ${operation}`,
                userMessage: "Your access token is invalid. Please contact the school office.",
                severity: 'warning',
                category: 'authentication',
                retryable: false,
                context
            };
        }

        return {
            code: 'SESSION_ERROR',
            message: `Session error during ${operation}: ${error.message}`,
            userMessage: "I couldn't establish your session. Please try again.",
            severity: 'warning',
            category: 'session',
            retryable: true,
            context
        };
    }

    /**
     * Categorize and handle vision/image analysis errors
     */
    static handleVisionError(
        error: any,
        operation: string,
        context?: Record<string, any>
    ): RecoveryError {
        logger.warn(
            { error: error.message, operation, context },
            'Vision analysis error occurred'
        );

        if (error.message.includes('confidence') || error.message.includes('quality')) {
            return {
                code: 'VISION_LOW_CONFIDENCE',
                message: `Image quality insufficient for ${operation}`,
                userMessage: "I couldn't read the image clearly. Please send a clearer photo.",
                severity: 'info',
                category: 'vision',
                retryable: true,
                context
            };
        }

        if (error.message.includes('file size') || error.message.includes('too large')) {
            return {
                code: 'VISION_FILE_SIZE',
                message: `File size exceeded during ${operation}`,
                userMessage: "The image file is too large. Please send a smaller image.",
                severity: 'info',
                category: 'vision',
                retryable: true,
                context
            };
        }

        if (error.message.includes('rate limit') || error.message.includes('quota')) {
            return {
                code: 'VISION_RATE_LIMIT',
                message: `Vision API rate limit hit during ${operation}`,
                userMessage: "The system is processing a lot of images. Please try again in a moment.",
                severity: 'warning',
                category: 'vision',
                retryable: true,
                context
            };
        }

        if (error.message.includes('API')) {
            return {
                code: 'VISION_API_ERROR',
                message: `Vision API error during ${operation}: ${error.message}`,
                userMessage: "I'm having trouble analyzing images right now. Please try again.",
                severity: 'warning',
                category: 'vision',
                retryable: true,
                context
            };
        }

        return {
            code: 'VISION_ERROR',
            message: `Vision error during ${operation}: ${error.message}`,
            userMessage: "I couldn't process your image. Please try again.",
            severity: 'warning',
            category: 'vision',
            retryable: true,
            context
        };
    }

    /**
     * Categorize and handle permission/authorization errors
     */
    static handlePermissionError(
        error: any,
        operation: string,
        context?: Record<string, any>
    ): RecoveryError {
        logger.warn(
            { error: error.message, operation, context },
            'Permission error occurred'
        );

        return {
            code: 'PERMISSION_DENIED',
            message: `Permission denied for ${operation}`,
            userMessage: "You don't have permission to perform this action.",
            severity: 'warning',
            category: 'permission',
            retryable: false,
            context
        };
    }

    /**
     * Generic error categorization
     */
    static categorizeError(error: any): RecoveryError {
        logger.error(
            { error: error.message, stack: error.stack },
            'Uncategorized error occurred'
        );

        return {
            code: 'UNKNOWN_ERROR',
            message: error.message || 'Unknown error',
            userMessage: "Something went wrong. Please try again.",
            severity: 'critical',
            category: 'database',
            retryable: true
        };
    }

    /**
     * Get retry delay in milliseconds based on attempt number
     * Uses exponential backoff with jitter for distributed retry
     */
    static getRetryDelay(attempt: number, baseDelayMs: number = 100): number {
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms, etc.
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
        
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * exponentialDelay * 0.1;
        
        // Cap maximum delay at 30 seconds
        return Math.min(exponentialDelay + jitter, 30000);
    }

    /**
     * Determine if an operation should be retried
     */
    static shouldRetry(error: RecoveryError, attempt: number, maxAttempts: number = 3): boolean {
        if (!error.retryable) return false;
        if (attempt >= maxAttempts) return false;
        return true;
    }

    /**
     * Format error message for user response
     */
    static formatUserMessage(error: RecoveryError, suggestRetry: boolean = true): string {
        let message = `❌ ${error.userMessage}`;
        
        if (suggestRetry && error.retryable) {
            message += '\n\nPlease try again.';
        }
        
        if (error.severity === 'critical') {
            message += '\n\nIf the problem persists, please contact support.';
        }
        
        return message;
    }
}
