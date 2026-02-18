import { AgentDispatcher } from '../src/core/dispatcher';
import { MessageRouter } from '../src/core/router';
import { db } from '../src/db';
import fs from 'fs';
import path from 'path';

/**
 * SECURITY AUDIT SCRIPT
 * 1. Static Analysis (SAST-lite): Scans code for common vulnerability patterns.
 * 2. Dynamic Analysis (DAST-lite): Sends malicious payloads to AgentDispatcher.
 */

const VULN_PATTERNS = [
    { name: "Hardcoded Secret", regex: /['"](SK-[a-zA-Z0-9]{20,})['"] / },
    { name: "Dangerous Eval", regex: /\beval\(/ },
    { name: "Unsanitized SQL (concatenation)", regex: /db\.getDB\(\)\.(?:run|get|all)\( `.*\$\{.*?\}` \) / }, // rudimentary check
    { name: "Console Log Sensitive", regex: /console\.log\(.*? (?:password|secret|token|key).*?\)/i }
];

async function runStaticAnalysis(dir: string): Promise<string[]> {
    const issues: string[] = [];
    const files = fs.readdirSync(dir, { recursive: true }) as string[];
    
    for (const file of files) {
        // Skip node_modules, dist, git, etc.
        if (typeof file !== 'string' || file.includes('node_modules') || file.includes('.git') || file.includes('dist')) continue;
        
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
             // Recursive check handled by recursive readdir if available or manual walk. 
             // node fs.readdir with recursive:true returns relative paths
             continue;
        }

        if (!fullPath.endsWith('.ts') && !fullPath.endsWith('.js')) continue;

        const content = fs.readFileSync(fullPath, 'utf-8');
        
        for (const pattern of VULN_PATTERNS) {
            if (pattern.regex.test(content)) {
                // Ignore self (this script)
                if (fullPath.includes('security_audit.ts')) continue;
                issues.push(`[SAST] ${pattern.name} detected in ${file}`);
            }
        }
    }
    return issues;
}

async function runDynamicAnalysis() {
    const issues: string[] = [];
    const dispatcher = new AgentDispatcher();
    await db.init();

    console.log("   🧪 Running SQL Injection tests on Agent Dispatcher...");

    const payloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "UNION SELECT 1, 'admin', 'password' --"
    ];

    for (const payload of payloads) {
        try {
            const msg = {
                id: `SEC-TEST-${Date.now()}`,
                from: "2348000000000",
                to: "BOT",
                type: 'text',
                body: `My name is ${payload}`, // Injecting into a likely parameter
                timestamp: Date.now(),
                source: 'user',
                isGroup: false,
                context: 'PA' // Start with Parent Agent
            };
            
            // We are testing if the system crashes or leaks DB errors
            const routed = await MessageRouter.route(msg as any);
            const response = await dispatcher.dispatch(routed);

            // Check response for SQL errors
            if (response.reply_text && (
                response.reply_text.includes("SQLITE_ERROR") || 
                response.reply_text.includes("syntax error") ||
                response.reply_text.includes("database is locked") 
            )) {
                issues.push(`[DAST] Potential SQL Injection vulnerability detected with payload: ${payload}`);
            }

        } catch (error: any) {
            if (error.message && (
                error.message.includes("SQLITE_ERROR") || 
                error.message.includes("syntax error")
            )) {
                 issues.push(`[DAST] Exception indicates SQL Injection vulnerability: ${error.message}`);
            }
            // Other errors (like routing failures) are expected/safe
        }
    }
    
    return issues;
}

async function runSecurityAudit() {
    console.log("🔒 STARTING SECURITY AUDIT");
    console.log("═".repeat(50));

    // 1. Static Analysis
    console.log("\n1️⃣  Running Static Code Analysis...");
    // We'll scan src/ directory
    const srcDir = path.join(process.cwd(), 'src');
    // Note: readdir with recursive is Node 18+. If older, this might fail, but let's assume modern env.
    // Fallback simple scan of critical directories if recursive fails
    let sastIssues: string[] = [];
    try {
        sastIssues = await runStaticAnalysis(srcDir);
    } catch (e) {
        console.log("   ⚠️ Recursive scan not supported, scanning core dirs manually.");
        sastIssues = [
            ...(await runStaticAnalysis(path.join(srcDir, 'core'))),
            ...(await runStaticAnalysis(path.join(srcDir, 'db'))),
            ...(await runStaticAnalysis(path.join(srcDir, 'services')))
        ];
    }
    
    if (sastIssues.length === 0) console.log("   ✅ No high-risk static patterns found.");
    else sastIssues.forEach(i => console.log(`   ⚠️  ${i}`));

    // 2. Dynamic Analysis
    console.log("\n2️⃣  Running Dynamic Injection Tests...");
    const dastIssues = await runDynamicAnalysis();
    
    if (dastIssues.length === 0) console.log("   ✅ Agent resisted simple SQL injection payloads.");
    else dastIssues.forEach(i => console.log(`   ❌ ${i}`));

    console.log("\n🏁 SECURITY AUDIT COMPLETE");
    console.log("═".repeat(50));
    
    return [...sastIssues, ...dastIssues];
}

runSecurityAudit().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
