// Check what data is actually being returned by the setup endpoint
const fetch = require('node-fetch');

const API_URL = 'http://10.25.123.149:3000/api';
const schoolId = '6a94c74c-95de-4137-9004-743efd0131e6';

// You'll need to get a valid token from your browser's localStorage
// This is just to show what the endpoint structure looks like

console.log('To test the setup endpoint, run this in your browser console:');
console.log('============================================================');
console.log('');
console.log('const token = localStorage.getItem("kumo_access_token");');
console.log(`fetch('${API_URL}/setup/status/${schoolId}', {`);
console.log('  headers: { Authorization: `Bearer ${token}` }');
console.log('})');
console.log('.then(r => r.json())');
console.log('.then(data => console.log("Setup data:", JSON.stringify(data, null, 2)))');
console.log('.catch(e => console.error(e));');
console.log('');
console.log('============================================================');
console.log('');
console.log('ISSUES FOUND:');
console.log('1. Terms: 0 records in database - SA agent never saved them');
console.log('2. Grading: EXISTS in database but uses "max_score" (not "maxScore")');
console.log('3. Config: Missing schoolType, email in config_json');
console.log('');
console.log('RECOMMENDATIONS:');
console.log('1. The admin needs to provide terms during SA WhatsApp setup');
console.log('2. Or: Add a "create missing data" button in the frontend wizard');
console.log('3. Fix: Ensure frontend handles both max_score and maxScore');
