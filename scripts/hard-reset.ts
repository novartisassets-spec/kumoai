import fs from 'fs';
import path from 'path';

/**
 * HARD RESET SCRIPT
 * Purges the SQLite database file and the WhatsApp session directory.
 * Use this for a 100% fresh start.
 */

async function hardReset() {
    console.log('\n' + '═'.repeat(60));
    console.log('🛑  KUMO HARD RESET INITIATED  🛑');
    console.log('═'.repeat(60) + '\n');

    const pathsToPurge = [
        path.join(process.cwd(), 'kumo.db'),
        path.join(process.cwd(), 'kumo.db-shm'),
        path.join(process.cwd(), 'kumo.db-wal'),
        path.join(process.cwd(), 'kumo_auth_info'),
        path.join(process.cwd(), 'media_cache'),
        path.join(process.cwd(), 'pdf-output')
    ];

    for (const p of pathsToPurge) {
        if (fs.existsSync(p)) {
            try {
                const stats = fs.statSync(p);
                if (stats.isDirectory()) {
                    fs.rmSync(p, { recursive: true, force: true });
                    console.log(`✅ Deleted directory: ${path.basename(p)}`);
                } else {
                    fs.unlinkSync(p);
                    console.log(`✅ Deleted file:      ${path.basename(p)}`);
                }
            } catch (error: any) {
                console.error(`❌ Failed to delete ${path.basename(p)}: ${error.message}`);
                console.log('   (Is the system still running?)');
            }
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✨ SYSTEM PURGED. READY FOR FRESH RUN.');
    console.log('   Command: npm run dev');
    console.log('═'.repeat(60) + '\n');
}

hardReset();
