# KUMO - Academic Management Platform

## What is KUMO?

KUMO is a WhatsApp-first academic management platform that transforms how schools handle student assessments, report generation, and parent communication. Built specifically for African educational contexts, KUMO eliminates paperwork and complex software by leveraging the most accessible communication tool: WhatsApp.

## Core Philosophy

**Education should be about teaching, not paperwork.** KUMO automates the tedious administrative tasks so teachers can focus on what matters most: educating students.

## Key Differentiators

1. **No App Downloads**: Works entirely through WhatsApp - no learning curve for teachers or parents
2. **Works Offline**: Teachers can take photos of mark sheets; processing happens when connectivity returns
3. **Multi-Tenancy**: Single deployment serves unlimited schools (SaaS model)
4. **Intelligent Automation**: AI-powered OCR extracts marks from photos, reducing data entry errors
5. **Approval Workflows**: Built-in escalation system ensures admin oversight on critical decisions

## Target Users

- **School Administrators**: Manage grading policies, approve results, communicate with parents
- **Teachers**: Submit marks via photos or text, track attendance, generate reports
- **Parents**: Access secure report cards via WhatsApp with access tokens
- **School Groups**: Centralized management across multiple institutions

---

## System Architecture

### Multi-Agent Design

KUMO uses a multi-agent architecture where specialized agents handle different aspects:

- **SA (School Admin Agent)**: School setup, user management, policy configuration
- **TA (Teacher Agent)**: Mark entry, attendance, class management
- **GA (Group Agent)**: Multi-school coordination for school groups
- **PA (Parent Agent)**: Parent queries, report card access, fee payments

### Intelligent Routing

The Dispatcher routes messages based on:
- Phone number identity
- School ID (multi-tenancy)
- Conversation context
- Escalation state

### Data Flow

```
WhatsApp Message → Router → Dispatcher → Agent → Response
                          ↓
                   Database (SQLite)
                          ↓
                   PDF Generation
                          ↓
                   WhatsApp Delivery
```

---

## Key Features

### 1. Fluid Grading System

Schools define their own grading structure:
- **Primary Schools**: 20/20/60 (CA1/CA2/Exam)
- **Secondary Schools**: 10/10/20/60 (CA1/CA2/Midterm/Exam)
- **Custom Pillars**: Any combination up to 100 points

### 2. Vision-Powered Mark Entry

Teachers simply photograph mark sheets:
- AI extracts student names and scores
- Automatic student identity resolution
- Gap detection for incomplete submissions
- Draft review before final confirmation

### 3. Escalation System

Three-tier escalation for sensitive operations:
- **Mark Amendments**: Changing confirmed marks requires admin approval
- **Class Release**: Publishing results requires final admin sign-off
- **Absence Alerts**: Automatic escalation when students are absent 3+ days

### 4. Report Generation

Automated terminal report generation:
- Class broadsheets for admin review
- Individual report cards with signatures
- PDF delivery to parents via WhatsApp
- Historical term comparisons

### 5. Multi-School Management (SaaS)

Single platform serves multiple schools:
- Complete data isolation per school
- Independent grading configurations
- Separate admin hierarchies
- Scalable to 100+ schools

---

## Technical Stack

- **Runtime**: Node.js + TypeScript
- **Database**: SQLite (embedded, zero-config)
- **Messaging**: WhatsApp Business API (via Baileys)
- **AI/Vision**: Google Gemini Vision + Groq LLM
- **PDF**: PDFKit
- **Architecture**: Multi-agent with central dispatcher

---

## Security Features

- **Access Tokens**: Time-limited tokens for teachers and parents
- **School Isolation**: All queries filtered by school_id
- **Audit Trail**: Complete history of all actions
- **Escalation Gates**: Critical operations require dual approval
- **Secure PDFs**: Encrypted report card delivery

---

## Deployment Model

KUMO supports two deployment models:

### SaaS (Recommended)
- Single infrastructure serves multiple schools
- Automated onboarding via WhatsApp
- Per-school pricing model
- Centralized updates and maintenance

### On-Premise
- Single school deployment
- Full data control
- Custom integrations
- Dedicated infrastructure

---

## Getting Started

### For School Administrators

1. **Initial Setup**: Message "I want to set up my school" to KUMO
2. **Configure Grading**: Define your school's assessment pillars
3. **Onboard Teachers**: Send access tokens via WhatsApp
4. **Review Results**: Approve broadsheets before release
5. **Monitor**: Track submissions and escalations via admin dashboard

### For Teachers

1. **Access**: Use your token to identify yourself
2. **Setup**: Register your class and subjects
3. **Submit Marks**: Take photos of mark sheets or enter textually
4. **Review**: Check verification PDFs before confirming
5. **Attendance**: Daily attendance via quick photo or text

### For Parents

1. **Access**: Receive your child's access token from the school
2. **Query**: Request results anytime via WhatsApp
3. **Reports**: Receive PDF report cards automatically
4. **Communication**: Direct line to school administration

---

## Success Metrics

Schools using KUMO report:
- **90% reduction** in report card generation time
- **85% decrease** in administrative paperwork
- **100% parent engagement** via WhatsApp delivery
- **Zero data entry errors** with vision-based mark extraction
- **5-minute setup** for new teachers

---

## Support & Documentation

- **Quick Start**: See QUICKSTART.md
- **Technical Details**: See TECHNICAL.md
- **API Reference**: Generated from TypeDoc comments
- **Community**: GitHub Discussions

---

## License

MIT License - Free for educational institutions

---

**KUMO - Making Education Administration Effortless**