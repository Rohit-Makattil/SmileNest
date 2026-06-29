'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import {
  Activity, Users, Camera, Download, Share2, LogOut, Shield,
  Globe, Clock, Zap, RefreshCw, FileSpreadsheet, Loader2
} from 'lucide-react';
import { supabase, isMock } from '@/lib/supabase';

/* ── Types ── */
interface VisitorRecord { id: string; is_returning: boolean; country: string; browser: string; device: string; created_at: string; }
interface SessionRecord  { id: string; visitor_id: string; start_time: string; end_time: string | null; duration_seconds: number; created_at: string; }
interface CaptureRecord  { id: string; visitor_id: string; session_id: string; type: string; filter_used: string; frame_used: string; image_url: string; processing_time_ms: number; created_at: string; }
interface DownloadRecord { id: string; capture_id: string; format: string; created_at: string; }
interface QrShareRecord  { id: string; capture_id: string; created_at: string; }

/* ── Palette aligned to design system ── */
const CHART_COLORS = ['#A67C52', '#8A6542', '#2B2B2B', '#6B6B6B', '#C4B4A0', '#D6C8B8'];

/* Custom tooltip */
const WarmTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
      color: 'var(--text-primary)',
      boxShadow: 'var(--shadow-md)',
    }}>
      {label && <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefreshing]= useState(false);

  const [visitors,  setVisitors ] = useState<VisitorRecord[]>([]);
  const [sessions,  setSessions ] = useState<SessionRecord[]>([]);
  const [captures,  setCaptures ] = useState<CaptureRecord[]>([]);
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [qrShares,  setQrShares ] = useState<QrShareRecord[]>([]);

  const [stats, setStats] = useState({
    totalVisitors: 0, uniqueVisitors: 0, returningUsersPercent: 0,
    photosCaptured: 0, downloadsCount: 0, qrSharesCount: 0,
    avgSessionTimeSeconds: 0, avgProcessingTimeMs: 0,
  });

  const [dailyTraffic,   setDailyTraffic  ] = useState<any[]>([]);
  const [filterUsage,    setFilterUsage   ] = useState<any[]>([]);
  const [frameUsage,     setFrameUsage    ] = useState<any[]>([]);
  const [deviceUsage,    setDeviceUsage   ] = useState<any[]>([]);
  const [countryUsage,   setCountryUsage  ] = useState<any[]>([]);

  /* ── Auth ── */
  const clearAdminCookie = useCallback(() => {
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    document.cookie = `sb-admin-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict${isSecure ? '; Secure' : ''}`;
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        clearAdminCookie();
        router.push('/admin/login');
        return;
      }

      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.session.access_token }),
      });
      if (!res.ok) {
        clearAdminCookie();
        await supabase.auth.signOut();
        router.push('/admin/login');
        return;
      }

      const { isAdmin } = await res.json();
      if (!isAdmin) {
        clearAdminCookie();
        await supabase.auth.signOut();
        router.push('/admin/login');
        return;
      }

      await fetchDashboardData();
    } catch { 
      clearAdminCookie();
      router.push('/admin/login'); 
    }
  }, [router, clearAdminCookie]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  /* ── Fetch ── */
  const fetchDashboardData = async () => {
    setRefreshing(true);
    try {
      let v: VisitorRecord[] = [], s: SessionRecord[] = [], c: CaptureRecord[] = [], d: DownloadRecord[] = [], q: QrShareRecord[] = [];
      if (isMock) {
        v = JSON.parse(localStorage.getItem('pb_visitors') || '[]');
        s = JSON.parse(localStorage.getItem('pb_sessions') || '[]');
        c = JSON.parse(localStorage.getItem('pb_captures') || '[]');
        d = JSON.parse(localStorage.getItem('pb_downloads') || '[]');
        q = JSON.parse(localStorage.getItem('pb_qr_shares') || '[]');
      } else {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) throw new Error('Stats fetch failed');
        const data = await res.json();
        v = data.visitors ?? []; s = data.sessions ?? []; c = data.captures ?? []; d = data.downloads ?? []; q = data.qrShares ?? [];
      }
      setVisitors(v); setSessions(s); setCaptures(c); setDownloads(d); setQrShares(q);
      computeAnalytics(v, s, c, d, q);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  /* ── Compute ── */
  const computeAnalytics = (v: VisitorRecord[], s: SessionRecord[], c: CaptureRecord[], d: DownloadRecord[], q: QrShareRecord[]) => {
    const uniqueIds = Array.from(new Set(v.map(x => x.id)));
    const returning = v.filter(x => x.is_returning).length;
    const completed = s.filter(x => x.duration_seconds > 0);
    const avgSession = completed.length ? Math.round(completed.reduce((a, x) => a + x.duration_seconds, 0) / completed.length) : 0;
    const avgProcess = c.length ? Math.round(c.reduce((a, x) => a + (x.processing_time_ms || 0), 0) / c.length) : 0;

    setStats({
      totalVisitors: v.length, uniqueVisitors: uniqueIds.length,
      returningUsersPercent: v.length ? Math.round((returning / v.length) * 100) : 0,
      photosCaptured: c.length, downloadsCount: d.length, qrSharesCount: q.length,
      avgSessionTimeSeconds: avgSession, avgProcessingTimeMs: avgProcess,
    });

    /* Traffic */
    const tmap: Record<string, { date: string; sessions: number; visitors: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const k = new Date(Date.now() - i * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      tmap[k] = { date: k, sessions: 0, visitors: 0 };
    }
    v.forEach(x => { const k = new Date(x.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); if (tmap[k]) tmap[k].visitors++; });
    s.forEach(x => { const k = new Date(x.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); if (tmap[k]) tmap[k].sessions++; });
    setDailyTraffic(Object.values(tmap));

    /* Filters */
    const fm: Record<string, number> = {};
    c.forEach(x => { fm[x.filter_used] = (fm[x.filter_used] || 0) + 1; });
    setFilterUsage(Object.entries(fm).map(([name, count]) => ({ name, count })));

    /* Frames */
    const frm: Record<string, number> = {};
    c.forEach(x => { frm[x.frame_used] = (frm[x.frame_used] || 0) + 1; });
    setFrameUsage(Object.entries(frm).map(([name, value]) => ({ name, value })));

    /* Devices */
    const dm: Record<string, number> = {};
    v.forEach(x => { dm[x.device] = (dm[x.device] || 0) + 1; });
    setDeviceUsage(Object.entries(dm).map(([name, value]) => ({ name, value })));

    /* Countries */
    const cm: Record<string, number> = {};
    v.forEach(x => { cm[x.country] = (cm[x.country] || 0) + 1; });
    setCountryUsage(Object.entries(cm).map(([name, count]) => ({ name, count })));
  };

  /* Realtime */
  useEffect(() => {
    const handle = () => fetchDashboardData();
    window.addEventListener('pb_realtime_update', handle);
    let ch: any;
    if (!isMock) {
      ch = supabase.channel('admin-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, handle)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, handle)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'captures' }, handle)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'downloads' }, handle)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'qr_shares' }, handle)
        .subscribe();
    }
    return () => { window.removeEventListener('pb_realtime_update', handle); if (ch) ch.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    clearAdminCookie();
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const exportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Visits', stats.totalVisitors],
      ['Unique Devices', stats.uniqueVisitors],
      ['Returning %', stats.returningUsersPercent],
      ['Captures', stats.photosCaptured],
      ['Downloads', stats.downloadsCount],
      ['QR Shares', stats.qrSharesCount],
      ['Avg Session (s)', stats.avgSessionTimeSeconds],
      ['Avg Process (ms)', stats.avgProcessingTimeMs],
    ];
    const csv = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `smilenest-analytics-${Date.now()}.csv`;
    a.click();
  };

  /* ── Loading state ── */
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: 'var(--bg)' }}>
      <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
      <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace' }}>
        Loading dashboard…
      </p>
    </div>
  );

  /* ── KPI card helper ── */
  const KPICard = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) => (
    <div className="card p-5 flex items-start gap-4">
      <div
        className="p-2.5 rounded-lg"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <Icon size={18} style={{ color: 'var(--accent)' }} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-0.5"
          style={{ color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace', fontSize: 9 }}>
          {label}
        </p>
        <h3 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', lineHeight: 1.1 }}>
          {value}
          {sub && <span className="text-xs font-normal ml-1.5" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
        </h3>
      </div>
    </div>
  );

  /* ── Chart card helper ── */
  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="card p-5 flex flex-col gap-4 min-h-[300px]">
      <div className="film-label self-start">◼ {title}</div>
      <div className="flex-1 min-h-[220px]">{children}</div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

      {/* ── HEADER ── */}
      <header
        className="w-full px-6 py-3.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-75 transition-opacity">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--text-primary)' }}
            >
              <Camera size={15} style={{ color: 'var(--bg)' }} />
            </div>
            <span className="text-base font-semibold">
              Smile<span style={{ color: 'var(--accent)' }}>Nest</span>
            </span>
          </Link>
          <span className="badge badge-default">
            <Shield size={9} className="mr-1" /> ADMIN
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="btn-ghost"
            title="Refresh"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={exportCSV} className="btn-ghost">
            <FileSpreadsheet size={14} style={{ color: 'var(--success)' }} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={handleLogout}
            className="btn-ghost"
            style={{ color: 'var(--error)', borderColor: 'rgba(139,59,59,0.2)' }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-8">

        {/* Sandbox banner */}
        {isMock && (
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
            style={{
              background: 'var(--accent-lighter)',
              border: '1px solid rgba(166,124,82,0.2)',
              color: 'var(--accent)',
            }}
          >
            <span>Sandbox mode — data is stored in localStorage, not Supabase.</span>
            <span className="badge badge-accent">LOCAL</span>
          </div>
        )}

        {/* ── 1. KPI Cards ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={Users}    label="Total Visitors" value={stats.totalVisitors} sub={`(${stats.uniqueVisitors} unique)`} />
          <KPICard icon={Camera}   label="Captures"        value={stats.photosCaptured} />
          <KPICard icon={Download} label="Downloads"       value={stats.downloadsCount} />
          <KPICard icon={Share2}   label="QR Shares"       value={stats.qrSharesCount} />
        </section>

        {/* ── 2. Performance metrics ── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Clock,    label: 'Avg Session',        value: `${Math.floor(stats.avgSessionTimeSeconds/60)}m ${stats.avgSessionTimeSeconds%60}s` },
            { icon: Zap,      label: 'Avg Process Speed',  value: `${stats.avgProcessingTimeMs} ms` },
            { icon: Activity, label: 'Returning Users',    value: `${stats.returningUsersPercent}%` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <Icon size={16} style={{ color: 'var(--text-secondary)' }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── 3. Charts Row 1 ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="DAILY TRAFFIC">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTraffic}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={9} tick={{ fontFamily: 'Space Mono' }} />
                <YAxis stroke="var(--text-muted)" fontSize={9} />
                <Tooltip content={<WarmTooltip />} />
                <Line type="monotone" dataKey="visitors" stroke={CHART_COLORS[0]} name="Visitors" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="sessions" stroke={CHART_COLORS[2]} name="Sessions" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="FILTER USAGE">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filterUsage}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={8} tickLine={false} tick={{ fontFamily: 'Space Mono' }} />
                <YAxis stroke="var(--text-muted)" fontSize={9} />
                <Tooltip content={<WarmTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Uses">
                  {filterUsage.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="DEVICE SPLIT">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={deviceUsage} cx="50%" cy="45%" innerRadius={48} outerRadius={80} paddingAngle={3} dataKey="value">
                  {deviceUsage.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<WarmTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {deviceUsage.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length], display: 'inline-block' }} />
                  {item.name}: {item.value}
                </div>
              ))}
            </div>
          </ChartCard>
        </section>

        {/* ── 4. Charts Row 2 ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="FRAME OVERLAYS">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={frameUsage} cx="50%" cy="45%" innerRadius={48} outerRadius={80} dataKey="value">
                  {frameUsage.map((_, i) => <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<WarmTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {frameUsage.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[(i+2) % CHART_COLORS.length], display: 'inline-block' }} />
                  {item.name} ({item.value})
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="TOP COUNTRIES">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countryUsage} layout="vertical">
                <XAxis type="number" stroke="var(--text-muted)" fontSize={9} />
                <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={9} width={72} tick={{ fontFamily: 'Space Mono' }} />
                <Tooltip content={<WarmTooltip />} />
                <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Visitors" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* ── 5. Captures Log Table ── */}
        <section className="card p-6 flex flex-col gap-4">
          <div className="film-label self-start">◼ RECENT CAPTURES</div>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Mode</th>
                  <th>Filter</th>
                  <th>Frame</th>
                  <th>Process</th>
                  <th>Date</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {captures.slice(0, 10).map(cap => (
                  <tr key={cap.id}>
                    <td style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'var(--text-muted)' }}>
                      {cap.id.slice(0, 8)}…
                    </td>
                    <td>
                      <span className="badge badge-default">{cap.type.toUpperCase()}</span>
                    </td>
                    <td>{cap.filter_used}</td>
                    <td>{cap.frame_used}</td>
                    <td style={{ fontFamily: 'Space Mono, monospace', fontSize: 11 }}>{cap.processing_time_ms} ms</td>
                    <td>{new Date(cap.created_at).toLocaleDateString()}</td>
                    <td>
                      {(() => {
                        const urls = cap.image_url.split('|');
                        const mainUrl = urls[0];
                        const boomerangUrl = urls[1] || null;
                        return (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <a
                              href={mainUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}
                            >
                              {cap.type === 'strip' ? 'Strip ↗' : 'Open ↗'}
                            </a>
                            {boomerangUrl && (
                              <a
                                href={boomerangUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--success)', fontWeight: 605, fontSize: 12 }}
                              >
                                Reel ↗
                              </a>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
                {captures.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                      No captures recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer
        className="py-6 px-6 text-center"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} SmileNest Photobooth Admin Panel
        </p>
      </footer>
    </div>
  );
}
