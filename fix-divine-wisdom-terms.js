const sqlite3 = require('sqlite3');
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('./kumo.db');

const SCHOOL_ID = '6a94c74c-95de-4137-9004-743efd0131e6';

console.log('═══════════════════════════════════════════════════════════');
console.log('  FIXING DIVINE WISDOM SCHOOL - ADDING MISSING TERMS');
console.log('═══════════════════════════════════════════════════════════\n');

async function fixTerms() {
  try {
    // Check current state
    console.log('1. Checking current state...');
    const currentTerms = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM academic_terms WHERE school_id = ?', [SCHOOL_ID], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('   Current terms count:', currentTerms.length);
    
    if (currentTerms.length > 0) {
      console.log('   Terms already exist! No fix needed.');
      console.log('   Existing terms:', currentTerms.map(t => t.term_name).join(', '));
      return;
    }
    
    // Get school info to determine appropriate dates
    const school = await new Promise((resolve, reject) => {
      db.get('SELECT name, config_json FROM schools WHERE id = ?', [SCHOOL_ID], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    console.log('\n2. School info:');
    console.log('   Name:', school.name);
    if (school.config_json) {
      const config = JSON.parse(school.config_json);
      console.log('   Address:', config.address || 'N/A');
    }
    
    // Ask for term dates or use defaults
    console.log('\n3. Adding default terms for 2025 academic year...');
    
    // Default terms for a Nigerian primary school (adjust dates as needed)
    const termsToAdd = [
      {
        id: uuidv4(),
        name: 'First Term',
        start: '2025-01-13',
        end: '2025-04-04'
      },
      {
        id: uuidv4(),
        name: 'Second Term',
        start: '2025-04-28',
        end: '2025-07-18'
      },
      {
        id: uuidv4(),
        name: 'Third Term',
        start: '2025-09-15',
        end: '2025-12-05'
      }
    ];
    
    console.log('\n   Terms to add:');
    termsToAdd.forEach((term, i) => {
      console.log(`   ${i + 1}. ${term.name}: ${term.start} to ${term.end}`);
    });
    
    // Insert terms
    console.log('\n4. Inserting terms into database...');
    for (const term of termsToAdd) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO academic_terms (id, school_id, term_name, start_date, end_date) VALUES (?, ?, ?, ?, ?)`,
          [term.id, SCHOOL_ID, term.name, term.start, term.end],
          (err) => {
            if (err) {
              console.error('   Error inserting term:', err);
              reject(err);
            } else {
              console.log(`   ✅ Added: ${term.name}`);
              resolve();
            }
          }
        );
      });
    }
    
    // Verify
    console.log('\n5. Verifying fix...');
    const verifyTerms = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM academic_terms WHERE school_id = ? ORDER BY start_date', [SCHOOL_ID], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('   Terms count after fix:', verifyTerms.length);
    verifyTerms.forEach((term, i) => {
      console.log(`   ${i + 1}. ${term.term_name}: ${term.start_date} to ${term.end_date}`);
    });
    
    console.log('\n✅ SUCCESS! Terms have been added to Divine Wisdom school.');
    console.log('\n📋 Next steps:');
    console.log('   1. Refresh the frontend page');
    console.log('   2. Go to Settings → School Setup Wizard');
    console.log('   3. Navigate to Step 3 (Academic Terms)');
    console.log('   4. You should now see the 3 terms with their dates');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
  } finally {
    db.close();
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  FIX COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
  }
}

// Show confirmation
console.log('This script will add 3 academic terms to Divine Wisdom school.');
console.log('School ID:', SCHOOL_ID);
console.log('\nDefault dates (2025 academic year):');
console.log('  - First Term: Jan 13 - Apr 4');
console.log('  - Second Term: Apr 28 - Jul 18');
console.log('  - Third Term: Sep 15 - Dec 5');
console.log('\nTo run this fix, execute:');
console.log('  node fix-divine-wisdom-terms.js');
console.log('\nOr press Ctrl+C to cancel.\n');

// Auto-run after 2 seconds
setTimeout(() => {
  console.log('Running fix in 3 seconds...');
  setTimeout(fixTerms, 3000);
}, 1000);
