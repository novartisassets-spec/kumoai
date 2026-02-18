/**
 * Development Logger
 * Provides console.log in dev mode, structured logging in production
 */

import { ENV } from '../config/env';

const isDev = ENV.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production';

export const devLog = {
    /**
     * Console log for development mode only
     */
    log: (...args: any[]) => {
        if (isDev) {
            console.log(...args);
        }
    },

    /**
     * Console error for development mode
     */
    error: (...args: any[]) => {
        if (isDev) {
            console.error(...args);
        }
    },

    /**
     * Console warn for development mode
     */
    warn: (...args: any[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },

    /**
     * Console debug for development mode
     */
    debug: (...args: any[]) => {
        if (isDev) {
            console.debug(...args);
        }
    },

    /**
     * Always log (even in production) - use sparingly
     */
    always: (...args: any[]) => {
        console.log(...args);
    }
};

