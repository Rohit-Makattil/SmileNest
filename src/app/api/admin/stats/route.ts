import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDashboardStats, getRecentCaptures } from '@/lib/db';

export async function GET(req: Request) {
  try {
    // 1. Verify access cookie
    const cookieStore = await cookies();
    const authCookie = cookieStore.get('sb-admin-auth');
    if (!authCookie || authCookie.value !== 'true') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    // 2. Fetch computed dashboard stats and logs using server service-role client
    const stats = await getDashboardStats();
    
    const [visitorsRes, sessionsRes, capturesRes, downloadsRes, qrSharesRes] = await Promise.all([
      supabaseAdmin.from('visitors').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('sessions').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('captures').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('downloads').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('qr_shares').select('*').order('created_at', { ascending: false }),
    ]);

    if (visitorsRes.error) throw visitorsRes.error;
    if (sessionsRes.error) throw sessionsRes.error;
    if (capturesRes.error) throw capturesRes.error;
    if (downloadsRes.error) throw downloadsRes.error;
    if (qrSharesRes.error) throw qrSharesRes.error;

    return NextResponse.json({
      success: true,
      stats,
      visitors: visitorsRes.data || [],
      sessions: sessionsRes.data || [],
      captures: capturesRes.data || [],
      downloads: downloadsRes.data || [],
      qrShares: qrSharesRes.data || []
    });
  } catch (err: any) {
    console.error('Admin stats endpoint error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
