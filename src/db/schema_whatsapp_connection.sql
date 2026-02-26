-- WhatsApp Multi-Connection Schema - Safe for PostgreSQL
-- Add columns if they don't exist using DO blocks

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'connected_whatsapp_jid') THEN
        ALTER TABLE schools ADD COLUMN connected_whatsapp_jid TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'whatsapp_connection_status') THEN
        ALTER TABLE schools ADD COLUMN whatsapp_connection_status TEXT DEFAULT 'disconnected';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'qr_refresh_count') THEN
        ALTER TABLE schools ADD COLUMN qr_refresh_count INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'qr_refresh_locked_until') THEN
        ALTER TABLE schools ADD COLUMN qr_refresh_locked_until TIMESTAMP;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'last_connection_at') THEN
        ALTER TABLE schools ADD COLUMN last_connection_at TIMESTAMP;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_schools_connection_status ON schools(whatsapp_connection_status);
CREATE INDEX IF NOT EXISTS idx_schools_admin_phone ON schools(admin_phone);
