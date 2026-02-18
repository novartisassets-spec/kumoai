import { db } from '../src/db';
import { logger } from '../src/utils/logger';

async function main() {
    try {
        await db.init();
        logger.info('Initialization complete');
    } catch (error) {
        logger.error({ error }, 'Initialization failed');
        process.exit(1);
    }
}

main();
