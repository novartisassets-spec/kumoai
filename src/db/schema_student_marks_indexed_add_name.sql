-- Migration: Add student_name column to student_marks_indexed
-- Run this on the remote database to fix missing column

ALTER TABLE student_marks_indexed ADD COLUMN IF NOT EXISTS student_name TEXT;
