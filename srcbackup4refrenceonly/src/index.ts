import { db } from './db';
import { WhatsAppTransport } from './core/transport/whatsapp';
import { logger } from './utils/logger';
import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';

let cleanupService: any = null;

async function gracefulShutdown(signal: string) {
    logger.info({ signal }, 'Received shutdown signal');
    try {
        if (cleanupService) {
            cleanupService.stop();
            logger.info('Cleanup service stopped');
        }
        db.close();
        logger.info('Database connection closed');
        process.exit(0);
    } catch (error) {
        logger.error({ error, signal }, 'Error during shutdown');
        process.exit(1);
    }
}

process.on('uncaughtException', (error: Error) => {
    logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught Exception - Fatal Error');
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error({ reason, stack: reason?.stack }, 'Unhandled Promise Rejection');
});

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

async function main() {
    try {
        logger.info('Starting Kumo System...');
        
        await db.init();

        // --- Manual Test / First Run Logic ---
        const schools: any[] = await new Promise((resolve, reject) => {
            db.getDB().all('SELECT * FROM schools LIMIT 1', (err, rows: any) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (schools.length === 0) {
            console.log('\n\n════════════════════════════════════════════════════════════');
            console.log(' NO SCHOOL CONFIGURED - FIRST RUN SETUP ');
            console.log('════════════════════════════════════════════════════════════');
            console.log('To run the onboarding test, we need an Admin WhatsApp number.');
            console.log('This number will become the Super Admin (SA) authority.');
            
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const adminPhone = await new Promise<string>((resolve) => {
                rl.question('\n👉 Enter Admin WhatsApp Number (e.g., 2348012345678): ', (answer) => {
                    resolve(answer.trim().replace(/\+/g, ''));
                    rl.close();
                });
            });

            if (adminPhone) {
                const schoolId = uuidv4();
                const userId = uuidv4();
                
                console.log('\n📝 [FIRST RUN] Creating school record...');
                console.log(`   School ID: ${schoolId}`);
                console.log(`   Admin Phone: ${adminPhone}`);
                console.log(`   Status: PENDING_SETUP`);
                
                await new Promise<void>((resolve, reject) => {
                    db.getDB().run(
                        `INSERT INTO schools (id, name, admin_phone, setup_status) VALUES (?, ?, ?, ?)`,
                        [schoolId, 'School Management', adminPhone, 'PENDING_SETUP'],
                        (err) => {
                            if (err) {
                                console.log(`❌ [FIRST RUN] Failed to create school: ${err}`);
                                reject(err);
                            } else {
                                console.log(`✅ [FIRST RUN] School created in DB with PENDING_SETUP status`);
                                resolve();
                            }
                        }
                    );
                });

                console.log('\n📝 [FIRST RUN] Creating admin user record...');
                await new Promise<void>((resolve, reject) => {
                    db.getDB().run(
                        `INSERT INTO users (id, phone, role, name, school_id) VALUES (?, ?, 'admin', 'System Admin', ?)`,
                        [userId, adminPhone, schoolId],
                        (err) => {
                            if (err) {
                                console.log(`❌ [FIRST RUN] Failed to create admin user: ${err}`);
                                reject(err);
                            } else {
                                console.log(`✅ [FIRST RUN] Admin user created with role='admin'`);
                                resolve();
                            }
                        }
                    );
                });

                console.log('\n✅ [FIRST RUN] Setup complete. Admin phone will receive welcome after QR scan.');
                logger.info({ adminPhone, schoolId }, '✅ [FIRST RUN] Admin seeded. Ready for QR Scan.');
                console.log('\n════════════════════════════════════════════════════════════');
                console.log('👉 Scan this QR code with your school WhatsApp account (PA)');
                console.log('👉 The admin will automatically receive a welcome message');
                console.log('════════════════════════════════════════════════════════════\n');
            } else {
                logger.error('No number provided. Exiting.');
                process.exit(1);
            }
        } else {
             // School exists.
             const school = schools[0];
             console.log('\n════════════════════════════════════════════════════════════');
             console.log(' EXISTING SCHOOL CONFIGURATION ');
             console.log('════════════════════════════════════════════════════════════');
             console.log(` School: ${school.name}`);
             console.log(` Admin Phone: ${school.admin_phone}`);
             console.log('════════════════════════════════════════════════════════════');
             
             // Prompt to update admin phone
             const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const updatePhone = await new Promise<string>((resolve) => {
                rl.question('\n👉 Press ENTER to continue with this admin, or type new WhatsApp Number: ', (answer) => {
                    resolve(answer.trim().replace(/\+/g, ''));
                    rl.close();
                });
            });

            if (updatePhone) {
                 await new Promise<void>((resolve, reject) => {
                    db.getDB().run(
                        `UPDATE schools SET admin_phone = ? WHERE id = ?`,
                        [updatePhone, school.id],
                        (err) => {
                             if (err) {
                                console.log(`❌ Failed to update admin phone: ${err}`);
                                reject(err);
                            } else {
                                console.log(`✅ Admin phone updated to: ${updatePhone}`);
                                resolve();
                            }
                        }
                    );
                });
                
                // Also update the user record for the admin
                 await new Promise<void>((resolve, reject) => {
                    db.getDB().run(
                        `UPDATE users SET phone = ? WHERE school_id = ? AND role = 'admin'`,
                        [updatePhone, school.id],
                         (err) => {
                             if (err) console.log(`⚠️ Could not update admin user record: ${err}`);
                             else console.log(`✅ Admin user record updated.`);
                             resolve();
                        }
                    );
                });
            }
        }
        // -------------------------------------
        
        const transport = new WhatsAppTransport();
        await transport.start();
        
        // --- WEBHOOK SERVER ---
        const express = require('express');
        const { webhookRouter } = require('./api/webhook-handler');
        const app = express();
        app.use(express.json());
        app.use('/api/webhooks', webhookRouter);
        
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            logger.info({ PORT }, '🚀 Webhook Server running');
        });
        // ----------------------
        const { getFileCleanupService } = await import('./services/file-cleanup');
        cleanupService = getFileCleanupService();
        cleanupService.start();
        // -------------------------------------

        logger.info('Kumo System Running');

    } catch (error: any) {
        logger.error({ error: error?.message, stack: error?.stack }, 'Fatal error starting system');
        process.exit(1);
    }
}

main();
