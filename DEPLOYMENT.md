# Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (for frontend)
- Render account (for backend)
- Supabase project (already set up)

---

## Step 1: Deploy Backend to Render

### 1.1 Push Latest Changes to GitHub
```bash
git add -A
git commit -m "Ready for production deployment"
git push origin main
```

### 1.2 Create Render Account & Service
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: kumo-backend
   - **Branch**: main
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start`

### 1.3 Add Environment Variables

Copy and paste these environment variables into Render's Environment Variables section:

```
# SYSTEM
WHATSAPP_NAME=KUMO_SCHOOL_SYSTEM
LOG_LEVEL=info
PORT=3000
NODE_ENV=production
DB_PATH=./kumo.db

# SUPABASE
SUPABASE_URL=https://zmfsigqfvbjsllrklqdy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZnppZ2ZxdmJqc2xscmtscWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5ODUyMjAsImV4cCI6MjA4NzU2MTIyMH0._I_LO7uXu9RruCvtlI5agna5rfrxKw47V3M8gD1P33w
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZnppZ2ZxdmJqc2xscmtscWR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk4NTIyMCwiZXhwIjoyMDg3NTYxMjIwfQ.9I18LnpxzB6pfz_D2ckkaP0zT2evKGr1nAVs4I83IAA

# AUTH
JWT_SECRET=CHANGE_TO_RANDOM_SECRET_MIN_32_CHARS
JWT_REFRESH_SECRET=CHANGE_TO_RANDOM_SECRET_MIN_32_CHARS
FRONTEND_URL=https://your-frontend.vercel.app

# AI MODELS
GROQ_MODEL=moonshotai/kimi-k2-instruct-0905
GEMINI_MODEL=models/gemini-2.5-flash
OPENROUTER_MODEL=google/gemini-flash-1.5-8b
GEMINI_MODEL_VISION=models/gemini-2.5-flash
GEMINI_MODEL_EMBEDDING=models/gemini-embedding-001
GROQ_MODEL_AUDIO=whisper-large-v3

# YOUR GEMINI KEYS
GEMINI_VISION_API_KEY=YOUR_GEMINI_KEY
GEMINI_VISION_API_KEY_2=YOUR_GEMINI_KEY_2
GEMINI_VISION_API_KEY_3=YOUR_GEMINI_KEY_3

# YOUR GROQ KEYS
PA_GROQ_API_KEY=YOUR_GROQ_KEY
TA_GROQ_API_KEY=YOUR_GROQ_KEY
PRIMARY_TA_GROQ_API_KEY=YOUR_GROQ_KEY
SA_GROQ_API_KEY=YOUR_GROQ_KEY
GA_GROQ_API_KEY=YOUR_GROQ_KEY

# YOUR GEMINI KEYS (repeated)
PA_GEMINI_API_KEY=YOUR_GEMINI_KEY
TA_GEMINI_API_KEY=YOUR_GEMINI_KEY
PRIMARY_TA_GEMINI_API_KEY=YOUR_GEMINI_KEY
SA_GEMINI_API_KEY=YOUR_GEMINI_KEY
GA_GEMINI_API_KEY=YOUR_GEMINI_KEY

# YOUR OPENROUTER KEYS
PA_OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY
TA_OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY
PRIMARY_TA_OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY
SA_OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY
GA_OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY

# YOUR ELEVENLABS KEYS
ELEVENLABS_API_KEY=YOUR_ELEVENLABS_KEY
ELEVENLABS_AGENT_ID_PA=YOUR_AGENT_ID
ELEVENLABS_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# YOUR GROQ RETRY KEYS
GROQ_RETRY_KEY_1=YOUR_GROQ_KEY
GROQ_RETRY_KEY_2=YOUR_GROQ_KEY
GROQ_RETRY_KEY_3=YOUR_GROQ_KEY
GROQ_RETRY_KEY_4=YOUR_GROQ_KEY
GROQ_RETRY_KEY_5=YOUR_GROQ_KEY
```

### 1.4 Deploy
- Click "Create Web Service"
- Wait for build to complete (~5-10 minutes)
- Note your backend URL: `https://kumo-backend.onrender.com`

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Update Frontend Environment Variable
After backend deploys, edit `frontend/app/.env`:
```
VITE_API_URL=https://kumo-backend.onrender.com/api
```

Then commit and push:
```bash
git add -A
git commit -m "Update API URL for production"
git push origin main
```

### 2.2 Deploy to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import the `kumoai` repo
4. Select the **frontend/app** folder as root
5. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add environment variable:
   - `VITE_API_URL` = `https://kumo-backend.onrender.com/api`
7. Click "Deploy"

---

## Step 3: Verify Deployment

### Test Backend
```bash
curl https://kumo-backend.onrender.com/api/health
```

### Test Frontend
Visit: `https://your-frontend.vercel.app`

---

## Troubleshooting

### Backend Issues
- Check Render logs for errors
- Ensure all environment variables are set
- Verify Supabase connection

### Frontend Issues
- Check browser console for CORS errors
- Verify API_URL is correct
- Ensure backend is running

### WhatsApp Connection
- QR codes are generated via SSE endpoint
- In production, ensure proper SSL/HTTPS
