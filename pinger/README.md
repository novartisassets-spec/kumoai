# Kumo Smart Pinger - Deployment Guide

This pinger keeps your Render backend awake using Cloudflare Workers.

## Features
- Random pings every 1-16 minutes (avoids bot detection)
- Sleeps during night hours (11pm - 5am Africa/Lagos time)
- Uses random User-Agent strings to appear as real browsers
- Frontend auto-wakeup when visitors access your site

## Quick Deploy to Cloudflare

### Option 1: Cloudflare Dashboard
1. Go to https://dash.cloudflare.com
2. Create account (free)
3. Go to Workers & Pages > Create application
4. Click "Create Worker"
5. Copy the code from `worker.ts` and paste into the editor
6. Click "Deploy"

### Option 2: CRON Trigger (Recommended)
After deploying:
1. In your Worker, go to "Triggers" tab
2. Add a CRON trigger: `*/15 * * * *` (every 15 minutes)
3. The worker will automatically ping at random intervals

## How It Works

### Layer 1: Frontend Wakeup
When visitors access your Vercel frontend, it automatically pings Render to wake it up. This is natural user behavior.

### Layer 2: Cloudflare Pinger (Backup)
If no visitors for 15+ minutes, the pinger kicks in:
- Random 1-16 minute intervals
- Skips 11pm-5am (Africa time)
- Makes requests look like real browsers

### Layer 3: Auto-Reconnect
When Render wakes up, the backend automatically reconnects WhatsApp using saved session data from the database.

## Configuration

Edit `worker.ts` to customize:
- `RENDER_URLS`: Your backend URLs
- `NIGHT_START_HOUR`: 23 (11pm)
- `NIGHT_END_HOUR`: 5 (5am)
- Africa timezone is UTC+1

## Testing

1. Deploy the worker
2. Visit `/ping` endpoint to trigger a test ping
3. Check Cloudflare logs for activity
