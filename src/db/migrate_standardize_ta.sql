-- Migration to standardize TA setup and management tables
-- Fixes discrepancies between repository code and schema definitions

-- 1. Standardize class_student_mapping
-- Check if column recorded_at exists, if not rename created_at or add it
-- SQLite doesn't support RENAME COLUMN in older versions easily, so we add and update if needed
ALTER TABLE class_student_mapping ADD COLUMN recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE class_student_mapping ADD COLUMN unified_id TEXT;

-- 2. Create student_broadsheet table if missing (used for storing actual broadsheet data)
CREATE TABLE IF NOT EXISTS student_broadsheet (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    class_level TEXT NOT NULL,
    term_id TEXT NOT NULL,
    subjects TEXT NOT NULL, -- JSON array
    broadsheet_data TEXT NOT NULL, -- JSON object
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(teacher_id) REFERENCES users(id)
);

-- 3. Update student_attendance_records for manual entries
ALTER TABLE student_attendance_records ADD COLUMN manual_entry INTEGER DEFAULT 0;
ALTER TABLE student_attendance_records ADD COLUMN manual_notes TEXT;

-- 4. Standardize student_marks_indexed
-- Add specific CA columns and manual entry fields
ALTER TABLE student_marks_indexed ADD COLUMN ca1 DECIMAL(5,2) DEFAULT 0;
ALTER TABLE student_marks_indexed ADD COLUMN ca2 DECIMAL(5,2) DEFAULT 0;
ALTER TABLE student_marks_indexed ADD COLUMN midterm DECIMAL(5,2) DEFAULT 0;
ALTER TABLE student_marks_indexed ADD COLUMN exam DECIMAL(5,2) DEFAULT 0;
ALTER TABLE student_marks_indexed ADD COLUMN manual_entry INTEGER DEFAULT 0;
ALTER TABLE student_marks_indexed ADD COLUMN manual_notes TEXT;
ALTER TABLE student_marks_indexed ADD COLUMN recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 5. Ensure student_info has consistent naming if needed
-- (It already has date_added, which is fine)

-- 6. Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_class_student_mapping_unified ON class_student_mapping(unified_id);
CREATE INDEX IF NOT EXISTS idx_student_broadsheet_teacher ON student_broadsheet(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_broadsheet_class ON student_broadsheet(class_level);
