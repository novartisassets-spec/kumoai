-- Add school_type column to users table for per-teacher routing (PRIMARY vs SECONDARY)
-- Required for BOTH schools to route each teacher to correct agent

ALTER TABLE users ADD COLUMN school_type TEXT DEFAULT NULL;

-- Create index for faster teacher lookups by school_type in dispatcher
CREATE INDEX IF NOT EXISTS idx_users_schooltype ON users(school_id, school_type) WHERE school_type IS NOT NULL;
