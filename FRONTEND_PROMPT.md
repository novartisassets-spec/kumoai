# KUMO Frontend Generation Prompt

## Project Overview

**KUMO** is a WhatsApp-first academic management platform for African schools that automates student assessments, report generation, and parent communication. While the core system operates via WhatsApp, we need a **web-based admin dashboard and landing pages** for enhanced visibility, reporting, and management.

**Core Philosophy**: Education should be about teaching, not paperwork. KUMO eliminates tedious administrative tasks so teachers can focus on educating students.

---

## System Architecture

### Multi-Agent Backend
The backend uses specialized AI agents:
- **SA (School Admin Agent)**: School setup, user management, policy configuration
- **TA (Teacher Agent)**: Mark entry, attendance, class management  
- **GA (Group Agent)**: Multi-school coordination for school groups
- **PA (Parent Agent)**: Parent queries, report card access

### Key Differentiators
1. **No App Downloads**: Works through WhatsApp - no learning curve
2. **Vision-Powered**: Teachers photograph mark sheets; AI extracts data
3. **Multi-Tenancy**: Single deployment serves unlimited schools (SaaS model)
4. **Approval Workflows**: Built-in escalation system for sensitive operations
5. **Offline-First**: Photos taken offline, processed when connectivity returns

---

## User Roles & Personas

### 1. School Administrators
**Needs:**
- School setup and configuration dashboard
- User management (teachers, students, parents)
- Grading policy configuration (custom pillars)
- Escalation management and approval workflows
- Report generation oversight (broadsheets, terminal reports)
- Analytics and performance monitoring
- Multi-school management (if group admin)

**Permissions:**
- Full access to school data
- Approve/reject escalations
- Configure grading systems
- Generate and release reports
- Manage access tokens for teachers and parents

### 2. Teachers
**Needs:**
- Personal dashboard with assigned classes and subjects
- Mark submission interface (text and image upload)
- Draft review and confirmation workflows
- Attendance tracking
- Class performance analytics
- Student progress monitoring
- Workload management

**Permissions:**
- Submit marks for their classes/subjects
- View their students' data
- Request mark amendments (via escalation)
- Track attendance
- Cannot modify confirmed marks without approval

### 3. Parents
**Needs:**
- Simple login via access token
- View child's academic results
- Access PDF report cards
- Track attendance
- Communicate with school (future feature)

**Permissions:**
- View-only access to their child's data
- Cannot modify any information
- Time-limited access tokens

### 4. Group Administrators (Multi-School)
**Needs:**
- Cross-school analytics
- School group management
- Comparative performance reports
- Centralized policy management

**Permissions:**
- View data across multiple schools
- Configure group-level policies
- Generate group-wide reports

---

## Core Features to Expose in Frontend

### 1. Authentication & Authorization
- **Login Methods**:
  - Admin: Email/phone + password
  - Teacher: Access token entry
  - Parent: Access token entry
  - Remember me functionality
- **Role-Based Access Control (RBAC)**: Different dashboards per role
- **Session Management**: Secure token handling, logout

### 2. School Setup Wizard (Admin)
Multi-step onboarding for new schools:
1. **School Information**: Name, type (Primary/Secondary/Mixed), admin contact
2. **Grading Configuration**: Define assessment pillars (e.g., CA1: 10, CA2: 10, Midterm: 20, Exam: 60)
3. **Academic Terms**: Set up term dates and structure
4. **User Onboarding**: Generate access tokens for teachers
5. **Review & Activate**: Final confirmation before going operational

### 3. Dashboard Views

#### Admin Dashboard
- **Quick Stats Cards**:
  - Total students, teachers, subjects
  - Pending escalations (with priority badges)
  - Classes with complete/incomplete marks
  - Recent activity feed
- **Charts**:
  - School performance over time
  - Subject performance comparison
  - Attendance trends
  - Teacher workload distribution
- **Action Items**:
  - Pending escalations requiring attention
  - Classes ready for report generation
  - Incomplete mark submissions

#### Teacher Dashboard
- **Workload Overview**: Classes and subjects assigned
- **Quick Actions**:
  - Submit marks (camera/upload icon for images)
  - Take attendance
  - View class performance
- **Status Cards**:
  - Pending mark submissions
  - Drafts awaiting confirmation
  - Recent submissions
- **Class List**: Students per class with performance indicators

#### Parent Portal
- **Student Profile**: Child's photo, class, basic info
- **Current Results**: Latest term scores with visual indicators
- **Historical Performance**: Graph showing progress over terms
- **Attendance Summary**: Days present/absent
- **Download Reports**: PDF terminal report cards
- **Teacher Remarks**: Latest comments and recommendations

### 4. Mark Management

#### For Teachers:
- **Submit Marks Interface**:
  - Select class and subject
  - Upload mark sheet photos (multiple images supported)
  - Manual text entry option
  - Visual preview of extracted data
  - Student-by-student editing
  - Gap detection warnings (missing students)
- **Draft Review**:
  - Table view of extracted marks
  - Edit individual scores
  - Confirm/finalize button
  - Generate verification PDF
- **Submission History**:
  - List of all submissions
  - Status indicators (Draft, Confirmed, Locked)
  - Amendment requests

#### For Admin:
- **Broadsheet View**: Class-wide summary table
- **Individual Reports**: Student-by-student view
- **Approval Workflow**:
  - Review submitted marks
  - Approve or request corrections
  - Release results to parents

### 5. Escalation Management
- **Escalation List**:
  - Filter by status (Pending, Resolved, Failed)
  - Priority indicators (Critical, High, Medium, Low)
  - Origin agent and type
  - Timestamp and waiting time
- **Escalation Detail View**:
  - Full conversation context
  - Reason for escalation
  - Action buttons (Approve, Reject, Request Clarification)
  - Admin decision notes
- **Focus Management**: Lock/unlock escalations you're handling

### 6. Report Generation
- **Generate Reports**:
  - Select class and term
  - Choose report type (Broadsheet, Individual Cards, Attendance)
  - Generate PDFs
  - Preview before finalizing
- **Report Library**:
  - List of generated reports
  - Download links
  - Status tracking (Draft, Released, Archived)
- **Batch Operations**:
  - Generate all class reports at once
  - Mass PDF generation with progress indicator

### 7. User Management (Admin)
- **Teachers**:
  - List all teachers
  - Create/edit teacher profiles
  - Generate/regenerate access tokens
  - Assign classes and subjects
  - View teacher activity
- **Students**:
  - Student roster with class filtering
  - Add/edit student information
  - Generate parent access codes
  - Bulk import (CSV upload)
- **Parents**:
  - Link parents to students
  - Manage access tokens
  - View parent activity

### 8. Attendance Tracking
- **Daily Attendance**:
  - Class-based roll call interface
  - Mark present/absent
  - Bulk actions
  - Absence alerts (3+ days triggers escalation)
- **Attendance Reports**:
  - Monthly summaries
  - Individual student attendance history
  - Export to PDF/Excel

### 9. Analytics & Insights
- **School Performance**:
  - Class averages over time
  - Subject performance trends
  - Teacher effectiveness metrics
- **Student Analytics**:
  - Individual progress tracking
  - Grade distribution charts
  - At-risk student identification
- **System Usage**:
  - WhatsApp message volume
  - Vision processing stats
  - Escalation resolution times

---

## Data Models

### Core Entities

#### School
```typescript
{
  id: string;
  name: string;
  admin_phone: string;
  school_type: 'PRIMARY' | 'SECONDARY' | 'BOTH';
  grading_config: {
    pillars: Array<{id: string, name: string, max_score: number}>;
    total_max: number;
    rank_students: boolean;
  };
  setup_status: 'PENDING_SETUP' | 'OPERATIONAL';
  active_term: string;
  created_at: Date;
}
```

#### User
```typescript
{
  id: string;
  phone: string;
  role: 'admin' | 'teacher' | 'parent';
  name: string;
  school_id: string;
  assigned_class?: string;
  school_type?: string;
  created_at: Date;
}
```

#### Student
```typescript
{
  student_id: string;
  school_id: string;
  name: string;
  class_level: string;
  parent_access_code: string;
  created_at: Date;
}
```

#### Student Marks
```typescript
{
  id: string;
  school_id: string;
  student_id: string;
  student_name: string;
  teacher_id: string;
  class_level: string;
  subject: string;
  term_id: string;
  marks_json: Record<string, number>; // pillar scores
  total_score: number;
  confirmed_by_teacher: boolean;
  status: 'DRAFT' | 'CONFIRMED' | 'RELEASED' | 'ARCHIVED';
  indexed_at: Date;
}
```

#### Escalation
```typescript
{
  id: string;
  origin_agent: 'PA' | 'TA' | 'GA';
  escalation_type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  school_id: string;
  from_phone: string;
  user_name?: string;
  user_role?: string;
  reason: string;
  what_agent_needed: string;
  escalation_state: 'PAUSED' | 'AWAITING_CLARIFICATION' | 'IN_AUTHORITY' | 'RESOLVED' | 'FAILED';
  status: 'ESCALATED' | 'RESOLVED' | 'RESUMED' | 'CLOSED';
  admin_decision?: string;
  admin_instruction?: string;
  timestamp: number;
}
```

#### Terminal Report
```typescript
{
  id: string;
  school_id: string;
  student_id: string;
  class_level: string;
  term_id: string;
  total_aggregate: number;
  average_score: number;
  teacher_remarks: string;
  principal_remarks: string;
  status: 'DRAFT' | 'RELEASED' | 'PUBLISHED' | 'ARCHIVED';
  generated_at: Date;
  updated_at: Date;
}
```

---

## Required Pages

### Public Pages (Unauthenticated)

#### 1. Landing Page
**Purpose**: Marketing and conversion
**Sections**:
- Hero section with value proposition
- "WhatsApp-First" differentiation highlight
- Feature grid (Vision AI, Report Generation, Multi-Tenancy)
- How it works (3-step process)
- Testimonials from schools
- Pricing/SaaS model explanation
- CTA buttons ("Start Free Trial", "Request Demo")
- Trust indicators (security badges, data protection)

#### 2. Features Page
**Purpose**: Detailed feature showcase
**Sections**:
- Feature categories (Admin, Teacher, Parent features)
- Detailed explanations of:
  - Vision-powered mark entry
  - Automated report generation
  - Escalation workflows
  - Multi-school management
- Screenshots/mockups of WhatsApp interactions
- Comparison with traditional methods

#### 3. Pricing Page
**Purpose**: Transparent pricing for SaaS model
**Sections**:
- Pricing tiers (per-school pricing)
- What's included in each tier
- Feature comparison table
- FAQ about billing
- Contact sales for enterprise/group pricing

#### 4. Documentation/Help Center
**Purpose**: Self-service support
**Sections**:
- Quick Start Guide
- Admin tutorials
- Teacher tutorials
- Parent guides
- Troubleshooting
- Video tutorials (embedded)

#### 5. Contact/Support Page
**Purpose**: Support and sales inquiries
**Sections**:
- Contact form
- Support email/phone
- Live chat widget (if available)
- Office hours
- Emergency support for critical issues

#### 6. About Page
**Purpose**: Company story and mission
**Sections**:
- Mission statement
- Team section
- Story of KUMO's creation
- Partners/schools using KUMO
- Careers (if applicable)

### Authentication Pages

#### 7. Login Page
- Role selection (Admin, Teacher, Parent)
- Admin: Email/phone + password
- Teacher/Parent: Access token entry
- "Forgot password" link
- Remember me checkbox

#### 8. Password Reset Page
- Email/phone input
- Verification code entry
- New password creation

### Protected Dashboard Pages

#### 9. Admin Dashboard
- Overview statistics
- Quick actions grid
- Pending escalations list
- Recent activity feed
- Charts and analytics

#### 10. School Setup Wizard
- Multi-step form (5 steps)
- Progress indicator
- Save and resume capability
- Validation at each step

#### 11. Grading Configuration
- Dynamic pillar builder
- Add/remove pillars
- Set max scores
- Preview total calculation
- Save/load configurations

#### 12. Teacher Management
- Teacher list with search/filter
- Add teacher modal
- Edit teacher profile
- Token generation/regeneration
- Assign classes/subjects interface

#### 13. Student Management
- Student roster table
- Class filter dropdown
- Add student modal
- Bulk import interface (CSV upload)
- Edit student details
- Generate parent tokens

#### 14. Mark Submission (Teacher)
- Class/subject selector
- Image upload zone (drag & drop)
- Camera capture button (mobile)
- Extracted data table
- Edit/confirm interface
- Draft save functionality

#### 15. Draft Review Page
- Side-by-side comparison (image vs extracted)
- Editable data table
- Student validation (check against roster)
- Gap detection warnings
- Confirm and submit buttons

#### 16. Broadsheet View
- Class-wide marks table
- Subject columns with pillar breakdowns
- Student ranking
- Export to PDF
- Print view

#### 17. Report Generation
- Term/class selector
- Report type selection
- Generate button with progress
- Preview modal
- Download links

#### 18. Escalation Management
- Escalation list with filters
- Priority badges
- Status indicators
- Detail view with conversation history
- Action buttons (Approve, Reject, Clarify)

#### 19. Attendance Tracking
- Calendar view
- Class selector
- Student roll call grid
- Quick present/absent toggles
- Bulk actions
- Absence alert indicators

#### 20. Analytics Dashboard
- Performance charts (line, bar, pie)
- Date range selector
- Export reports
- Drill-down capabilities
- Comparative analysis

#### 21. Parent Portal
- Student profile card
- Current term results table
- Historical performance graph
- Attendance summary
- PDF download links
- Teacher remarks display

#### 22. User Profile/Settings
- Personal information
- Change password
- Notification preferences
- Language selection
- Session management

#### 23. System Settings (Admin)
- School information edit
- Academic year setup
- WhatsApp integration settings
- Backup and export
- Audit log viewer

---

## UI/UX Design Guidelines

### Design Principles
1. **Mobile-First**: Many users will access via mobile; ensure responsive design
2. **Accessibility**: WCAG 2.1 AA compliance (contrast, keyboard navigation, screen readers)
3. **Performance**: Fast load times (< 3 seconds), optimistic UI updates
4. **Intuitive**: Minimal training required; self-explanatory interfaces
5. **Contextual Help**: Tooltips, inline explanations, help icons
6. **Progressive Disclosure**: Don't overwhelm; show details on demand

### Layout Structure
- **Header**: Logo, navigation, user menu (profile, logout)
- **Sidebar** (desktop): Role-based navigation menu
- **Main Content**: Dynamic content area
- **Footer**: Links, version info, support

### Navigation Structure

#### Admin Navigation
- Dashboard
- School Setup
- Users (Teachers, Students, Parents)
- Academics (Marks, Reports, Attendance)
- Escalations
- Analytics
- Settings

#### Teacher Navigation
- Dashboard
- My Classes
- Submit Marks
- Attendance
- Reports
- Profile

#### Parent Navigation
- My Child
- Results
- Reports
- Attendance
- Messages

### Interactive Elements

#### Forms
- Clear labels and placeholders
- Inline validation
- Error messages in plain language
- Save progress indicators
- Auto-save for long forms

#### Tables
- Sortable columns
- Search/filter functionality
- Pagination or infinite scroll
- Row actions (edit, delete, view)
- Export options
- Responsive (horizontal scroll on mobile)

#### Buttons
- Primary actions: Filled buttons
- Secondary actions: Outlined buttons
- Destructive actions: Red color
- Loading states with spinners
- Disabled states with tooltips

#### Modals
- Clear titles
- Close button (X)
- Primary action button
- Cancel/close option
- Keyboard accessible (ESC to close)

#### Notifications
- Toast notifications for success/error
- Position: Top-right
- Auto-dismiss after 5 seconds
- Action buttons in notifications when relevant

### Data Visualization
- **Charts**: Use Chart.js or similar
- **Types**: Line charts (trends), Bar charts (comparisons), Pie charts (distribution)
- **Colors**: Accessible palette with sufficient contrast
- **Interactivity**: Tooltips on hover, clickable legends
- **Responsiveness**: Resize gracefully on mobile

---

## Technical Requirements

### Frontend Stack (Recommended)
- **Framework**: React 18+ with TypeScript
- **State Management**: React Query (server state) + Zustand (client state)
- **Routing**: React Router v6
- **UI Library**: Tailwind CSS + Headless UI
- **Forms**: React Hook Form + Zod validation
- **Charts**: Chart.js or Recharts
- **PDF Viewer**: react-pdf
- **Image Upload**: react-dropzone
- **Date Handling**: date-fns
- **HTTP Client**: Axios with interceptors

### API Integration
The frontend will consume REST APIs from the Node.js backend:

#### Core Endpoints (to be built)
```
Authentication:
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh
- POST /api/auth/forgot-password

Schools:
- GET /api/schools/:id
- PUT /api/schools/:id
- POST /api/schools/setup

Users:
- GET /api/users
- POST /api/users
- PUT /api/users/:id
- DELETE /api/users/:id
- POST /api/users/:id/token

Students:
- GET /api/students
- POST /api/students
- PUT /api/students/:id
- DELETE /api/students/:id
- POST /api/students/import

Marks:
- GET /api/marks
- POST /api/marks/submit
- PUT /api/marks/:id
- POST /api/marks/confirm
- GET /api/marks/drafts

Reports:
- POST /api/reports/generate
- GET /api/reports
- GET /api/reports/:id/download
- POST /api/reports/broadsheet

Escalations:
- GET /api/escalations
- GET /api/escalations/:id
- POST /api/escalations/:id/respond
- POST /api/escalations/:id/lock

Attendance:
- GET /api/attendance
- POST /api/attendance
- GET /api/attendance/summary

Analytics:
- GET /api/analytics/school
- GET /api/analytics/class/:id
- GET /api/analytics/student/:id
```

### Real-time Features (Future)
- WebSocket connection for live escalations
- Push notifications for critical events
- Real-time attendance updates

### File Handling
- Image upload for mark sheets
- PDF generation and download
- CSV import for bulk operations
- Progress indicators for uploads

---

## Responsive Breakpoints
- **Mobile**: < 640px (single column, hamburger menu)
- **Tablet**: 640px - 1024px (adjusted grids, collapsible sidebar)
- **Desktop**: > 1024px (full layout, persistent sidebar)

---

## Security Requirements
- **Authentication**: JWT tokens with refresh mechanism
- **Authorization**: Role-based access control on all routes
- **HTTPS**: All API calls over HTTPS
- **Input Validation**: Client and server-side validation
- **XSS Protection**: Sanitize all user inputs
- **CSRF Protection**: Tokens for state-changing operations
- **Session Timeout**: Auto-logout after inactivity
- **Password Policy**: Minimum complexity requirements

---

## Accessibility Requirements
- **Keyboard Navigation**: All features accessible via keyboard
- **Screen Reader Support**: ARIA labels and semantic HTML
- **Color Contrast**: WCAG 2.1 AA compliant (4.5:1 ratio)
- **Focus Indicators**: Visible focus states
- **Alt Text**: All images have descriptive alt text
- **Form Labels**: All inputs properly labeled
- **Error Identification**: Clear error messages linked to fields

---

## Performance Requirements
- **Initial Load**: < 3 seconds on 3G connection
- **Time to Interactive**: < 5 seconds
- **Lighthouse Score**: > 90 across all categories
- **Image Optimization**: Lazy loading, WebP format
- **Code Splitting**: Route-based splitting
- **Caching**: Service worker for offline support

---

## Error Handling
- **404 Pages**: Custom not found page with navigation
- **500 Errors**: Friendly error message with retry option
- **API Errors**: Toast notifications with error details
- **Offline Mode**: Queue actions, sync when back online
- **Validation Errors**: Inline field errors

---

## Onboarding Flows

### Admin Onboarding
1. Email verification
2. School creation wizard
3. Grading configuration
4. Teacher invitation (token generation)
5. Dashboard tour (optional guided tour)

### Teacher Onboarding
1. Token entry
2. Profile completion
3. Class/subject assignment
4. Student registration
5. First mark submission tutorial

### Parent Onboarding
1. Token entry
2. Student verification
3. Results overview tutorial

---

## Brand Guidelines

### Typography
- **Headings**: Inter or Poppins (sans-serif, modern)
- **Body**: Inter (readable, professional)
- **Monospace**: JetBrains Mono (for code/data)

### Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64px
- Consistent padding and margins

### Shadows
- Subtle shadows for cards (elevation 1-3)
- Stronger shadows for modals (elevation 4)
- Consistent shadow direction (top-left light source)

### Border Radius
- Small: 4px (buttons, inputs)
- Medium: 8px (cards)
- Large: 12px (modals)
- Full: 9999px (pills, badges)

---

## Image Assets Needed

### Landing Page
- Hero illustration (education/teachers/students)
- Feature icons (12+)
- WhatsApp phone mockups
- School building illustration
- Team photos (About page)

### Dashboard
- Empty state illustrations
- Loading state animations
- Success/checkmark animations
- Error/warning icons

### Placeholders
- User avatar placeholder
- School logo placeholder
- Student photo placeholder

---

## Animation Guidelines

### Micro-interactions
- Button hover states (scale, color shift)
- Loading spinners
- Success checkmarks
- Toggle switches
- Form field focus transitions

### Page Transitions
- Fade between routes (200ms)
- Slide in for modals (300ms)
- Stagger for list items

### Data Loading
- Skeleton screens
- Progressive image loading
- Shimmer effects for placeholders

---

## Browser Support
- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 10+)

---

## Deliverables Expected

1. **Source Code**:
   - Complete React application
   - Component library
   - Custom hooks
   - Utility functions
   - TypeScript types

2. **Styling**:
   - Tailwind configuration
   - Custom CSS if needed
   - Responsive styles

3. **Assets**:
   - All icons (Lucide or similar)
   - Illustrations (unDraw or similar)
   - Images optimized for web

4. **Configuration**:
   - Environment variables template
   - Build configuration
   - ESLint/Prettier config

5. **Documentation**:
   - README with setup instructions
   - Component documentation
   - API integration guide

---

## Testing Requirements

### Unit Tests
- Component testing with React Testing Library
- Hook testing
- Utility function testing

### Integration Tests
- API mocking with MSW
- User flow testing
- Form submission testing

### E2E Tests
- Critical user journeys
- Authentication flows
- Mark submission workflows

---

## Deployment
- **Build Output**: Static files for CDN deployment
- **Environment**: Production, Staging, Development
- **CI/CD**: GitHub Actions or similar
- **Hosting**: Vercel, Netlify, or AWS CloudFront

---

## Future Enhancements (Phase 2)
- Mobile app (React Native)
- Offline mode with PWA
- Advanced analytics with AI insights
- Multi-language support (French, Swahili, etc.)
- Integration with payment systems
- SMS fallback for non-WhatsApp users
- Voice message transcription in frontend
- Bulk messaging to parents
- Calendar integration
- Third-party integrations (Google Classroom, etc.)

---

## Reference Materials
- Backend API documentation (see TECHNICAL.md)
- Database schema (22 tables)
- User flows (see QUICKSTART.md)
- WhatsApp interaction examples

---

## Design System Foundation

### Component Library Structure
Create these reusable components:

1. **Layout Components**:
   - AppShell (header, sidebar, footer)
   - PageContainer
   - Card
   - Grid
   - Stack

2. **Form Components**:
   - Input
   - Select
   - Textarea
   - Checkbox
   - Radio
   - Switch
   - FileUpload
   - DatePicker

3. **Data Display**:
   - Table
   - DataGrid
   - Badge
   - Avatar
   - ProgressBar
   - StatCard

4. **Feedback**:
   - Alert
   - Toast
   - Modal
   - ConfirmDialog
   - LoadingSpinner
   - Skeleton

5. **Navigation**:
   - NavLink
   - Breadcrumb
   - Tabs
   - Pagination
   - Stepper

6. **Charts**:
   - LineChart
   - BarChart
   - PieChart
   - AreaChart

---

## Implementation Priority

### Phase 1: Core MVP (Weeks 1-2)
1. Landing page
2. Authentication (login, token entry)
3. Admin dashboard
4. Teacher dashboard
5. Basic mark submission
6. Report viewing

### Phase 2: Essential Features (Weeks 3-4)
1. School setup wizard
2. User management
3. Escalation management
4. Report generation
5. Attendance tracking

### Phase 3: Advanced Features (Weeks 5-6)
1. Analytics dashboard
2. Parent portal
3. Bulk operations
4. Advanced settings

### Phase 4: Polish (Week 7)
1. Responsive optimization
2. Performance tuning
3. Accessibility improvements
4. Documentation

---

## Success Metrics
- **Load Time**: < 3 seconds
- **Time to Complete Setup**: < 10 minutes
- **Task Completion Rate**: > 95% for core workflows
- **User Satisfaction**: NPS > 50
- **Error Rate**: < 1%
- **Accessibility Score**: 100% WCAG 2.1 AA compliance

---

**END OF PROMPT**

Use this comprehensive specification to generate a complete, production-ready frontend for the KUMO academic management platform. The design should be modern, professional, and optimized for educators in African schools. Focus on simplicity, speed, and mobile responsiveness.
