-- Migration: Create exec_sql function for Supabase
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create function to execute raw SQL
CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT, params TEXT[] DEFAULT '{}')
RETURNS TABLE(result JSON) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY EXECUTE sql_text USING params;
END;
$$;

-- Alternative simpler version that just runs the SQL without returning results
CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE sql_text;
END;
$$;

-- Test it
SELECT exec_sql('SELECT 1 as test');
