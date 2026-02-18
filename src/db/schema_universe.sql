-- Add classes_json and subjects_json columns to schools table for universe definition
-- This migration adds proper columns for storing school universe (classes and subjects)

-- Check if columns exist before adding
ALTER TABLE schools ADD COLUMN classes_json TEXT DEFAULT '[]';
ALTER TABLE schools ADD COLUMN subjects_json TEXT DEFAULT '[]';

-- Add class_level and is_core to subjects table
ALTER TABLE subjects ADD COLUMN class_level TEXT;
ALTER TABLE subjects ADD COLUMN is_core BOOLEAN DEFAULT 1;

-- Update existing schools with default PRIMARY values based on school_type
UPDATE schools SET classes_json = '["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"]' 
WHERE school_type = 'PRIMARY' OR school_type IS NULL;

UPDATE schools SET subjects_json = '["Mathematics", "English Language", "Basic Science", "Social Studies", "Religious Studies", "Physical Education", "Creative Arts", "Home Economics", "Agricultural Science", "Computer Studies", "Verbal Reasoning", "Quantitative Reasoning", "Igbo Language", "French Language"]' 
WHERE school_type = 'PRIMARY' OR school_type IS NULL;

UPDATE schools SET classes_json = '["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"]' 
WHERE school_type = 'SECONDARY';

UPDATE schools SET subjects_json = '["Mathematics", "English Language", "Biology", "Chemistry", "Physics", "Government", "Economics", "Literature in English", "History", "Geography", "Further Mathematics", "Technical Drawing", "Food and Nutrition", "Agricultural Science", "Computer Studies", "Christian Religious Studies", "Islamic Religious Studies", " Civic Education", "Financial Accounting", "Commerce", "French Language"]' 
WHERE school_type = 'SECONDARY';
