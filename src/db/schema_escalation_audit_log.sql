-- Escalation Audit Log
CREATE TABLE IF NOT EXISTS escalation_audit_log (
    id TEXT PRIMARY KEY,
    escalation_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN (
        'ESCALATION_CREATED',
        'ADMIN_NOTIFIED',
        'ADMIN_RESPONSE_RECORDED',
        'DECISION_MADE',
        'ORIGIN_AGENT_RESUMED',
        'ESCALATION_RESOLVED'
    )),
    event_timestamp BIGINT NOT NULL,
    admin_phone TEXT,
    origin_agent TEXT CHECK(origin_agent IN ('PA', 'TA', 'GA')),
    decision_summary TEXT,
    context_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_escalation ON escalation_audit_log(escalation_id);
CREATE INDEX IF NOT EXISTS idx_audit_school ON escalation_audit_log(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON escalation_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON escalation_audit_log(admin_phone);
