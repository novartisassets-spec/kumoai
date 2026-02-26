-- WhatsApp Multi-Connection Schema - Simplified for PostgreSQL
-- Add columns using ALTER TABLE (PostgreSQL ignores if column exists)

ALTER TABLE schools ADD COLUMN IF NOT EXISTS connected_whatsapp_jid TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS whatsapp_connection_status TEXT DEFAULT 'disconnected';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS qr_refresh_count INTEGER DEFAULT 0;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS qr_refresh_locked_until TIMESTAMP;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS last_connection_at TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_schools_connection_status ON schools(whatsapp_connection_status);
CREATE INDEX IF NOT EXISTS idx_schools_admin_phone ON schools(admin_phone);
