-- ========================================
-- Schema Amendment: Add school_type column
-- ========================================
-- Adds support for Primary vs Secondary school differentiation
-- Allows KUMO to route to correct teacher agent based on school type

ALTER TABLE schools ADD COLUMN school_type TEXT DEFAULT 'SECONDARY' CHECK(school_type IN ('PRIMARY', 'SECONDARY'));

-- Create index for faster school type lookups
CREATE INDEX IF NOT EXISTS idx_schools_type ON schools(school_type);

-- Create index for combined schoolId + school_type lookups (common dispatch pattern)
CREATE INDEX IF NOT EXISTS idx_schools_id_type ON schools(id, school_type);
