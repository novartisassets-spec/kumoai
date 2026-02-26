-- WhatsApp Sessions Storage Schema
-- Stores WhatsApp authentication state in the database as compressed binary blob

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id TEXT UNIQUE NOT NULL,
    auth_data TEXT,
    phone_number TEXT,
    connected_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_school_id ON whatsapp_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_is_active ON whatsapp_sessions(is_active);

-- WhatsApp QR History
CREATE TABLE IF NOT EXISTS whatsapp_qr_history (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    qr_data TEXT,
    connection_status TEXT DEFAULT 'pending',
    qr_generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id)
);

CREATE INDEX IF NOT EXISTS idx_qr_history_school ON whatsapp_qr_history(school_id, qr_generated_at DESC);
