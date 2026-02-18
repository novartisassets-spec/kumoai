/**
 * PROMPT ASSEMBLY VERIFICATION
 * Verifies assembled prompts contain all context variables
 * No LLM API calls - just checks prompt construction
 */

import { db } from '../src/db';
import { PromptEngine } from '../src/core/prompt-engine';

const testResults: { agent: string; variables: string[]; found: string[]; missing: string[] }[] = [];

async function verifySA_PromptAssembly() {
    console.log("\n🧪 VERIFYING SA Agent Prompt Assembly");
    
    const schoolId = "TEST-SCHOOL-001";
    
    const escalationContext = `
## ACTIVE ESCALATIONS
- ID: ESC-001
- TYPE: MARK_SUBMISSION_APPROVAL
- PDF ATTACHED: YES
`;
    
    const prompt = await PromptEngine.assemble({
        agent: 'sa',
        schoolId,
        dynamicVars: {
            escalation_context: escalationContext,
            has_escalations: 'YES',
            escalation_count: 1
        }
    });
    
    const requiredVars = ['escalation_context', 'ACTIVE ESCALATIONS', 'CLOSE_ESCALATION'];
    const found = requiredVars.filter(v => prompt.includes(v));
    const missing = requiredVars.filter(v => !prompt.includes(v));
    
    console.log(`   Found: ${found.length}/${requiredVars.length} markers`);
    found.forEach(v => console.log(`      ✅ ${v}`));
    missing.forEach(v => console.log(`      ❌ ${v}`));
    
    testResults.push({ agent: 'SA', variables: requiredVars, found, missing });
}

async function verifyTA_PromptAssembly() {
    console.log("\n🧪 VERIFYING TA Agent Prompt Assembly");
    
    const schoolId = "TEST-SCHOOL-001";
    
    const prompt = await PromptEngine.assemble({
        agent: 'ta',
        schoolId,
        dynamicVars: {
            teacher_name: 'Mr. Test',
            school_type: 'SECONDARY',
            assigned_class: 'JSS 1',
            assigned_subjects: 'Math, English',
            workload_status: 'Complete',
            grading_config: '{"pillars":[]}',
            student_list: 'Student A, B'
        }
    });
    
    const requiredVars = [
        'Teacher Name: Mr. Test',
        'Assigned Class: JSS 1',
        'Subjects: Math, English',
        'Workload Status: Complete',
        'Student Roster: Student A'
    ];
    
    const found = requiredVars.filter(v => prompt.includes(v));
    const missing = requiredVars.filter(v => !prompt.includes(v));
    
    console.log(`   Found: ${found.length}/${requiredVars.length} markers`);
    found.forEach(v => console.log(`      ✅ ${v.substring(0, 40)}...`));
    missing.forEach(v => console.log(`      ❌ ${v.substring(0, 40)}...`));
    
    testResults.push({ agent: 'TA', variables: requiredVars, found, missing });
}

async function verifyPA_PromptAssembly() {
    console.log("\n🧪 VERIFYING PA Agent Prompt Assembly");
    
    const schoolId = "TEST-SCHOOL-001";
    
    const prompt = await PromptEngine.assemble({
        agent: 'pa',
        schoolId,
        dynamicVars: {
            parent_name: 'Mrs. Parent',
            children_list: 'Child A (JSS 1), Child B (JSS 2)',
            linked_student_id: 'STU-001',
            school_type: 'SECONDARY'
        }
    });
    
    const requiredVars = [
        'Parent Name: Mrs. Parent',
        'Children: Child A (JSS 1)',
        'Linked Student ID: STU-001'
    ];
    
    const found = requiredVars.filter(v => prompt.includes(v));
    const missing = requiredVars.filter(v => !prompt.includes(v));
    
    console.log(`   Found: ${found.length}/${requiredVars.length} markers`);
    found.forEach(v => console.log(`      ✅ ${v}`));
    missing.forEach(v => console.log(`      ❌ ${v}`));
    
    testResults.push({ agent: 'PA', variables: requiredVars, found, missing });
}

async function verifyGA_PromptAssembly() {
    console.log("\n🧪 VERIFYING GA Agent Prompt Assembly");
    
    const schoolId = "TEST-SCHOOL-001";
    
    const prompt = await PromptEngine.assemble({
        agent: 'ga',
        schoolId,
        dynamicVars: {
            school_type: 'SECONDARY',
            task_type: 'new_member_welcome',
            member_count: '45',
            new_member_name: 'New Parent'
        }
    });
    
    const requiredVars = [
        'Member Count: 45',
        'Task: new_member_welcome',
        'Member Name: New Parent'
    ];
    
    const found = requiredVars.filter(v => prompt.includes(v));
    const missing = requiredVars.filter(v => !prompt.includes(v));
    
    console.log(`   Found: ${found.length}/${requiredVars.length} markers`);
    found.forEach(v => console.log(`      ✅ ${v}`));
    missing.forEach(v => console.log(`      ❌ ${v}`));
    
    testResults.push({ agent: 'GA', variables: requiredVars, found, missing });
}

async function verifyPrimaryTA_PromptAssembly() {
    console.log("\n🧪 VERIFYING Primary TA Agent Prompt Assembly");
    
    const schoolId = "TEST-SCHOOL-001";
    
    const prompt = await PromptEngine.assemble({
        agent: 'primary-ta',
        schoolId,
        dynamicVars: {
            teacher_name: 'Mrs. Primary',
            school_type: 'PRIMARY',
            assigned_class: 'Primary 1',
            grading_config: '{"pillars":[]}',
            workload_status: 'Complete'
        }
    });
    
    const requiredVars = [
        'Teacher Name: Mrs. Primary',
        'Assigned Class: Primary 1',
        'Type: PRIMARY'
    ];
    
    const found = requiredVars.filter(v => prompt.includes(v));
    const missing = requiredVars.filter(v => !prompt.includes(v));
    
    console.log(`   Found: ${found.length}/${requiredVars.length} markers`);
    found.forEach(v => console.log(`      ✅ ${v}`));
    missing.forEach(v => console.log(`      ❌ ${v}`));
    
    testResults.push({ agent: 'PRIMARY_TA', variables: requiredVars, found, missing });
}

async function runPromptVerification() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("🔍 PROMPT ASSEMBLY VERIFICATION");
    console.log("═══════════════════════════════════════════════════════════\n");
    
    await db.init();
    
    // Seed test school
    await new Promise<void>((resolve, reject) => {
        db.getDB().run(
            `INSERT OR IGNORE INTO schools (id, name, school_type, setup_status) VALUES (?, ?, 'SECONDARY', 'OPERATIONAL')`,
            ["TEST-SCHOOL-001", "Test Academy"],
            (err) => err ? reject(err) : resolve()
        );
    });
    
    // Run verifications
    await verifySA_PromptAssembly();
    await verifyTA_PromptAssembly();
    await verifyPA_PromptAssembly();
    await verifyGA_PromptAssembly();
    await verifyPrimaryTA_PromptAssembly();
    
    // Summary
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("📊 VERIFICATION SUMMARY");
    console.log("═══════════════════════════════════════════════════════════\n");
    
    let totalVars = 0;
    let totalFound = 0;
    
    testResults.forEach(r => {
        const allFound = r.missing.length === 0;
        const icon = allFound ? '✅' : '⚠️';
        console.log(`${icon} [${r.agent}] ${r.found.length}/${r.variables.length} variables found`);
        if (r.missing.length > 0) {
            console.log(`   Missing: ${r.missing.join(', ')}`);
        }
        totalVars += r.variables.length;
        totalFound += r.found.length;
    });
    
    console.log(`\n📈 Total: ${totalFound}/${totalVars} context markers verified`);
    console.log(`🎯 Coverage: ${Math.round((totalFound / totalVars) * 100)}%`);
    
    const allPass = testResults.every(r => r.missing.length === 0);
    
    if (allPass) {
        console.log("\n🏆 ALL PROMPTS ASSEMBLED CORRECTLY");
        console.log("   Context variables are being injected properly");
        console.log("   Ready for LLM conversational flow");
    }
    
    db.close();
    return allPass;
}

runPromptVerification().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
