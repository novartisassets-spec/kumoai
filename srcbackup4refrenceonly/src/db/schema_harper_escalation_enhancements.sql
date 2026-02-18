-- Harper Escalation Pattern Enhancements
-- Adds fields to support Harper's canonical escalation model
-- Intent-clear gating, instruction injection, and multi-turn dialogue

-- ============================================================================
-- ESCALATIONS TABLE ENHANCEMENTS
-- Add Harper-specific fields for instruction injection and decision tracking
-- ============================================================================

-- NOTE: admin_instruction and admin_decision columns are added in schema_escalation_admin_decision.sql
-- DO NOT add them here to avoid duplicate column errors

-- Add intent_clear column if not exists
-- Flag indicating admin's response was unambiguous and actionable
ALTER TABLE escalations ADD COLUMN intent_clear BOOLEAN DEFAULT 0;

-- Add clarity_score column if not exists
-- Score (0-100) from LLM analysis of admin response clarity
ALTER TABLE escalations ADD COLUMN clarity_score INTEGER DEFAULT 0;

-- ============================================================================
-- ESCALATION_ROUND_LOG TABLE ENHANCEMENTS
-- Track Harper-specific response metadata
-- ============================================================================

-- Add intent_clear column if not exists
ALTER TABLE escalation_round_log ADD COLUMN intent_clear BOOLEAN DEFAULT 0;

-- Add clarity_score column if not exists
ALTER TABLE escalation_round_log ADD COLUMN clarity_score INTEGER DEFAULT 0;

-- Add harper_instruction column if not exists
-- The specific instruction for origin agent to follow
ALTER TABLE escalation_round_log ADD COLUMN harper_instruction TEXT;

-- Add decision_type column if not exists
-- Decision classification: APPROVE, REJECT, MODIFY, REQUEST_INFO, ESCALATE_FURTHER
ALTER TABLE escalation_round_log ADD COLUMN decision_type TEXT;

-- ============================================================================
-- INDEXES FOR NEW HARPER FIELDS
-- ============================================================================

-- Index for finding unresolved escalations by intent_clear status
CREATE INDEX IF NOT EXISTS idx_escalations_intent_clear ON escalations(intent_clear, status);

-- Index for finding escalations awaiting clarification
CREATE INDEX IF NOT EXISTS idx_escalations_pending_clarity ON escalations(clarity_score, escalation_state) WHERE escalation_state = 'AWAITING_CLARIFICATION';

-- Index for round log lookups by intent clarity
CREATE INDEX IF NOT EXISTS idx_round_log_intent_clear ON escalation_round_log(escalation_id, intent_clear);
