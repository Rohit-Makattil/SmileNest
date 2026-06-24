import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId } = body;
    
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    
    // Fetch start_time to calculate duration securely on the server
    const { data: session, error: selectError } = await supabaseAdmin
      .from('sessions')
      .select('start_time')
      .eq('id', sessionId)
      .single();
      
    if (selectError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    const startTime = new Date(session.start_time).getTime();
    const durationSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    
    const { error: updateError } = await supabaseAdmin
      .from('sessions')
      .update({
        last_ping: new Date().toISOString(),
        duration_seconds: durationSeconds
      })
      .eq('id', sessionId);
      
    if (updateError) {
      console.error('Failed to update session heartbeat:', updateError);
      return NextResponse.json({ error: 'Failed to update heartbeat' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, durationSeconds });
  } catch (err: any) {
    console.error('Session heartbeat error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
