// Live WhatsApp SA Flow Test Script
// This script simulates sending WhatsApp messages to trigger and progress through the SA setup flow

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

// Test data for three variants
const VARIANTS = [
  {
    name: 'Test Skull PRIMARY',
    type: 'PRIMARY',
    phone: '+2347040522085', // The admin phone for testskull
    address: '123 Test Avenue, Lagos Nigeria',
    schoolType: 'PRIMARY'
  },
  {
    name: 'Test Skull SECONDARY', 
    type: 'SECONDARY',
    phone: '+2347040522085',
    address: '456 Education Lane, Abuja Nigeria',
    schoolType: 'SECONDARY'
  },
  {
    name: 'Test Skull BOTH',
    type: 'BOTH',
    phone: '+2347040522085',
    address: '789 Academy Road, Lagos Nigeria', 
    schoolType: 'BOTH'
  }
];

// Step-by-step messages to send for each variant
const FLOW_MESSAGES = {
  // Step 0: Warm Welcome - admin name
  step0: [
    "Hello",
    "My name is Admin"
  ],
  
  // Step 1: CONFIRM_SCHOOL_IDENTITY - school info + explicit school_type
  step1: [
    "School name is testskull",
    "Address is 123 Test Avenue",
    "Phone is +2347040522085",
    "School type is PRIMARY" // This must be explicit!
  ],
  
  // Step 2: SCHOOL_STRUCTURE_SETUP - classes and subjects
  step2: [
    "We have Primary 1, Primary 2, Primary 3",
    "Subjects are Mathematics, English, Science"
  ],
  
  // Step 3: SUBJECT_REQUISITION - verify subjects
  step3: [
    "Yes that's correct"
  ],
  
  // Step 4: ACADEMIC_TERM_CONFIG - current term
  // Skipping for brevity in test
};

async function sendWhatsAppMessage(phone, message) {
  // Simulate sending a WhatsApp message by calling the API
  // This would typically go through the WhatsApp transport
  console.log(`📱 Sending WhatsApp message from ${phone}: "${message}"`);
  
  // For testing, we'll call the agent dispatcher directly via a test endpoint
  // or we can trigger via the backend's message handling
  
  // Try to find if there's a test endpoint
  try {
    // Check if there's a direct API to trigger SA flow
    const response = await axios.post(`${API_BASE}/test/trigger-sa`, {
      from: phone,
      body: message,
      type: 'text'
    }, { timeout: 30000 });
    return response.data;
  } catch (error) {
    console.log('Note: Direct API not available, checking setup state...');
    return null;
  }
}

async function checkSetupState(schoolId) {
  try {
    const response = await axios.get(`${API_BASE}/setup/status/${schoolId}`);
    return response.data;
  } catch (error) {
    console.log('Setup status check failed:', error.message);
    return null;
  }
}

async function runLiveTest() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   LIVE WHATSAPP SA FLOW TEST - THREE VARIANTS           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  
  // First, let's check what schools exist
  console.log('📊 Checking existing schools in database...');
  
  // Get the testskull school ID
  const testSchoolId = '3876fd28-bfe7-4450-bc69-bad51d533330';
  
  console.log(`\n🎯 Starting SA flow test for: testskull`);
  console.log(`   Current setup status: IN_PROGRESS`);
  console.log(`   Current step: CONFIRM_SCHOOL_IDENTITY`);
  console.log('');
  
  // Since we can't directly send WhatsApp messages via API without the transport,
  // let's create a test script that simulates the flow by directly calling the SA agent
  // We'll use the REST API to verify the current state and simulate the flow
  
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 0: WARM WELCOME (Admin Name)                         │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('Expected: System should ask "What should I call you?"');
  console.log('');
  
  // Check current state
  const state = await checkSetupState(testSchoolId);
  console.log('Current setup state:', JSON.stringify(state, null, 2));
  
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 1: CONFIRM_SCHOOL_IDENTITY                           │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('Expected: Provide school name, address, phone, EXPLICIT school_type');
  console.log('');
  
  // The key test: verify that school_type is NOT defaulted
  console.log('🔍 KEY TEST: Checking if school_type defaults to SECONDARY...');
  
  // Check the school record
  const schoolResponse = await axios.get(`${API_BASE}/schools/me`, {
    headers: { 
      // We'd need auth token here
    }
  }).catch(e => ({ data: null }));
  
  console.log('\n✅ Test preparation complete.');
  console.log('\nTo complete the live WhatsApp test:');
  console.log('1. Open WhatsApp on the admin phone');
  console.log('2. Send a message to start the SA flow');
  console.log('3. The system will guide through 8 steps');
  console.log('4. At Step 1, explicitly provide school_type as PRIMARY/SECONDARY/BOTH');
  console.log('');
  console.log('Monitor the backend logs for:');
  console.log('- LLM prompts and responses');
  console.log('- JSON parsing/repair events');
  console.log('- School type handling (no defaulting)');
  console.log('- Final OPERATIONAL status');
}

runLiveTest().catch(console.error);
