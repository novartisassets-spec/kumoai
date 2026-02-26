/**
 * Cloudflare Worker - Smart Render Pinger
 * Features:
 * - Random pings between 1-16 minutes to avoid bot detection
 * - Sleeps during night hours (11pm - 5am Africa/Lagos time)
 * - Uses random User-Agent to look like real browsers
 */

const RENDER_URLS = [
  'https://kumoai.onrender.com/api/auth/login',
  'https://kumoai.onrender.com/'
];

const NIGHT_START_HOUR = 23;
const NIGHT_END_HOUR = 5;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
];

function getRandomItem(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDelay(): number {
  // Random delay between 5-20 minutes to keep Render awake (it sleeps after 15 min)
  // Varies each time to avoid detection
  return Math.floor(Math.random() * 15 * 60 * 1000) + (5 * 60 * 1000);
}

function shouldSkipPing(): boolean {
  // 20% chance to skip any ping - makes it look more random/organic
  return Math.random() < 0.2;
}

function isNightTime(): boolean {
  const now = new Date();
  const hourInLagos = (now.getUTCHours() + 1 + 24) % 24;
  return hourInLagos >= NIGHT_START_HOUR || hourInLagos < NIGHT_END_HOUR;
}

async function pingRender(): Promise<void> {
  const url = getRandomItem(RENDER_URLS);
  const userAgent = getRandomItem(USER_AGENTS);
  
  try {
    await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive'
      }
    });
    console.log('Pinged: ' + url);
  } catch (error) {
    console.log('Ping failed: ' + url + ' - ' + error);
  }
}

export default {
  async scheduled(event: any, env: any, ctx: any): Promise<void> {
    if (isNightTime()) {
      console.log('Night time - skipping ping');
      return;
    }
    
    // 20% chance to skip - makes it look more organic
    if (shouldSkipPing()) {
      console.log('Skipped ping (random organic behavior)');
      return;
    }
    
    const delay = getRandomDelay();
    ctx.waitUntil(
      new Promise<void>(resolve => setTimeout(async () => {
        await pingRender();
        resolve();
      }, delay))
    );
  },

  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/ping' || url.pathname === '/') {
      if (isNightTime()) {
        return new Response(JSON.stringify({
          status: 'skipped',
          message: 'Night time - pinger is sleeping'
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      await pingRender();
      return new Response(JSON.stringify({
        status: 'success',
        message: 'Ping triggered'
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
