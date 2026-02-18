-- Phase 6: Result Authority Flow
-- Adding status tracking to indexed marks for the Admin release flow
-- NOTE: status column already exists in schema_student_marks_indexed.sql with ('DRAFT', 'CONFIRMED', 'RELEASED', 'ARCHIVED')
-- If you need to update the constraint, modify schema_student_marks_indexed.sql instead

-- ALTER TABLE student_marks_indexed ADD COLUMN status TEXT CHECK(status IN ('PENDING', 'CONFIRMED', 'RELEASED')) DEFAULT 'CONFIRMED';
-- Commented out to prevent duplicate column error
