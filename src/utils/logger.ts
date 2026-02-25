import pino from 'pino';
import { ENV } from '../config/env';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
    level: ENV.LOG_LEVEL || 'info',
    ...(isDevelopment && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
            },
        },
    }),
});
