-- Subscription and Payment Schema
-- Paystack Virtual Account Payment Integration

-- Add subscription columns to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'Free';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'NGN';

-- Subscription payments table
CREATE TABLE IF NOT EXISTS subscription_payments (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NGN',
    plan_name TEXT NOT NULL,
    term_months INTEGER DEFAULT 3,
    transaction_ref TEXT UNIQUE,
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'success', 'failed', 'abandoned')),
    payment_method TEXT,
    bank_name TEXT,
    account_number TEXT,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_payments_school ON subscription_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_ref ON subscription_payments(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(payment_status);

-- Currency configuration table
CREATE TABLE IF NOT EXISTS currency_config (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default currencies
INSERT INTO currency_config (code, name, symbol, exchange_rate, is_active) VALUES
    ('NGN', 'Nigerian Naira', '₦', 1, true),
    ('USD', 'US Dollar', '$', 1, true),
    ('KES', 'Kenyan Shilling', 'KSh', 1, true),
    ('GHS', 'Ghanaian Cedi', '₵', 1, true),
    ('ZAR', 'South African Rand', 'R', 1, true),
    ('UGX', 'Ugandan Shilling', 'USh', 1, true),
    ('XOF', 'West African CFA', 'CFA', 1, true)
ON CONFLICT (code) DO NOTHING;
