const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('./kumo.db');

console.log('Running database migrations...\n');

// Migration 1: Add progress_percentage to ta_setup_state if not exists
db.all(`PRAGMA table_info(ta_setup_state)`, (err, columns) => {
    if (err) {
        console.error('Error checking ta_setup_state schema:', err);
        db.close();
        return;
    }
    
    const hasProgressColumn = columns.some(col => col.name === 'progress_percentage');
    
    if (!hasProgressColumn) {
        console.log('Adding progress_percentage column to ta_setup_state...');
        db.run(`ALTER TABLE ta_setup_state ADD COLUMN progress_percentage INTEGER DEFAULT 0`, (err) => {
            if (err) {
                console.error('Error adding column:', err);
            } else {
                console.log('✓ Added progress_percentage column');
            }
            
            // Check schools table for admin_name
            db.all(`PRAGMA table_info(schools)`, (err, columns) => {
                if (err) {
                    console.error('Error checking schools schema:', err);
                    db.close();
                    return;
                }
                
                const hasAdminName = columns.some(col => col.name === 'admin_name');
                
                if (!hasAdminName) {
                    console.log('Adding admin_name column to schools...');
                    db.run(`ALTER TABLE schools ADD COLUMN admin_name TEXT`, (err) => {
                        if (err) {
                            console.error('Error adding column:', err);
                        } else {
                            console.log('✓ Added admin_name column');
                        }
                        finalize();
                    });
                } else {
                    console.log('✓ admin_name column already exists');
                    finalize();
                }
            });
        });
    } else {
        console.log('✓ progress_percentage column already exists');
        finalize();
    }
});

function finalize() {
    console.log('\n✅ Migrations complete!');
    console.log('You can now run the TA setup tests.\n');
    db.close();
}
