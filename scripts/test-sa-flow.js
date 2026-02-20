// Direct SA Flow Test - Bypasses auth
const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testSAFlow() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   LIVE SA FLOW TEST - PRIMARY VARIANT                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const schoolId = '3876fd28-bfe7-4450-bc69-bad51d533330';
  const adminPhone = '+2347040522085';

  // Step 0: Warm Welcome - Start with greeting
  console.log('📱 STEP 0: WARM WELCOME');
  console.log('   Sending: "Hello"\n');
  
  try {
    const response = await axios.post(`${API_BASE}/api/test/trigger-sa`, {
      from: adminPhone,
      body: 'Hello',
      type: 'text'
    }, { timeout: 60000 });
    
    console.log('   ✅ Response received:');
    console.log('   ', (response.data.response?.body || response.data.response?.reply_text || 'No text response').substring(0, 200));
    console.log('');
    
    if (response.data.response?.action_required) {
      console.log('   Action:', response.data.response.action_required);
    }
    
  } catch (error) {
    console.log('   ❌ Error:', error.response?.data || error.message);
  }

  // Step 1: Provide admin name
  console.log('📱 STEP 1: ADMIN NAME');
  console.log('   Sending: "My name is Admin"\n');
  
  try {
    const response = await axios.post(`${API_BASE}/api/test/trigger-sa`, {
      from: adminPhone,
      body: 'My name is Admin',
      type: 'text'
    }, { timeout: 60000 });
    
    console.log('   ✅ Response received:');
    console.log('   ', (response.data.response?.body || response.data.response?.reply_text || 'No text response').substring(0, 200));
    console.log('');
    
  } catch (error) {
    console.log('   ❌ Error:', error.response?.data || error.message);
  }

  // Step 2: Confirm School Identity - Provide school info + explicit school_type
  console.log('📱 STEP 2: CONFIRM_SCHOOL_IDENTITY');
  console.log('   Sending: "School name is testskull, address is 123 Test Ave, phone is +2347040522085, school type is PRIMARY"\n');
  
  try {
    const response = await axios.post(`${API_BASE}/api/test/trigger-sa`, {
      from: adminPhone,
      body: 'School name is testskull, address is 123 Test Avenue Lagos Nigeria, phone is +2347040522085, school type is PRIMARY',
      type: 'text'
    }, { timeout: 60000 });
    
    console.log('   ✅ Response received:');
    console.log('   ', (response.data.response?.body || response.data.response?.reply_text || 'No text response').substring(0, 300));
    console.log('');
    
    // Check if action was SETUP_SCHOOL
    if (response.data.response?.action_required === 'SETUP_SCHOOL') {
      console.log('   🎯 ACTION: SETUP_SCHOOL triggered!');
    }
    
  } catch (error) {
    console.log('   ❌ Error:', error.response?.data || error.message);
  }

  // Check final state
  console.log('\n📊 CHECKING FINAL STATE...');
  const schools = await axios.get(`${API_BASE}/api/schools/me`, {
    headers: { 
      // Would need token here
    }
  }).catch(e => ({ data: null }));
  
  console.log('\n✅ Test sequence complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Check backend logs for LLM prompts and responses');
  console.log('2. Verify school_type was stored as PRIMARY (not defaulted)');
  console.log('3. Check if setup_status moved to OPERATIONAL');
}

testSAFlow().catch(console.error);
