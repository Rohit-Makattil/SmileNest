import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Map ISO country codes to full names
function getCountryName(code: string): string {
  const countries: Record<string, string> = {
    US: 'United States', GB: 'United Kingdom', CA: 'Canada', DE: 'Germany', IN: 'India',
    FR: 'France', AU: 'Australia', BR: 'Brazil', JP: 'Japan', CN: 'China',
    NL: 'Netherlands', ES: 'Spain', IT: 'Italy', RU: 'Russia', KR: 'South Korea',
    SG: 'Singapore', SE: 'Sweden', NZ: 'New Zealand', IE: 'Ireland', MX: 'Mexico',
  };
  return countries[code.toUpperCase()] || code;
}

function parseUserAgent(uaString: string | null) {
  if (!uaString) return { browser: 'Unknown', device: 'Desktop' };
  
  let browser = 'Unknown';
  let device = 'Desktop';
  const ua = uaString.toLowerCase();
  
  // Device Detection
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    device = 'Tablet';
  } else if (/mobi|android|iphone|ipod/i.test(ua)) {
    device = 'Mobile';
  }
  
  // Browser Detection
  if (ua.includes('edg') || ua.includes('edge')) {
    browser = 'Edge';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('chrome') || ua.includes('chromium')) {
    browser = 'Chrome';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('trident') || ua.includes('msie')) {
    browser = 'IE';
  }
  
  return { browser, device };
}

async function resolveCountry(req: Request): Promise<string> {
  // 1. Try Vercel Geolocation headers
  const vercelCountry = req.headers.get('x-vercel-ip-country');
  if (vercelCountry) {
    return getCountryName(vercelCountry);
  }
  
  // 2. Resolve Client IP address from headers
  const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (!ipHeader) return 'Unknown';
  const ip = ipHeader.split(',')[0].trim();
  
  // Ignore local address lookups
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return 'Localhost';
  }
  
  // 3. Try IPInfo with token
  const token = process.env.IPINFO_TOKEN;
  if (token && token.trim() !== '') {
    try {
      const res = await fetch(`https://ipinfo.io/${ip}?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        return data.country ? getCountryName(data.country) : 'Unknown';
      }
    } catch (e) {
      console.error('IPInfo resolution failed', e);
    }
  }
  
  // 4. Try ipapi.co public fallback (discards IP after mapping)
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (res.ok) {
      const data = await res.json();
      return data.country_name || 'Unknown';
    }
  } catch (e) {
    // Ignore fail
  }
  
  return 'Unknown';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { visitorId, isReturning } = body;
    
    if (!visitorId) {
      return NextResponse.json({ error: 'visitorId is required' }, { status: 400 });
    }
    
    const userAgent = req.headers.get('user-agent');
    const { browser, device } = parseUserAgent(userAgent);
    const country = await resolveCountry(req);
    
    // Upsert visitor profile without saving the client's IP
    const { error: visitorError } = await supabaseAdmin
      .from('visitors')
      .upsert({
        id: visitorId,
        is_returning: isReturning || false,
        country,
        browser,
        device
      });
      
    // Note: If visitor already exists, Postgres insert policy might fail or do nothing, 
    // which is handled. We can query or upsert. In mock client, it handles this.
    // If Supabase RLS policies are set up, we should ensure it handles it cleanly.
    
    // Open a new session
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .insert({
        visitor_id: visitorId,
        start_time: new Date().toISOString(),
        last_ping: new Date().toISOString(),
        duration_seconds: 0
      })
      .select()
      .single();
      
    if (sessionError) {
      console.error('Session error logging:', sessionError);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      sessionId: sessionData?.id, 
      country, 
      device, 
      browser 
    });
  } catch (err: any) {
    console.error('Analytics logging error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
