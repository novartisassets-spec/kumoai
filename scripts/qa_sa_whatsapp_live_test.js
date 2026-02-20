// QA: End-to-end SA flow live test via REST API (approximating WhatsApp path)
const axios = require('axios');
const crypto = require('crypto');

const BASE = process.env.API_BASE || 'http://localhost:3000/api';

async function signup(schoolName, adminPhone, password, address, schoolType) {
  const res = await axios.post('http://localhost:3000/api/auth/signup', {
    schoolName,
    adminPhone,
    email: `test+${adminPhone}@example.com`,
    password,
    address,
    schoolType
  }, { withCredentials: true });
  return res.data;
}

async function setupSave(schoolId, token, payload) {
  const res = await axios.post(`http://localhost:3000/api/setup/save/${schoolId}`, payload, {
    headers: { 'Authorization': `Bearer ${token}` },
    withCredentials: true
  });
  return res.data;
}

async function runOne(schoolName, adminPhone, address, schoolType) {
  console.log('Starting SA test via REST for', schoolName, 'type=', schoolType);
  const signupRes = await signup(schoolName, adminPhone, 'TestPass123!', address, schoolType);
  if (!signupRes.success) throw new Error('Signup failed');
  const user = signupRes.data.user;
  const token = signupRes.data.accessToken;
  const schoolId = user.schoolId;

  const payload = {
    schoolInfo: { name: schoolName, type: schoolType, address, phone: adminPhone, email: `admin@${schoolName}.com` },
    terms: [{ id: 't1', name: 'First Term', startDate: '2026-01-01', endDate: '2026-04-01' }],
    gradingConfig: { pillars: [{ id: 'ca1', name: 'CA1', maxScore: 20 }], totalMax: 100, gradingScale: '0-100', rankStudents: false },
    universe: { classes: [{ id: 'c1', name: 'Class 1', type: schoolType }], subjects: [{ id: 's1', name: 'Mathematics' }] },
    teachers: [],
    feesPolicies: { fees: [], policies: [] }
  };

  const saveRes = await setupSave(schoolId, token, payload);
  console.log('SA Setup Save response:', saveRes);
  const complete = await axios.post(`http://localhost:3000/api/setup/complete/${schoolId}`, {}, {
    headers: { 'Authorization': `Bearer ${token}` },
    withCredentials: true
  });
  console.log('SA Setup Complete response:', complete.data);
}

async function main() {
  // Use three variants sequentially
  const variants = [
    { name: 'Test Skull Primary', type: 'PRIMARY' },
    { name: 'Test Skull Secondary', type: 'SECONDARY' },
    { name: 'Test Skull Both', type: 'BOTH' }
  ];
  for (const v of variants) {
    // randomize a phone per run
    const phone = '+1' + Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
    try {
      await runOne(v.name, phone, '123 Test Ave', v.type);
      console.log('OK: completed', v.name);
    } catch (e) {
      console.error('ERR on', v.name, e && e.message ? e.message : e);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
