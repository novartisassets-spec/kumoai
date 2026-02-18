# KUMO Frontend - Quick Reference Guide
## For AI Website Builder

---

## 🎯 PROJECT ESSENTIALS

**Project Name:** KUMO  
**Type:** School Management SaaS Platform  
**Target Market:** African Schools  
**Unique Feature:** WhatsApp-First + Web Dashboard  

---

## 📊 DASHBOARD STRUCTURE

### 1. Super Admin Portal
```
/admin/dashboard     → Platform overview (KPIs, charts)
/admin/schools       → Manage all schools (table/grid/map)
/admin/billing       → Revenue & subscription plans
/admin/analytics     → Platform metrics
/admin/support       → Support tickets
```

### 2. School Admin Dashboard
```
/school/dashboard    → School overview (stats, activity)
/school/teachers     → Teacher management
/school/students     → Student database
/school/academic     → Classes, subjects, terms, grading
/school/marks        → Marks & results management
/school/attendance   → Attendance tracking
/school/reports      → Report generation
/school/escalations  → Request inbox
/school/whatsapp     → WhatsApp settings
```

### 3. Teacher Portal (Optional)
```
/teacher/dashboard  → Teacher overview
/teacher/marks      → Submit marks
/teacher/attendance → Take attendance
```

### 4. Parent Portal (Optional)
```
/parent/dashboard   → Child overview
/parent/results     → View results
/parent/attendance  → Check attendance
```

---

## 🎨 DESIGN TOKENS

### Colors
- **Primary:** #6366f1 (Indigo)
- **Success:** #10b981 (Green)
- **Warning:** #f59e0b (Orange)
- **Danger:** #ef4444 (Red)
- **Background:** #f9fafb (Light gray)

### Typography
- **Primary Font:** Inter
- **Display Font:** Poppins
- **Base Size:** 16px

### Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64

---

## ✨ 3D ANIMATIONS CHECKLIST

### Must Implement:
- [ ] **Page transitions** - Fade + scale on route change
- [ ] **Card tilt effect** - 3D rotation on mouse hover
- [ ] **Floating elements** - Slow bobbing animation
- [ ] **Hero gradient mesh** - Three.js animated background
- [ ] **Success animations** - Confetti burst
- [ ] **Staggered load** - Content fades in sequentially
- [ ] **Button interactions** - Scale + glow on hover

### Nice to Have:
- [ ] **3D icons** - Rotating icons in cards
- [ ] **Parallax backgrounds** - Layered scroll effect
- [ ] **Morphing shapes** - Organic blob animations
- [ ] **Holographic effects** - Glassmorphism cards

---

## 📱 RESPONSIVE PRIORITIES

### Mobile (First Priority):
- Bottom navigation bar
- Card-based lists (not tables)
- Touch-friendly buttons (44px min)
- Swipe gestures
- Collapsible filters

### Tablet:
- Collapsible sidebar
- 2-column layouts
- Split view for details

### Desktop:
- Full sidebar
- Multi-column dashboards
- Hover interactions

---

## 🔌 KEY INTEGRATIONS

### Authentication:
- Phone number + OTP login
- JWT tokens
- Role-based access

### API Calls:
- React Query for data fetching
- Automatic caching
- Optimistic updates

### Real-time:
- WebSocket for notifications
- Live updates without refresh

---

## 📦 COMPONENT LIBRARY

### Shadcn/ui Components to Install:
- Button
- Card
- Input
- Select
- Dialog
- Dropdown Menu
- Table
- Tabs
- Toast
- Avatar
- Badge
- Calendar
- Chart
- Form
- Sheet (drawer)
- Skeleton (loading)

### Custom Components to Build:
- KPI Card (with 3D effects)
- Data Table (advanced filtering)
- File Upload (with drag-drop)
- Phone Input (country selector)
- OTP Input (6-digit code)
- Gradient Mesh Background (Three.js)
- 3D Tilt Card wrapper

---

## 🎯 MVP FEATURES (Must Build First)

### Week 1:
1. ✅ Authentication (login + OTP)
2. ✅ Super Admin Dashboard
3. ✅ Schools Management

### Week 2:
4. ✅ School Admin Dashboard
5. ✅ Teachers Management
6. ✅ Students Management

### Week 3:
7. ✅ Academic Configuration
8. ✅ Marks Management
9. ✅ Result Release

### Week 4:
10. ✅ Attendance Tracking
11. ✅ Report Generation
12. ✅ WhatsApp Settings

---

## 🚀 PERFORMANCE TARGETS

- **LCP:** < 2.5 seconds
- **FID:** < 100ms
- **CLS:** < 0.1
- **Mobile Score:** > 90 (Lighthouse)

---

## 📝 INTEGRATION NOTES

**After Building:**
1. Place frontend folder in: `kumo/frontend/`
2. Backend API is at: `kumo/src/` (existing)
3. API base URL: `/api`
4. Authentication: JWT in localStorage

**Environment Variables Needed:**
```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

---

## ❓ QUESTIONS FOR CLARIFICATION

If unclear about any requirement:
1. Ask about specific page layout
2. Ask about animation details
3. Ask about component behavior
4. Ask about responsive breakpoints

**When in doubt, build the simplest version first, then add enhancements.**

---

**Ready to build! Start with authentication and dashboard layouts. 🚀**
