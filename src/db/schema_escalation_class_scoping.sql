-- Migration: Add Class-Scoped Escalation Fields
-- Date: January 17, 2026
-- Purpose: Enable class-level tracking of escalations for TA workflows
-- Backwards Compatible: All fields are optional (NULL allowed)

-- Add class scoping columns to escalations table
ALTER TABLE escalations ADD COLUMN class_level TEXT DEFAULT NULL;
ALTER TABLE escalations ADD COLUMN subject TEXT DEFAULT NULL;
ALTER TABLE escalations ADD COLUMN term_id TEXT DEFAULT NULL;
ALTER TABLE escalations ADD COLUMN escalation_subtype TEXT DEFAULT NULL;
ALTER TABLE escalations ADD COLUMN associated_pdf_path TEXT DEFAULT NULL;
ALTER TABLE escalations ADD COLUMN requires_pdf_review BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_escalations_class_term 
ON escalations(school_id, class_level, term_id, escalation_state);

CREATE INDEX IF NOT EXISTS idx_escalations_subject 
ON escalations(school_id, subject, escalation_state);

CREATE INDEX IF NOT EXISTS idx_escalations_pdf_review 
ON escalations(school_id, requires_pdf_review, escalation_state);
