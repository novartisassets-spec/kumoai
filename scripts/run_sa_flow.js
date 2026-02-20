// End-to-end SA flow tester (admin onboarding) using REST API calls
const fetch = typeof globalThis.fetch === 'function' ? globalThis.fetch : (...args) => import('node-fetch').then(({default: f}) => f(...args));
(async () => {
  const base = process.env.API_BASE || 'http://localhost:3000/api';
  const schoolName = 'Test Lexicon Academy';
  // Use a unique admin phone per run to avoid conflicts (9 random digits in addition to country code)
  const adminPhone = '+1' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const email = 'test@example.com';
  const password = 'TestPass123!';
  const address = '123 Test Street';
  const schoolType = 'PRIMARY';

  console.log('Starting SA test flow: signup with explicit schoolType');
  const signupRes = await fetch(base + '/auth/signup', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ schoolName, adminPhone, email, password, address, schoolType })
  });
  const signup = await signupRes.json();
  console.log('Signup response:', signup);
  if (!signup.success) {
    console.error('Signup failed. Exiting.');
    process.exit(1);
  }
  const user = signup.data?.user;
  const token = signup.data?.accessToken;
  const schoolId = user?.schoolId;
  if (!schoolId || !token) {
    console.error('Missing schoolId or token from signup');
    process.exit(1);
  }

  // Build Setup payload
  const payload = {
    schoolInfo: { name: schoolName, type: schoolType, address, phone: adminPhone, email },
    terms: [{
      id: 't1',
      name: 'First Term',
      startDate: '2026-01-01',
      endDate: '2026-04-01'
    }],
    gradingConfig: {
      pillars: [{ id: 'ca1', name: 'CA1', maxScore: 20 }],
      totalMax: 100,
      gradingScale: '0-100',
      rankStudents: false
    },
    universe: {
      classes: [{ id: 'c1', name: 'Primary 1', type: 'PRIMARY' }, { id: 'c2', name: 'Primary 2', type: 'PRIMARY' }],
      subjects: [{ id: 's1', name: 'Mathematics' }, { id: 's2', name: 'English' }]
    },
    teachers: [],
    feesPolicies: { fees: [], policies: [] }
  };

  console.log('Submitting SA setup payload to /setup/save/:schoolId');
  const setupRes = await fetch(`${base}/setup/save/${schoolId}`, {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const setup = await setupRes.json();
  console.log('SA Setup response:', setup);
  // Optional: attempt to finalize readiness (if endpoint exists)
  try {
    const completeRes = await fetch(`${base}/setup/complete/${schoolId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({})
    });
    const complete = await completeRes.json();
    console.log('SA Complete response:', complete);
  } catch (e) {
    console.log('SA Complete endpoint not available or failed to run:', e && e.message ? e.message : e);
  }
  process.exit(setup.success ? 0 : 2);
})();
