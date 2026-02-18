# KUMO Technical Documentation

## System Overview

KUMO is built on a multi-agent architecture with a central dispatcher routing messages to specialized agents. This document covers the technical implementation, database schema, and deployment details.

---

## Architecture

### Multi-Agent System

```
┌─────────────────┐
│ WhatsApp API    │
└────────┬────────┘
         │
┌────────▼────────┐
│ Message Router  │ → Identifies sender, determines context
└────────┬────────┘
         │
┌────────▼────────┐
│  Dispatcher     │ → Routes to appropriate agent
└──┬──┬──┬──┬─────┘
   │  │  │  │
   ▼  ▼  ▼  ▼
┌──┴──┴──┴──┴─────┐
│   Agent Pool    │
│ SA TA GA PA    │
└────────┬────────┘
         │
┌────────▼────────┐
│    SQLite       │
└─────────────────┘
```

### Agents

#### SA (School Admin Agent)
- **Context**: 'SA'
- **Purpose**: School setup, configuration, user management
- **Entry Points**: Initial setup, escalation handling
- **Key Actions**: Create school, configure grading, manage users

#### TA (Teacher Agent)
- **Context**: 'TA' or 'PrimaryTA'
- **Purpose**: Mark entry, attendance, class management
- **Entry Points**: Teacher messages, escalation resolutions
- **Key Actions**: Submit marks, confirm submissions, track attendance

#### GA (Group Agent)
- **Context**: 'GA'
- **Purpose**: Multi-school group coordination
- **Entry Points**: Group-level queries, cross-school analytics

#### PA (Parent Agent)
- **Context**: 'PA'
- **Purpose**: Parent queries, report access, communication
- **Entry Points**: Parent messages with access tokens

---

## Database Schema

### Core Tables

#### schools
```sql
CREATE TABLE schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    admin_phone TEXT NOT NULL,
    school_type TEXT CHECK(school_type IN ('PRIMARY', 'SECONDARY', 'BOTH')),
    grading_config TEXT DEFAULT '{}',
    setup_status TEXT DEFAULT 'PENDING_SETUP',
    active_term TEXT DEFAULT 'current',
    whatsapp_group_jid TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### users
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'teacher', 'parent')),
    name TEXT,
    school_id TEXT NOT NULL,
    assigned_class TEXT,
    school_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    UNIQUE(phone, school_id)
);
```

#### student_marks_indexed
```sql
CREATE TABLE student_marks_indexed (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    class_level TEXT NOT NULL,
    subject TEXT NOT NULL,
    term_id TEXT NOT NULL,
    marks_json TEXT DEFAULT '{}',
    total_score DECIMAL(5,2) DEFAULT 0,
    confirmed_by_teacher BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'CONFIRMED', 'RELEASED', 'ARCHIVED')),
    indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    UNIQUE(school_id, student_id, subject, term_id)
);
```

#### escalations
```sql
CREATE TABLE escalations (
    id TEXT PRIMARY KEY,
    origin_agent TEXT NOT NULL CHECK(origin_agent IN ('PA', 'TA', 'GA')),
    escalation_type TEXT NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    school_id TEXT NOT NULL,
    from_phone TEXT NOT NULL,
    session_id TEXT NOT NULL,
    pause_message_id TEXT NOT NULL,
    escalation_state TEXT DEFAULT 'PAUSED',
    reason TEXT NOT NULL,
    what_agent_needed TEXT,
    context TEXT DEFAULT '{}',
    conversation_summary TEXT,
    status TEXT DEFAULT 'ESCALATED',
    admin_decision TEXT,
    admin_instruction TEXT,
    intent_clear BOOLEAN DEFAULT 0,
    timestamp BIGINT NOT NULL,
    FOREIGN KEY(school_id) REFERENCES schools(id)
);
```

#### terminal_reports
```sql
CREATE TABLE terminal_reports (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    class_level TEXT NOT NULL,
    term_id TEXT NOT NULL,
    total_aggregate REAL,
    average_score REAL,
    teacher_remarks TEXT,
    principal_remarks TEXT,
    status TEXT DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'RELEASED', 'PUBLISHED', 'ARCHIVED')),
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, student_id, term_id)
);
```

---

## Escalation Flow

### Creation

Escalations are created in two places for robustness:

1. **BaseTeacherAgent** (Primary): Creates escalation immediately when condition met
   ```typescript
   const escalationId = await EscalationServiceV2.pauseForEscalation({
       origin_agent: 'TA',
       escalation_type: 'CLASS_RESULT_RELEASE',
       // ...
   });
   ```

2. **Dispatcher** (Fallback): Creates escalation if not already created by agent
   ```typescript
   if (!escalationPayload.escalation_id) {
       escalationId = await EscalationServiceV2.pauseForEscalation({...});
   }
   ```

### Resolution

```
Admin responds → SA Agent processes → 
EscalationServiceV2.recordAuthorityResponse() → 
EscalationResumptionHandler.handleResolution() → 
Origin Agent resumes → User receives final response
```

### States

- `PAUSED`: Initial state
- `AWAITING_CLARIFICATION`: Admin asked for more info
- `IN_AUTHORITY`: With admin for decision
- `RESOLVED`: Decision made
- `RESUMED`: Origin agent has resumed
- `FAILED`: Could not be resolved

---

## Grading System

### Configuration

Schools define their grading in `schools.grading_config`:

```json
{
    "pillars": [
        {"id": "ca1", "name": "CA 1", "max_score": 20},
        {"id": "ca2", "name": "CA 2", "max_score": 20},
        {"id": "exam", "name": "Exam", "max_score": 60}
    ],
    "total_max": 100,
    "rank_students": true
}
```

### Calculation

Total calculated dynamically based on configured pillars:
```typescript
const total = pillars.reduce((sum, pillar) => {
    return sum + (marks[pillar.id] || 0);
}, 0);
```

### Validation

Each mark validated against max score:
```typescript
if (score > pillar.max_score) {
    throw new Error(`${pillar.name} cannot exceed ${pillar.max_score}`);
}
```

---

## Vision Processing

### Flow

1. **Classification**: Gemini Vision identifies document type
2. **Extraction**: Specialized prompt extracts structured data
3. **Resolution**: Student names matched to database
4. **Validation**: Scores validated against grading config

### Document Types

- `marks_sheet`: Mark sheets with student scores
- `attendance`: Attendance registers
- `registration`: Student registration forms

### Example Prompt (Marks)

```
Extract marks from this assessment sheet.
For each student, extract:
- Student name
- scores.ca1: Score for "CA 1" (Limit: 20 points)
- scores.ca2: Score for "CA 2" (Limit: 20 points)
- scores.exam: Score for "Exam" (Limit: 60 points)

Return JSON format:
{
    "doc_type": "marks_sheet",
    "subject": "Mathematics",
    "class_level": "SSS 2",
    "marks": [
        {"student_name": "...", "scores": {"ca1": 18, "ca2": 19, "exam": 55}}
    ]
}
```

---

## Report Generation

### Process

1. **Fetch Confirmed Marks**: Query `student_marks_indexed` where `confirmed_by_teacher = 1`
2. **Calculate Aggregates**: Sum totals, compute averages
3. **Determine Positions**: Rank students within class
4. **Generate Remarks**: LLM synthesizes personalized comments
5. **Create PDF**: PDFKit generates formatted report cards
6. **Store**: Save to `terminal_reports` and file system

### PDF Templates

- **Batch Report Cards**: Individual student reports
- **Broadsheet**: Class-wide summary table
- **Attendance Report**: Daily/weekly attendance summary

---

## Multi-Tenancy

### School Isolation

Every query includes `school_id` filter:

```sql
SELECT * FROM student_marks_indexed 
WHERE school_id = ? AND class_level = ? AND term_id = ?
```

### Routing

1. **Phone-based**: Messages from known phones routed to their school
2. **Token-based**: Parent/teacher tokens include school_id
3. **Group-based**: WhatsApp group JIDs mapped to schools

### Security

- No cross-school data access
- School ID validated at every layer
- Admin escalation scoped to school
- PDF storage organized by school

---

## Deployment

### Requirements

- Node.js 18+
- SQLite 3
- WhatsApp Business API credentials
- LLM API keys (Groq/Google Gemini)

### Environment Variables

```env
NODE_ENV=production
DB_PATH=./kumo.db
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AI...
WHATSAPP_SESSION_NAME=kumo_session
```

### Startup

```bash
# Install dependencies
npm install

# Initialize database
npm run db:init

# Build TypeScript
npm run build

# Start application
npm start
```

### Database Initialization

On first run, KUMO executes 22 schema files:
1. Base schema (schools, users, students)
2. Phase 3 (subjects, marks, results)
3. Phase 4 (indexes, extensions)
4. Amendments (parent access, groups)
5. Temporal (teacher access)
6. Setup (setup state tracking)
7. TA Setup (teacher workflows)
8. Memory (conversation history)
9. Teacher Confirmation (mark submissions)
10. Student Marks Indexed (final marks)
11. PDF Storage (document management)
12. Sessions (user sessions)
13. File Storage (attachments)
14. PDF Audit (tracking)
15. Escalation System (core escalation)
16. Escalation Audit (audit trail)
17. Escalation Admin Decision (decisions)
18. Harper Enhancements (intent scoring)
19. Primary/Secondary (school types)
20. User School Type (teacher types)
21. Mark Submission Workflow (workflows)
22. Parent Flow (parent access)

---

## API Endpoints (Internal)

### Health Check
```
GET /health
Response: { status: 'ok', version: '1.0.0' }
```

### School Stats
```
GET /api/schools/:id/stats
Response: {
    total_students: 150,
    total_teachers: 12,
    subjects_count: 15,
    escalations_pending: 2
}
```

### Generate Reports
```
POST /api/reports/generate
Body: {
    school_id: '...',
    class_level: 'SSS 2',
    term_id: '2024-first'
}
```

---

## Monitoring

### Key Metrics

1. **Message Processing Time**: Target < 2 seconds
2. **Escalation Resolution Time**: Target < 1 hour
3. **Vision Accuracy**: Target > 95%
4. **Database Query Time**: Target < 100ms
5. **Error Rate**: Target < 0.5%

### Logging

Uses Pino for structured logging:
```typescript
logger.info({ schoolId, userId }, 'Mark confirmed');
logger.error({ error, escalationId }, 'Escalation failed');
```

### Alerts

Critical alerts for:
- Escalation creation failures
- Database connection errors
- LLM API failures
- WhatsApp disconnection

---

## Performance Optimization

### Database

- **Indexes**: All lookup columns indexed
- **Connection Pooling**: SQLite serialized mode
- **Query Optimization**: Specific SELECTs, not SELECT *

### Caching

- **School Config**: Cached in memory
- **Vision Prompts**: Pre-compiled templates
- **Student Lists**: Cached per class

### Async Processing

- **PDF Generation**: Non-blocking
- **Escalation Notifications**: setImmediate()
- **Audit Logging**: Fire-and-forget

---

## Security

### Access Control

- **Tokens**: Time-limited, school-scoped
- **Roles**: admin, teacher, parent
- **Permissions**: Action-based authorization

### Data Protection

- **Encryption**: SQLite encryption at rest
- **Tokens**: Hashed in database
- **PDFs**: Access-controlled by school

### Input Validation

- **SQL Injection**: Parameterized queries
- **XSS**: Output encoding
- **File Uploads**: Type validation, size limits

---

## Testing

### Test Database

Use separate test database:
```typescript
const testDbPath = `kumo_test_${Date.now()}.db`;
Database.reconnect(testDbPath);
```

### Mocking

Mock external services:
```typescript
(visionService as any).analyzeImage = async () => mockResponse;
messenger.registerHandler(async (msg) => captureMessage(msg));
```

### E2E Tests

Full flow testing:
1. School setup
2. Teacher onboarding
3. Mark submission
4. Escalation
5. Report generation
6. Parent access

---

## Troubleshooting

### Common Issues

**Database locked:**
- Check for long-running transactions
- Verify connection pooling

**WhatsApp not connecting:**
- Check session file exists
- Verify phone number registered
- Review Baileys logs

**LLM API errors:**
- Verify API keys
- Check rate limits
- Review prompt formatting

**Escalations not creating:**
- Check Dispatcher logs
- Verify escalation payload structure
- Review database permissions

---

## Development

### Adding a New Agent

1. Create agent class in `src/agents/`
2. Implement `handle()` method
3. Register in Dispatcher
4. Add routing logic
5. Create database tables
6. Add tests

### Adding a New Feature

1. Define database schema
2. Create migration file
3. Implement business logic
4. Update agent handlers
5. Add API endpoints
6. Update documentation
7. Write tests

---

## Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit pull request

---

## License

MIT License

---

**For detailed implementation, see inline code comments in the `/src` directory.**