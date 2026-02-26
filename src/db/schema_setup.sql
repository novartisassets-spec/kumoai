-- Setup State Tracking
CREATE TABLE IF NOT EXISTS setup_state (
    school_id TEXT PRIMARY KEY,
    current_step TEXT NOT NULL,
    completed_steps TEXT DEFAULT '[]',
    pending_steps TEXT DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    config_draft TEXT DEFAULT '{}',
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add setup_status to schools if not exists
-- NOTE: This column is already added in schema_amendments.sql
-- ALTER TABLE schools ADD COLUMN setup_status TEXT DEFAULT 'PENDING_SETUP';
-- Commented out to prevent duplicate column error
