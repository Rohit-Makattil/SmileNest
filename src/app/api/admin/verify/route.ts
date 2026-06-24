import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    // Retrieve user session details securely via the Admin/Service-Role SDK client.
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ isAdmin: false, error: authError?.message || 'Invalid or expired session token.' }, { status: 401 });
    }

    // Query admin_users with RLS-bypass service role
    const { data: adminUser, error: dbError } = await supabaseAdmin
      .from('admin_users')
      .select('id, email')
      .eq('id', user.id)
      .single();

    if (dbError || !adminUser) {
      console.warn(`Admin verification failed for user ID: ${user.id}, email: ${user.email || 'N/A'}`);
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }

    return NextResponse.json({ isAdmin: true, email: adminUser.email }, { status: 200 });
  } catch (err: any) {
    console.error('Verify admin route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
