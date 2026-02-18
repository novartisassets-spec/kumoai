-- Performance Optimization Indexes
-- Phase 4 Performance Improvements

-- Critical indexes for frequent lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_parent_access ON students(parent_access_code);

CREATE INDEX IF NOT EXISTS idx_student_guardians_phone ON student_guardians(guardian_phone);
CREATE INDEX IF NOT EXISTS idx_student_guardians_student ON student_guardians(student_id);

CREATE INDEX IF NOT EXISTS idx_transactions_school_id ON transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payer_phone ON transactions(payer_phone);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_student_id ON transactions(student_id);

CREATE INDEX IF NOT EXISTS idx_academic_drafts_school_id ON academic_drafts(school_id);
CREATE INDEX IF NOT EXISTS idx_academic_drafts_teacher_id ON academic_drafts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_academic_drafts_status ON academic_drafts(status);

CREATE INDEX IF NOT EXISTS idx_term_results_school_id ON term_results(school_id);
CREATE INDEX IF NOT EXISTS idx_term_results_student_id ON term_results(student_id);
CREATE INDEX IF NOT EXISTS idx_term_results_term_class ON term_results(term_id, class_level);
CREATE INDEX IF NOT EXISTS idx_term_results_status ON term_results(status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_phone);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(target_resource);

CREATE INDEX IF NOT EXISTS idx_teacher_access_tokens_school_id ON teacher_access_tokens(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_access_tokens_expired ON teacher_access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_teacher_access_tokens_revoked ON teacher_access_tokens(is_revoked);

CREATE INDEX IF NOT EXISTS idx_amendment_requests_school_status ON amendment_requests(school_id, status);
CREATE INDEX IF NOT EXISTS idx_amendment_requests_created_at ON amendment_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_moderation_logs_timestamp ON moderation_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_school_payer ON transactions(school_id, payer_phone);
CREATE INDEX IF NOT EXISTS idx_term_results_student_term ON term_results(student_id, term_id);
CREATE INDEX IF NOT EXISTS idx_academic_drafts_teacher_term ON academic_drafts(teacher_id, term_id);
