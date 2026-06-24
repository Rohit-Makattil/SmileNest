'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Camera, Layers, Share2, Shield, Globe, Download,
  ChevronRight, Circle, Square, Triangle
} from 'lucide-react';
import { useAnalytics } from '@/context/AnalyticsContext';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as any, delay: i * 0.1 },
  }),
};

const FEATURES = [
  {
    icon: Layers,
    film: 'KODAK ULTRA MAX 400',
    title: 'Film Stock Filters',
    desc: 'Render 9 authentic analog styles in real time. Vintage, sepia, B&W, HDR and more — applied instantly to your camera preview. Heavy artistic modes compile post-capture for studio-quality results.',
  },
  {
    icon: Camera,
    film: 'FUJIFILM PRO 400H',
    title: 'Classic Photo Strips',
    desc: 'Take a sequence of 4 shots in true photobooth style. Our engine automatically stitches them onto a retro polaroid frame — ready to download and print.',
  },
  {
    icon: Share2,
    film: 'POLAROID 600',
    title: 'GIFs & QR Sharing',
    desc: 'Capture animated GIF bursts or ping-pong boomerangs. Generate a scannable QR code that links directly to your cloud-stored creation.',
  },
];

export default function LandingPage() {
  const { liveStats, isMockMode } = useAnalytics();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}
    >

      {/* ── HEADER ── */}
      <header
        className="w-full px-6 py-4 flex items-center justify-between max-w-6xl mx-auto"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--text-primary)' }}
          >
            <Camera className="h-4.5 w-4.5" style={{ color: 'var(--bg)' }} size={18} />
          </div>
          <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Smile<span style={{ color: 'var(--accent)' }}>Nest</span>
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          {isMockMode && (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontFamily: 'Space Mono, monospace',
              }}
            >
              SANDBOX
            </span>
          )}
          <Link href="/admin/dashboard" className="btn-ghost text-sm py-2 px-4">
            <Shield size={14} /> Admin
          </Link>
          <Link href="/photobooth" className="btn-primary text-sm py-2 px-5">
            Open Booth <ChevronRight size={14} />
          </Link>
        </nav>
      </header>

      {/* ── HERO ── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6">

        <section className="py-20 md:py-28 text-center max-w-3xl mx-auto">
          <motion.div
            custom={0} variants={fadeUp} initial="hidden" animate="visible"
            className="inline-flex items-center gap-2 mb-6"
          >
            <span
              className="film-label"
              style={{ fontFamily: 'Space Mono, monospace' }}
            >
              ◼ SMILENEST PHOTOBOOTH
            </span>
          </motion.div>

          <motion.h1
            custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.08]"
            style={{ color: 'var(--text-primary)', fontFamily: 'Playfair Display, serif' }}
          >
            Photography,<br />
            <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>reimagined.</em>
          </motion.h1>

          <motion.p
            custom={2} variants={fadeUp} initial="hidden" animate="visible"
            className="text-lg leading-relaxed mb-10 max-w-xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            Open your camera to apply classic film styles, capture polaroid strips,
            create animated GIFs and share instantly — all from your browser.
          </motion.p>

          <motion.div
            custom={3} variants={fadeUp} initial="hidden" animate="visible"
            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <Link href="/photobooth" className="btn-accent text-base px-8 py-3.5">
              <Camera size={16} /> Open Photobooth
            </Link>
            <a href="#features" className="btn-ghost text-base px-8 py-3.5">
              See Features
            </a>
          </motion.div>
        </section>

        {/* ── LIVE STATS ── */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="mb-20"
        >
          <div
            className="rounded-2xl p-8"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {/* Film strip decoration */}
            <div className="flex items-center gap-3 mb-6">
              <div className="film-label">◼ LIVE STATS</div>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Visitors', value: liveStats.totalVisitors.toLocaleString() },
                { label: 'Photos Captured', value: liveStats.totalCaptures.toLocaleString() },
                { label: 'Downloads', value: liveStats.totalDownloads.toLocaleString() },
                { label: 'Countries', value: liveStats.countriesCount.toString(), Icon: Globe },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="stat-tile">
                  <div className="stat-tile-value">
                    {Icon && <Icon size={20} style={{ color: 'var(--accent)', display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />}
                    {value}
                  </div>
                  <div className="stat-tile-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── FEATURES ── */}
        <section id="features" className="pb-24 scroll-mt-20">
          <div className="flex items-center gap-3 mb-12">
            <div className="film-label">◼ FEATURES</div>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, film, title, desc }, i) => (
              <motion.div
                key={title}
                custom={i} variants={fadeUp} initial="hidden" whileInView="visible"
                viewport={{ once: true }}
                className="card card-hover p-8 flex flex-col gap-5"
              >
                {/* Film stock label */}
                <div>
                  <span
                    className="inline-block text-[9px] font-bold tracking-widest uppercase mb-3 px-2 py-1 rounded-sm"
                    style={{
                      fontFamily: 'Space Mono, monospace',
                      background: 'var(--surface-2)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {film}
                  </span>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    <Icon size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {desc}
                </p>
                <Link
                  href="/photobooth"
                  className="mt-auto flex items-center gap-1.5 text-sm font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  Try it now <ChevronRight size={14} />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── CTA STRIP ── */}
        <section className="pb-24">
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: 'var(--text-primary)' }}
          >
            <p
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono, monospace' }}
            >
              ◼ READY TO SHOOT
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: 'var(--bg)', fontFamily: 'Playfair Display, serif' }}
            >
              Your moment awaits.
            </h2>
            <p className="mb-8 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              No app download. No sign-up. Just open your browser and start shooting.
            </p>
            <Link
              href="/photobooth"
              className="btn-accent inline-flex items-center gap-2 px-8 py-3.5 text-base"
            >
              <Camera size={16} /> Launch Photobooth
            </Link>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer
        className="py-8 px-6 text-center max-w-6xl mx-auto w-full"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded flex items-center justify-center"
              style={{ background: 'var(--text-primary)' }}
            >
              <Camera size={12} style={{ color: 'var(--bg)' }} />
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              SmileNest
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} SmileNest Photobooth. Built with Next.js &amp; Supabase.
          </p>
          <Link href="/admin/dashboard" className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Admin Portal
          </Link>
        </div>
      </footer>
    </div>
  );
}
