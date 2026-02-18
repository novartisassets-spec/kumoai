/**
 * CONTEXT INJECTION VALIDATION TEST
 * Verifies all agents have proper context in their prompts
 */

import { db } from '../src/db';
import { PromptEngine } from '../src/core/prompt-engine';
import { EscalationServiceV2 } from '../src/services/escalation-v2';
import { logger } from '../src/utils/logger';

const testResults: { agent: string; contextInjected: boolean; missingVars: string[] }[] = [];

async function validateSAContextInjection() {
    console.log("\n🧪 VALIDATING SA Agent Context Injection");
    
    const schoolId = "TEST-SCHOOL-001";
    
    // Create a pending escalation to test injection
    await EscalationServiceV2.pauseForEscalation({
        school_id: schoolId,
        origin_agent: 'TA',
        from_phone: '2348098765432',
        what_agent_needed: 'Admin approval for JSS1 Math marks',
        escalation_type: 'MARK_SUBMISSION_APPROVAL',
        priority: 'HIGH',
        session_id: 'test-session-001',
        pause_message_id: 'test-msg-001',
        reason: 'Teacher submitted marks for approval',
        context: {
            pdf_path: 'pdf-output/test-broadsheet.pdf',
            class_level: 'JSS 1',
            subject: 'Mathematics'
        }
    });
    
    // Now test that the prompt assembly includes escalation context
    const pendingEscalations = await EscalationServiceV2.getPendingEscalations(schoolId);
    
    if (pendingEscalations.length === 0) {
        console.log("   ❌ No pending escalations found");
        testResults.push({ agent: 'SA', contextInjected: false, missingVars: ['escalation_context'] });
        return;
    }
    
    // Build escalation context (same logic as in SA agent)
    let escalationContext = '';
    if (pendingEscalations.length > 0) {
        escalationContext = '\n\n## ACTIVE ESCALATIONS (AWAITING YOUR DECISION)\n\n';
        pendingEscalations.forEach((esc, idx) => {
            const contextData = typeof esc.context === 'string' ? JSON.parse(esc.context || '{}') : (esc.context || {});
            escalationContext += `### ESCALATION ${idx + 1}:\n`;
            escalationContext += `- **ID**: ${esc.id}\n`;
            escalationContext += `- **FROM**: ${esc.origin_agent} Agent\n`;
            escalationContext += `- **TYPE**: ${esc.escalation_type || 'General'}\n`;
            if (contextData.pdf_path) {
                escalationContext += `- **PDF ATTACHED**: YES\n`;
            }
        });
    }
    
    // Assemble prompt
    const systemPrompt = await PromptEngine.assemble({
        agent: 'sa',
        schoolId,
        dynamicVars: {
            escalation_context: escalationContext,
            has_escalations: 'YES',
            escalation_count: pendingEscalations.length
        }
    });
    
    // Validate
    const checks = [
        { name: 'escalation_context', found: systemPrompt.includes('ACTIVE ESCALATIONS') },
        { name: 'escalation_id', found: systemPrompt.includes('ESC-') },
        { name: 'pdf_reference', found: systemPrompt.includes('PDF ATTACHED') },
        { name: 'escalation_protocol', found: systemPrompt.includes('CLOSE_ESCALATION') }
    ];
    
    const missing = checks.filter(c => !c.found).map(c => c.name);
    const allFound = missing.length === 0;
    
    console.log(`   ${allFound ? '✅' : '❌'} Context Injection: ${allFound ? 'PASSED' : 'FAILED'}`);
    checks.forEach(c => console.log(`      ${c.found ? '✅' : '❌'} ${c.name}`));
    
    testResults.push({ agent: 'SA', contextInjected: allFound, missingVars: missing });
    
    // Cleanup - mark as completed via database
    await new Promise<void>((resolve) => {
        db.getDB().run(
            `UPDATE escalation_records SET status = 'COMPLETED', resolution = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
            ['Test cleanup - approved', pendingEscalations[0].id],
            () => resolve()
        );
    });
}

async function validateTAContextInjection() {
    console.log("\n🧪 VALIDATING TA Agent Context Injection");
    
    const schoolId = "TEST-SCHOOL-001";
    
    const systemPrompt = await PromptEngine.assemble({
        agent: 'ta',
        schoolId,
        dynamicVars: {
            teacher_name: 'Test Teacher',
            school_type: 'SECONDARY',
            assigned_class: 'JSS 1',
            assigned_subjects: 'Mathematics, English',
            workload_status: 'Missing: 2 subjects',
            grading_config: JSON.stringify({ pillars: [] }),
            current_draft_context: 'None',
            student_list: 'Student A, Student B'
        }
    });
    
    const checks = [
        { name: 'teacher_name', found: systemPrompt.includes('Test Teacher') },
        { name: 'school_type', found: systemPrompt.includes('SECONDARY') },
        { name: 'assigned_class', found: systemPrompt.includes('JSS 1') },
        { name: 'workload_status', found: systemPrompt.includes('Missing:') },
        { name: 'grading_config', found: systemPrompt.includes('pillars') },
        { name: 'student_list', found: systemPrompt.includes('Student A') }
    ];
    
    const missing = checks.filter(c => !c.found).map(c => c.name);
    const allFound = missing.length === 0;
    
    console.log(`   ${allFound ? '✅' : '❌'} Context Injection: ${allFound ? 'PASSED' : 'FAILED'}`);
    checks.forEach(c => console.log(`      ${c.found ? '✅' : '❌'} ${c.name}`));
    
    testResults.push({ agent: 'TA', contextInjected: allFound, missingVars: missing });
}

async function validatePAContextInjection() {
    console.log("\n🧪 VALIDATING PA Agent Context Injection");
    
    const schoolId = "TEST-SCHOOL-001";
    
    const systemPrompt = await PromptEngine.assemble({
        agent: 'pa',
        schoolId,
        dynamicVars: {
            parent_name: 'Mrs. Test Parent',
            children_list: 'Child A (JSS 1), Child B (JSS 2)',
            linked_student_id: 'STU-001',
            linked_student_name: 'Child A',
            school_type: 'SECONDARY',
            session_active: 'true'
        }
    });
    
    const checks = [
        { name: 'parent_name', found: systemPrompt.includes('Mrs. Test Parent') },
        { name: 'children_list', found: systemPrompt.includes('Child A (JSS 1)') },
        { name: 'linked_student', found: systemPrompt.includes('STU-001') },
        { name: 'school_type', found: systemPrompt.includes('SECONDARY') }
    ];
    
    const missing = checks.filter(c => !c.found).map(c => c.name);
    const allFound = missing.length === 0;
    
    console.log(`   ${allFound ? '✅' : '❌'} Context Injection: ${allFound ? 'PASSED' : 'FAILED'}`);
    checks.forEach(c => console.log(`      ${c.found ? '✅' : '❌'} ${c.name}`));
    
    testResults.push({ agent: 'PA', contextInjected: allFound, missingVars: missing });
}

async function validateGAContextInjection() {
    console.log("\n🧪 VALIDATING GA Agent Context Injection");
    
    const schoolId = "TEST-SCHOOL-001";
    
    const systemPrompt = await PromptEngine.assemble({
        agent: 'ga',
        schoolId,
        dynamicVars: {
            school_type: 'SECONDARY',
            task_type: 'new_member_welcome',
            current_time: '10:00 AM',
            day_of_week: 'Monday',
            new_member_name: 'New Parent',
            member_count: '45',
            is_emergency_mode: 'NO'
        }
    });
    
    const checks = [
        { name: 'school_type', found: systemPrompt.includes('SECONDARY') },
        { name: 'task_type', found: systemPrompt.includes('new_member_welcome') },
        { name: 'time_context', found: systemPrompt.includes('10:00 AM') },
        { name: 'member_count', found: systemPrompt.includes('45') }
    ];
    
    const missing = checks.filter(c => !c.found).map(c => c.name);
    const allFound = missing.length === 0;
    
    console.log(`   ${allFound ? '✅' : '❌'} Context Injection: ${allFound ? 'PASSED' : 'FAILED'}`);
    checks.forEach(c => console.log(`      ${c.found ? '✅' : '❌'} ${c.name}`));
    
    testResults.push({ agent: 'GA', contextInjected: allFound, missingVars: missing });
}

async function validatePrimaryTAContextInjection() {
    console.log("\n🧪 VALIDATING Primary TA Agent Context Injection");
    
    const schoolId = "TEST-SCHOOL-001";
    
    const systemPrompt = await PromptEngine.assemble({
        agent: 'primary-ta',
        schoolId,
        dynamicVars: {
            teacher_name: 'Primary Teacher',
            school_type: 'PRIMARY',
            assigned_class: 'Primary 1',
            grading_config: JSON.stringify({ pillars: [{id: 'ca1', name: 'CA 1', max_score: 20}] }),
            workload_status: 'Complete'
        }
    });
    
    const checks = [
        { name: 'school_type', found: systemPrompt.includes('PRIMARY') },
        { name: 'assigned_class', found: systemPrompt.includes('Primary 1') },
        { name: 'grading_config', found: systemPrompt.includes('CA 1') }
    ];
    
    const missing = checks.filter(c => !c.found).map(c => c.name);
    const allFound = missing.length === 0;
    
    console.log(`   ${allFound ? '✅' : '❌'} Context Injection: ${allFound ? 'PASSED' : 'FAILED'}`);
    checks.forEach(c => console.log(`      ${c.found ? '✅' : '❌'} ${c.name}`));
    
    testResults.push({ agent: 'PRIMARY_TA', contextInjected: allFound, missingVars: missing });
}

async function runValidation() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("🔍 CONTEXT INJECTION VALIDATION SUITE");
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
    
    // Run validations
    await validateSAContextInjection();
    await validateTAContextInjection();
    await validatePAContextInjection();
    await validateGAContextInjection();
    await validatePrimaryTAContextInjection();
    
    // Summary
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("📊 VALIDATION SUMMARY");
    console.log("═══════════════════════════════════════════════════════════\n");
    
    const passed = testResults.filter(r => r.contextInjected).length;
    const total = testResults.length;
    
    testResults.forEach(r => {
        const icon = r.contextInjected ? '✅' : '❌';
        console.log(`${icon} [${r.agent}] ${r.contextInjected ? 'CONTEXT OK' : 'MISSING: ' + r.missingVars.join(', ')}`);
    });
    
    console.log(`\n📈 Results: ${passed}/${total} agents with proper context injection`);
    console.log(`🎯 Success Rate: ${Math.round((passed / total) * 100)}%`);
    
    db.close();
    
    if (passed === total) {
        console.log("\n🏆 ALL AGENTS HAVE PROPER CONTEXT INJECTION");
        console.log("   Ready for LLM conversational flow testing");
    } else {
        console.log("\n⚠️  SOME AGENTS MISSING CONTEXT");
        console.log("   Review failed agents above");
    }
    
    return passed === total;
}

runValidation().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
