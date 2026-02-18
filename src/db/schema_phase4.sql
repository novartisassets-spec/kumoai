-- Phase 4 Extensions

-- Update term_results to support 'released' status
-- SQLite doesn't support modifying check constraints easily, so we usually recreate or just ignore strict enum in schema if already created.
-- However, we can trust the application layer for the status transition.
-- We will add a trigger or just ensure code handles it.
-- Actually, let's just create an index or a specific log table for overrides if needed.
-- For strictness, let's rely on code enforcement for the status 'released'.

-- Audit Log Extension (if specific indices needed)
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_phone);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(target_resource);
