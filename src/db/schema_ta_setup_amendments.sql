-- TA Setup Amendments to ensure required columns exist
-- These are idempotent and will run on every startup

DO $$ 
BEGIN 
    -- 1. Check and add 'subjects' column to ta_setup_state
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ta_setup_state' AND column_name='subjects') THEN
        ALTER TABLE ta_setup_state ADD COLUMN subjects TEXT DEFAULT '[]';
    END IF;

    -- 2. Check and add 'workload_json' column to ta_setup_state
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ta_setup_state' AND column_name='workload_json') THEN
        ALTER TABLE ta_setup_state ADD COLUMN workload_json TEXT DEFAULT '{}';
    END IF;

    -- 3. Check and add 'progress_percentage' column to ta_setup_state
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ta_setup_state' AND column_name='progress_percentage') THEN
        ALTER TABLE ta_setup_state ADD COLUMN progress_percentage INTEGER DEFAULT 0;
    END IF;

    -- 4. Check and add 'completed_at' column to ta_setup_state
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ta_setup_state' AND column_name='completed_at') THEN
        ALTER TABLE ta_setup_state ADD COLUMN completed_at TIMESTAMP DEFAULT NULL;
    END IF;

    -- 5. Check and add 'assigned_class' column to ta_setup_state
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ta_setup_state' AND column_name='assigned_class') THEN
        ALTER TABLE ta_setup_state ADD COLUMN assigned_class TEXT;
    END IF;

    -- 6. Check and add 'current_step' column to ta_setup_state
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ta_setup_state' AND column_name='current_step') THEN
        ALTER TABLE ta_setup_state ADD COLUMN current_step TEXT;
    END IF;

    -- 7. Check and add 'completed_steps' column to ta_setup_state
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ta_setup_state' AND column_name='completed_steps') THEN
        ALTER TABLE ta_setup_state ADD COLUMN completed_steps TEXT DEFAULT '[]';
    END IF;

    -- 8. Check and add 'config_draft' column to ta_setup_state
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ta_setup_state' AND column_name='config_draft') THEN
        ALTER TABLE ta_setup_state ADD COLUMN config_draft TEXT DEFAULT '{}';
    END IF;

    -- 9. Check and add 'extracted_students' column to ta_setup_state
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ta_setup_state' AND column_name='extracted_students') THEN
        ALTER TABLE ta_setup_state ADD COLUMN extracted_students TEXT DEFAULT '[]';
    END IF;

    -- 10. Ensure is_active is BOOLEAN for PostgreSQL compatibility with modern queries
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ta_setup_state' AND column_name='is_active' AND data_type='integer') THEN
        ALTER TABLE ta_setup_state ALTER COLUMN is_active TYPE BOOLEAN USING (is_active = 1);
        ALTER TABLE ta_setup_state ALTER COLUMN is_active SET DEFAULT true;
    END IF;

    -- 11. Ensure other boolean columns are also correct type if they exist as integers
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='student_attendance_records' AND column_name='present' AND data_type='integer') THEN
        ALTER TABLE student_attendance_records ALTER COLUMN present TYPE BOOLEAN USING (present = 1);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='broadsheet_assignments' AND column_name='is_active' AND data_type='integer') THEN
        ALTER TABLE broadsheet_assignments ALTER COLUMN is_active TYPE BOOLEAN USING (is_active = 1);
        ALTER TABLE broadsheet_assignments ALTER COLUMN is_active SET DEFAULT true;
    END IF;

END $$;
