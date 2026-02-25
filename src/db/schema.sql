-- PostgreSQL version of base schema
-- Converted from SQLite to PostgreSQL

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    admin_phone TEXT NOT NULL,
    whatsapp_number TEXT,
    connected_whatsapp_jid TEXT,
    config_json TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'teacher', 'parent', 'primary_teacher', 'group_admin', 'student')) NOT NULL,
    name TEXT,
    school_id TEXT NOT NULL,
    password_hash TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    UNIQUE(phone, school_id)
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    class_level TEXT NOT NULL,
    parent_access_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id)
);

-- Student guardians table
CREATE TABLE IF NOT EXISTS student_guardians (
    student_id TEXT NOT NULL,
    guardian_phone TEXT NOT NULL,
    relationship TEXT,
    PRIMARY KEY(student_id, guardian_phone),
    FOREIGN KEY(student_id) REFERENCES students(student_id)
);

-- Teacher access tokens table
CREATE TABLE IF NOT EXISTS teacher_access_tokens (
    token TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id),
    FOREIGN KEY(school_id) REFERENCES schools(id)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    payer_phone TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    currency TEXT DEFAULT 'NGN',
    status TEXT CHECK(status IN ('pending_review', 'confirmed', 'rejected')) NOT NULL,
    pop_image_path TEXT NOT NULL,
    reviewed_by TEXT,
    review_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(student_id) REFERENCES students(student_id),
    FOREIGN KEY(reviewed_by) REFERENCES users(id)
);

-- Academic drafts table
CREATE TABLE IF NOT EXISTS academic_drafts (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    class_level TEXT NOT NULL,
    raw_image_path TEXT NOT NULL,
    ocr_data TEXT NOT NULL,
    status TEXT CHECK(status IN ('draft', 'teacher_confirmed', 'admin_locked')) NOT NULL,
    locked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(teacher_id) REFERENCES users(id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT,
    from_phone TEXT NOT NULL,
    type TEXT NOT NULL,
    body TEXT,
    media_path TEXT,
    context TEXT,
    timestamp BIGINT NOT NULL,
    action_performed TEXT,
    action_status TEXT,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Academic terms table
CREATE TABLE IF NOT EXISTS academic_terms (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    term_name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actor_phone TEXT NOT NULL,
    action TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    details TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_school_phone ON users(school_id, phone);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_id, class_level);
CREATE INDEX IF NOT EXISTS idx_messages_school_phone ON messages(school_id, from_phone);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
