-- Holistic Grading & African Terminal Report Support - Amendments

-- Add comments to term_results
ALTER TABLE term_results ADD COLUMN teacher_comment TEXT;
ALTER TABLE term_results ADD COLUMN principal_comment TEXT;

-- Attendance stats in term_results
ALTER TABLE term_results ADD COLUMN days_open INTEGER DEFAULT 0;
ALTER TABLE term_results ADD COLUMN days_present INTEGER DEFAULT 0;

-- Grading variants (for primary schools)
CREATE TABLE IF NOT EXISTS grading_variants (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    variant_name TEXT NOT NULL, -- 'ca1_ca2_exam' or 'ca_exam'
    ca1_max INTEGER DEFAULT 20,
    ca2_max INTEGER DEFAULT 20,
    exam_max INTEGER DEFAULT 60,
    total_max INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY(school_id) REFERENCES schools(id)
);
