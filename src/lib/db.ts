import { supabaseAdmin } from '@/lib/supabase-admin';

// Unified capture types
export type CaptureType = 'photo' | 'strip' | 'boomerang';

// 1. createVisitor
export async function createVisitor(
  visitorId: string,
  isReturning: boolean,
  country: string,
  browser: string,
  device: string
) {
  const { data, error } = await supabaseAdmin
    .from('visitors')
    .upsert({
      id: visitorId,
      is_returning: isReturning,
      country,
      browser,
      device
    })
    .select()
    .single();

  if (error) {
    console.error('Error in createVisitor:', error);
    throw error;
  }
  return data;
}

// 2. updateVisitor
export async function updateVisitor(visitorId: string, updates: any) {
  const { data, error } = await supabaseAdmin
    .from('visitors')
    .update(updates)
    .eq('id', visitorId)
    .select()
    .single();

  if (error) {
    console.error('Error in updateVisitor:', error);
    throw error;
  }
  return data;
}

// 3. createSession
export async function createSession(visitorId: string) {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert({
      visitor_id: visitorId,
      start_time: new Date().toISOString(),
      last_ping: new Date().toISOString(),
      duration_seconds: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Error in createSession:', error);
    throw error;
  }
  return data;
}

// 4. endSession
export async function endSession(sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update({
      end_time: new Date().toISOString()
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('Error in endSession:', error);
    throw error;
  }
  return data;
}

// 5. createCapture
export async function createCapture(
  visitorId: string | null,
  sessionId: string | null,
  type: CaptureType,
  filterUsed: string,
  frameUsed: string,
  imageUrl: string,
  processingTimeMs: number
) {
  const { data, error } = await supabaseAdmin
    .from('captures')
    .insert({
      visitor_id: visitorId,
      session_id: sessionId,
      type,
      filter_used: filterUsed,
      frame_used: frameUsed,
      image_url: imageUrl,
      processing_time_ms: processingTimeMs
    })
    .select()
    .single();

  if (error) {
    console.error('Error in createCapture:', error);
    throw error;
  }
  return data;
}

// 6. createDownload
export async function createDownload(captureId: string, format: 'png' | 'jpg') {
  const { data, error } = await supabaseAdmin
    .from('downloads')
    .insert({
      capture_id: captureId,
      format
    })
    .select()
    .single();

  if (error) {
    console.error('Error in createDownload:', error);
    throw error;
  }
  return data;
}

// 7. createQrShare
export async function createQrShare(captureId: string) {
  const { data, error } = await supabaseAdmin
    .from('qr_shares')
    .insert({
      capture_id: captureId
    })
    .select()
    .single();

  if (error) {
    console.error('Error in createQrShare:', error);
    throw error;
  }
  return data;
}

// 8. getDashboardStats (Executed server-side using admin client to bypass RLS whitelist constraints)
export async function getDashboardStats() {
  const [visitorsRes, sessionsRes, capturesRes, downloadsRes, qrSharesRes] = await Promise.all([
    supabaseAdmin.from('visitors').select('*'),
    supabaseAdmin.from('sessions').select('*'),
    supabaseAdmin.from('captures').select('*'),
    supabaseAdmin.from('downloads').select('*'),
    supabaseAdmin.from('qr_shares').select('*')
  ]);

  if (visitorsRes.error) throw visitorsRes.error;
  if (sessionsRes.error) throw sessionsRes.error;
  if (capturesRes.error) throw capturesRes.error;
  if (downloadsRes.error) throw downloadsRes.error;
  if (qrSharesRes.error) throw qrSharesRes.error;

  const visitors = visitorsRes.data || [];
  const sessions = sessionsRes.data || [];
  const captures = capturesRes.data || [];
  const downloads = downloadsRes.data || [];
  const qrShares = qrSharesRes.data || [];

  const totalVisitors = visitors.length;
  const uniqueVisitors = Array.from(new Set(visitors.map(v => v.id))).length;
  const returningCount = visitors.filter(v => v.is_returning).length;
  const returningPercent = totalVisitors > 0 ? Math.round((returningCount / totalVisitors) * 100) : 0;

  // Active sessions = sessions pinged in the last 2 minutes
  const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
  const activeSessions = sessions.filter(s => new Date(s.last_ping).getTime() > twoMinutesAgo).length;

  const completedSessions = sessions.filter(s => s.duration_seconds > 0);
  const totalSessionTime = completedSessions.reduce((acc, s) => acc + s.duration_seconds, 0);
  const avgSessionDuration = completedSessions.length > 0 ? Math.round(totalSessionTime / completedSessions.length) : 0;

  const totalProcessingTime = captures.reduce((acc, c) => acc + (c.processing_time_ms || 0), 0);
  const avgProcessingTime = captures.length > 0 ? Math.round(totalProcessingTime / captures.length) : 0;

  return {
    totalVisitors,
    uniqueVisitors,
    returningPercent,
    activeSessions,
    avgSessionDuration,
    avgProcessingTime,
    photosCaptured: captures.length,
    downloadsCount: downloads.length,
    qrSharesCount: qrShares.length
  };
}

// 9. getRecentCaptures (Server side fetch)
export async function getRecentCaptures(limit: number = 10) {
  const { data, error } = await supabaseAdmin
    .from('captures')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error in getRecentCaptures:', error);
    throw error;
  }
  return data;
}

// 10. getVisitorAnalytics (For charting)
export async function getVisitorAnalytics() {
  const { data, error } = await supabaseAdmin
    .from('visitors')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error in getVisitorAnalytics:', error);
    throw error;
  }
  return data;
}
