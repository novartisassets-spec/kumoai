const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('./kumo.db');

const schoolId = '6a94c74c-95de-4137-9004-743efd0131e6';

console.log('Checking database for school:', schoolId);
console.log('=====================================\n');

// Check academic_terms
console.log('1. ACADEMIC TERMS:');
db.all('SELECT * FROM academic_terms WHERE school_id = ?', [schoolId], (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Count:', rows.length);
        console.log('Data:', JSON.stringify(rows, null, 2));
    }
    console.log('');
    
    // Check schools.grading_config
    console.log('2. SCHOOLS GRADING_CONFIG:');
    db.get('SELECT id, name, grading_config FROM schools WHERE id = ?', [schoolId], (err, row) => {
        if (err) {
            console.error('Error:', err);
        } else if (!row) {
            console.log('School not found!');
        } else {
            console.log('School Name:', row.name);
            console.log('Has grading_config:', !!row.grading_config);
            if (row.grading_config) {
                console.log('Raw grading_config:', row.grading_config);
                try {
                    const parsed = JSON.parse(row.grading_config);
                    console.log('Parsed:', JSON.stringify(parsed, null, 2));
                } catch (e) {
                    console.log('Failed to parse JSON:', e.message);
                }
            }
        }
        console.log('');
        
        // Check schools.config_json
        console.log('3. SCHOOLS CONFIG_JSON:');
        db.get('SELECT config_json FROM schools WHERE id = ?', [schoolId], (err, row) => {
            if (err) {
                console.error('Error:', err);
            } else if (row && row.config_json) {
                console.log('Raw config_json:', row.config_json);
                try {
                    const parsed = JSON.parse(row.config_json);
                    console.log('Parsed:', JSON.stringify(parsed, null, 2));
                } catch (e) {
                    console.log('Failed to parse JSON:', e.message);
                }
            } else {
                console.log('No config_json');
            }
            console.log('');
            
            // Check admin user
            console.log('4. ADMIN USER:');
            db.get('SELECT id, name, phone, email, role FROM users WHERE school_id = ? AND role = ?', [schoolId, 'admin'], (err, row) => {
                if (err) {
                    console.error('Error:', err);
                } else {
                    console.log('Admin user:', row);
                }
                
                db.close();
                console.log('\n=====================================');
                console.log('Database check complete');
            });
        });
    });
});
