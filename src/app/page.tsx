'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Shield, ArrowRight, Volume2 } from 'lucide-react';
import { useAnalytics } from '@/context/AnalyticsContext';
import { playShutterSound, playFilmWindSound, playRevealSound } from '@/lib/audio';

/* ─── Film stocks & shutter speeds ─── */
const SHUTTER_SPEEDS = ['B', '1', '2', '4', '8', '15', '30', '60', '125', '250', '500'];
const FILM_ROLLS = ['GOLD 200', 'PORTRA 400', 'FUJI CHROME', 'HP5 B&W'];

/* ─── Framer-motion variants ─── */
const EASE_SPRING = [0.16, 1, 0.3, 1] as [number, number, number, number];
const EASE_BOUNCE = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

const stamp: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: (delay = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: EASE_SPRING, delay },
  }),
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: EASE_SPRING, delay },
  }),
};

const rotateIn: Variants = {
  hidden: { opacity: 0, rotate: -18, scale: 0.82 },
  visible: (delay = 0) => ({
    opacity: 1,
    rotate: 0,
    scale: 1,
    transition: { duration: 0.7, ease: EASE_BOUNCE, delay },
  }),
};

const slideUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_SPRING, delay },
  }),
};

/* ─── Paper particle data ─── */
const PAPER_PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${5 + Math.round((i * 379) % 90)}%`,
  top: `${5 + Math.round((i * 531) % 85)}%`,
  size: 3 + (i % 5),
  delay: (i * 0.4) % 6,
  dur: 6 + (i % 4),
  rotate: (i * 37) % 360,
}));

export default function LandingPage() {
  const router = useRouter();
  const { isMockMode } = useAnalytics();

  /* ── Camera states ── */
  const [shutterSpeed, setShutterSpeed] = useState('125');
  const [filmRoll, setFilmRoll] = useState('GOLD 200');
  const [shutterDepressed, setShutterDepressed] = useState(false);
  const [flash, setFlash] = useState(false);
  const [blackout, setBlackout] = useState(false);

  /* ── Lens parallax ── */
  const lensRef = useRef<HTMLDivElement>(null);
  const [glarePos, setGlarePos] = useState({ x: 0, y: 0 });
  const [lensHovered, setLensHovered] = useState(false);

  const handleLensMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!lensRef.current) return;
    const rect = lensRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setGlarePos({ x: dx * 12, y: dy * 10 });
  }, []);

  /* ── Shutter speed dial ── */
  const cycleShutterSpeed = () => {
    const i = SHUTTER_SPEEDS.indexOf(shutterSpeed);
    setShutterSpeed(SHUTTER_SPEEDS[(i + 1) % SHUTTER_SPEEDS.length]);
    playRevealSound();
  };

  /* ── Film roll ── */
  const cycleFilmRoll = () => {
    const i = FILM_ROLLS.indexOf(filmRoll);
    setFilmRoll(FILM_ROLLS[(i + 1) % FILM_ROLLS.length]);
    playRevealSound();
  };

  /* ── Trigger camera session ── */
  const triggerCameraSession = async () => {
    if (shutterDepressed) return;
    setShutterDepressed(true);
    playShutterSound();
    setBlackout(true);
    await new Promise(r => setTimeout(r, 120));
    setBlackout(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    setTimeout(() => playFilmWindSound(), 250);
    setTimeout(() => {
      setShutterDepressed(false);
      router.push('/photobooth');
    }, 850);
  };

  return (
    <div
      className="min-h-screen flex flex-col font-sans selection:bg-[#EADFCD] relative overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}
    >
      {/* ── Paper texture / vignette overlay ── */}
      <div className="paper-vignette pointer-events-none fixed inset-0 z-[1]" />

      {/* ── Floating paper particles ── */}
      <div className="pointer-events-none fixed inset-0 z-[2] overflow-hidden" aria-hidden="true">
        {PAPER_PARTICLES.map(p => (
          <div
            key={p.id}
            className="paper-particle absolute rounded-sm opacity-0"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size * 1.5,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              transform: `rotate(${p.rotate}deg)`,
            }}
          />
        ))}
      </div>

      {/* ── Golden light leak & golden glares ── */}
      <div className="pointer-events-none fixed inset-0 z-[2]" aria-hidden="true">
        <div className="light-leak-left" />
        <div className="light-leak-right" />
        <div className="golden-glare-1" />
        <div className="golden-glare-2" />
        <div className="golden-glare-3" />
      </div>

      {/* ── Film grain ── */}
      <div className="grain-overlay pointer-events-none fixed inset-0 z-[3]" aria-hidden="true" />

      {/* ══════════════════════════════════════
          HEADER
      ══════════════════════════════════════ */}
      <header className="relative z-10 w-full px-8 pt-7 pb-5 flex items-center justify-between max-w-[1200px] mx-auto">
        {/* Logo */}
        <motion.div custom={0.3} variants={stamp} initial="hidden" animate="visible">
          <Link href="/" className="flex flex-col select-none group">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[19px] font-medium tracking-[0.34em] font-serif text-[#4E3F35] uppercase select-none">
                S M I L E N E S T
              </span>
              <span className="text-[16px] text-[#D48D93] font-serif leading-none -mt-1 ml-0.5 select-none" aria-hidden="true">☺</span>
            </div>
            <span className="text-[6.5px] tracking-[0.32em] text-[#A08E82] font-extrabold font-mono mt-1.5 flex items-center gap-1 select-none">
              ANALOG STUDIO ✦ ESTD 2026
            </span>
          </Link>
        </motion.div>

        {/* Nav right */}
        <motion.nav
          custom={0.35}
          variants={stamp}
          initial="hidden"
          animate="visible"
          className="flex items-center gap-3 text-xs font-mono font-bold tracking-wider"
        >
          {isMockMode && (
            <span
              className="px-2 py-0.5 rounded text-[9px] font-bold"
              style={{
                background: 'var(--surface-2)',
                border: '1.5px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              SANDBOX
            </span>
          )}
          <Link href="/admin/dashboard" className="btn-admin">
            <Shield size={11} /> Admin
          </Link>
          <button
            onClick={triggerCameraSession}
            disabled={shutterDepressed}
            className="btn-primary text-[13px]"
          >
            📷 Enter Studio
          </button>
        </motion.nav>
      </header>

      {/* ══════════════════════════════════════
          MAIN HERO
      ══════════════════════════════════════ */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-2">

        {/* ── Label row above camera ── */}
        <motion.div
          custom={0.45}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-between w-full max-w-[860px] mb-3 px-1"
        >
          <div className="flex-1" />
          <div className="flex-1 flex justify-end">
            <span className="text-[8px] font-mono font-bold text-[#A08E82] tracking-wider flex items-center gap-1 opacity-70">
              📷 Rangefinder Assembly
            </span>
          </div>
        </motion.div>

        {/* ── Camera body ── */}
        <motion.div
          custom={0.6}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="camera-hero-wrap w-full max-w-[980px] relative"
        >
          {/* Camera outer box */}
          <div className="camera-body-outer group/camera">

            {/* ── TOP PLATE ── */}
            <div className="camera-metal-plate px-5 py-3 flex items-center justify-between z-10 relative overflow-hidden">

              {/* Aluminium sweep on hover */}
              <div className="camera-aluminium-sweep" />

              {/* Shutter speed dial */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[6.5px] font-bold text-[#554d42] font-mono tracking-widest">SPEED</span>
                <div
                  onClick={cycleShutterSpeed}
                  className="w-11 h-11 rounded-full camera-dial flex items-center justify-center relative cursor-pointer active:scale-95 transition-transform hover:shadow-lg"
                  style={{ transform: `rotate(${SHUTTER_SPEEDS.indexOf(shutterSpeed) * 32}deg)` }}
                  title="Adjust Shutter Speed"
                  role="button"
                  aria-label={`Shutter speed: 1/${shutterSpeed}`}
                >
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-[#D48D93] rounded-full" />
                  {/* Knurling marks */}
                  {[0,45,90,135,180,225,270,315].map(a => (
                    <div
                      key={a}
                      className="absolute w-[1px] h-1.5 bg-[#888]/40 rounded-full"
                      style={{ transform: `rotate(${a}deg) translateY(-17px)` }}
                    />
                  ))}
                </div>
                <span className="text-[6px] font-mono text-[#7a6e5f] mt-0.5">1/{shutterSpeed}</span>
              </div>

              {/* Brand / model text */}
              <div className="flex flex-col items-center leading-none">
                <span className="text-[9px] font-black tracking-[0.22em] text-[#4E3F35] font-mono">RANGEFINDER</span>
                <span className="text-[11px] font-extrabold text-[#554d42] font-mono mt-0.5 tracking-widest">M6 CLASSIC</span>
              </div>

              {/* Right cluster: meter, counter, shutter */}
              <div className="flex items-center gap-3">

                {/* Exposure meter */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[6.5px] font-bold text-[#554d42] font-mono tracking-widest">METER</span>
                  <div className="exposure-meter flex items-center justify-center w-14 h-8 relative">
                    <div className="absolute inset-x-1 top-0.5 flex justify-between text-[5px] text-stone-500 font-bold font-mono px-0.5">
                      <span>−</span><span>○</span><span>+</span>
                    </div>
                    <div className="exposure-meter-needle" />
                  </div>
                </div>

                {/* Film counter */}
                <motion.div
                  custom={1.2}
                  variants={rotateIn}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col items-center gap-0.5"
                >
                  <span className="text-[6.5px] font-bold text-[#554d42] font-mono tracking-widest">COUNT</span>
                  <div
                    className="film-counter-display counter-flicker"
                    style={{ textShadow: '0 0 6px rgba(212,141,147,0.9)' }}
                  >
                    04
                  </div>
                </motion.div>

                {/* Shutter plunger */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[6.5px] font-bold text-[#D48D93] font-mono tracking-widest">SHUTTER</span>
                  <button
                    onClick={triggerCameraSession}
                    disabled={shutterDepressed}
                    className={`camera-shutter-plunger ${shutterDepressed ? 'depressed' : ''} hover:brightness-110`}
                    title="Press Shutter to Start"
                    aria-label="Press shutter"
                  />
                </div>
              </div>
            </div>

            {/* ── LEATHER BODY — 30-40% thicker depth ── */}
            <div className="camera-leatherette px-8 py-9 flex items-center justify-between relative min-h-[400px]">

              {/* SMILE badge */}
              <div className="absolute left-7 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#D48D93] border border-white/20 flex items-center justify-center shadow-lg z-10 hover:scale-105 transition-transform">
                <span className="text-[7px] text-white font-black tracking-wider font-serif">SMILE</span>
              </div>

              {/* Strap lug left */}
              <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-8 bg-[#2a2420] rounded border border-[#3d342e] shadow-inner" />

              {/* ── LENS ASSEMBLY — nested 8 concentric depth rings ── */}
              <motion.div
                custom={0.9}
                variants={rotateIn}
                initial="hidden"
                animate="visible"
                className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20"
              >
                <div
                  ref={lensRef}
                  onMouseMove={handleLensMouseMove}
                  onMouseEnter={() => setLensHovered(true)}
                  onMouseLeave={() => { setLensHovered(false); setGlarePos({ x: 0, y: 0 }); }}
                  onClick={triggerCameraSession}
                  className="lens-assembly cursor-pointer"
                  title="Click to enter studio"
                  role="button"
                  aria-label="Click lens to enter studio"
                >
                  {/* Bezel Ring 1 (Outer chrome) */}
                  <div className="lens-ring-outer">
                    {/* Bezel Ring 2 (Dark shadow step) */}
                    <div className="lens-ring-step-1">
                      {/* Bezel Ring 3 (Bright reflection) */}
                      <div className="lens-ring-step-2">
                        {/* Bezel Ring 4 (Matte steel step) */}
                        <div className="lens-ring-step-3">
                          {/* Bezel Ring 5 (Knurled chrome) */}
                          <div className="lens-ring-mid">
                            {/* Bezel Ring 6 (Inner shadow bevel) */}
                            <div className="lens-ring-inner-bevel">
                              {/* Bezel Ring 7 (Black engraved) */}
                              <div className="lens-text-ring">
                                <svg viewBox="0 0 200 200" className="lens-text-svg" aria-hidden="true">
                                  <defs>
                                    <path id="topArc" d="M 20,100 A 80,80 0 0,1 180,100" />
                                    <path id="botArc" d="M 22,108 A 78,78 0 0,0 178,108" />
                                  </defs>
                                  <text className="lens-engraving" fontSize="12" letterSpacing="3" fill="#c8bfb0" fontFamily="monospace" fontWeight="700">
                                    <textPath href="#topArc">SMILENEST LENS  f/2  55mm</textPath>
                                  </text>
                                  <text className="lens-engraving" fontSize="11" letterSpacing="2.8" fill="#c8bfb0" fontFamily="monospace" fontWeight="700">
                                    <textPath href="#botArc" startOffset="3%">CAPTURE MORE THAN MOMENTS</textPath>
                                  </text>
                                </svg>

                                {/* Bezel Ring 8 (Glass outer bezel) */}
                                <div className="lens-glass-bezel">
                                  {/* Inner glass element */}
                                  <div className="lens-glass">

                                    {/* Pure CSS glass reflection — layered depth */}
                                    <div className="lens-mirror-base" />

                                    {/* Faint window reflection grid */}
                                    <svg className="lens-window-svg" viewBox="0 0 200 200" aria-hidden="true">
                                      <defs>
                                        <linearGradient id="sunRay" x1="0" y1="0" x2="1" y2="1">
                                          <stop offset="0%" stopColor="#ffd890" stopOpacity="0.85" />
                                          <stop offset="60%" stopColor="#ffb060" stopOpacity="0.25" />
                                          <stop offset="100%" stopColor="#ffb060" stopOpacity="0" />
                                        </linearGradient>
                                        <filter id="softBlur">
                                          <feGaussianBlur stdDeviation="2.5" />
                                        </filter>
                                        <filter id="heavyBlur">
                                          <feGaussianBlur stdDeviation="7" />
                                        </filter>
                                      </defs>

                                      {/* Sun ray light flare streaming from top-left */}
                                      <path d="M 0,0 L 200,140 L 200,200 L 0,90 Z" fill="url(#sunRay)" opacity="0.16" style={{ mixBlendMode: 'screen' }} />

                                      {/* Outer tree/leaves silhouette outside window */}
                                      <path d="M 12,25 Q 35,12 45,35 Q 65,30 75,50 Q 55,65 35,55 Z M 155,25 Q 180,20 185,40 Q 195,55 175,65 Z"
                                        fill="#1e2c1e" opacity="0.10" filter="url(#heavyBlur)" />

                                      {/* Cozy window grid framework */}
                                      {/* Main window border arch */}
                                      <path d="M 45,155 L 45,85 A 55,55 0 0,1 155,85 L 155,155 Z" stroke="rgba(255,245,225,0.26)" strokeWidth="3.5" fill="none" filter="url(#softBlur)" />
                                      {/* Horizontal window divider bar */}
                                      <line x1="45" y1="100" x2="155" y2="100" stroke="rgba(255,245,225,0.26)" strokeWidth="2.5" filter="url(#softBlur)" />
                                      <line x1="45" y1="125" x2="155" y2="125" stroke="rgba(255,245,225,0.22)" strokeWidth="2.5" filter="url(#softBlur)" />
                                      {/* Vertical window divider bar */}
                                      <line x1="100" y1="45" x2="100" y2="155" stroke="rgba(255,245,225,0.26)" strokeWidth="2.5" filter="url(#softBlur)" />

                                      {/* Ambient golden room glow behind the glass reflection */}
                                      <circle cx="100" cy="85" r="45" fill="rgba(255,210,120,0.18)" filter="url(#heavyBlur)" />
                                      {/* Tiny warm light source reflection (specular highlight of lightbulb) */}
                                      <circle cx="78" cy="68" r="3.5" fill="#ffffff" opacity="0.55" filter="url(#softBlur)" />
                                    </svg>

                                    {/* Deep concentric inner rings for lens depth */}
                                    <div className="lens-depth-ring lens-depth-ring-1" />
                                    <div className="lens-depth-ring lens-depth-ring-2" />
                                    <div className="lens-depth-ring lens-depth-ring-3" />

                                    {/* Multi-layered AR lens coatings and softbox specular arcs */}
                                    <div className="lens-coating-violet" />
                                    <div className="lens-coating-green" />
                                    <div className="lens-softbox-glare" />

                                    {/* Dark vignette inside glass */}
                                    <div className="lens-inner-vignette" />

                                    {/* Chromatic aberration ring */}
                                    <div className="lens-chromatic" />

                                    {/* Dust particles inside glass */}
                                    <div className="lens-dust" aria-hidden="true">
                                      {[...Array(6)].map((_, i) => (
                                        <div
                                          key={i}
                                          className="lens-dust-mote"
                                          style={{
                                            left: `${15 + i * 12}%`,
                                            top: `${20 + (i % 3) * 20}%`,
                                            width: `${1 + (i % 2)}px`,
                                            height: `${1 + (i % 2)}px`,
                                            animationDelay: `${i * 0.8}s`,
                                          }}
                                        />
                                      ))}
                                    </div>

                                    {/* Golden light streak */}
                                    <div
                                      className="lens-golden-streak"
                                      style={{
                                        transform: lensHovered
                                          ? `rotate(${-35 + glarePos.x * 0.5}deg) scaleX(${1 + Math.abs(glarePos.x) * 0.04})`
                                          : 'rotate(-35deg)',
                                      }}
                                    />

                                    {/* Primary glare — parallax on hover */}
                                    <div
                                      className="lens-glare-primary"
                                      style={{
                                        transform: `translate(${glarePos.x * 1.5}px, ${glarePos.y * 1.2}px)`,
                                        opacity: lensHovered ? 0.75 : 0.55,
                                      }}
                                    />

                                    {/* Secondary glare dot */}
                                    <div
                                      className="lens-glare-secondary"
                                      style={{
                                        transform: `translate(${-glarePos.x * 0.8}px, ${-glarePos.y * 0.7}px)`,
                                      }}
                                    />

                                    {/* Soft bloom center */}
                                    <div className="lens-bloom" />

                                    {/* Hover overlay */}
                                    <div className={`lens-hover-overlay ${lensHovered ? 'opacity-100' : 'opacity-0'}`}>
                                      <span className="text-[9px] font-bold tracking-[0.18em] text-[#FAF6EE] font-mono">PEER INSIDE</span>
                                      <span className="text-[8px] text-[#D48D93] font-mono mt-0.5 tracking-wider font-bold">CLICK TO SHOOT</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Strap lug right */}
              <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-8 bg-[#2a2420] rounded border border-[#3d342e] shadow-inner" />

              {/* Film roll badge */}
              <div
                onClick={cycleFilmRoll}
                className="absolute right-7 top-1/2 -translate-y-1/2 bg-[#12100e] border border-[#2e2923] rounded-lg px-3 py-2 flex flex-col items-center gap-0.5 cursor-pointer shadow-xl text-stone-300 font-mono select-none hover:border-[#D48D93] transition-colors z-10 group/film"
                title="Click to cycle film stock"
                role="button"
                aria-label={`Film roll: ${filmRoll}`}
              >
                <span className="text-[6px] text-[#A08E82] font-bold tracking-[0.2em] leading-none">FILM ROLL</span>
                <span className="text-[10px] font-bold text-[#D48D93] leading-none mt-0.5 group-hover/film:text-[#e8a0a6] transition-colors">{filmRoll}</span>
                <span className="text-[6px] text-stone-600 leading-none">36 EXP</span>
              </div>
            </div>

            {/* ── BOTTOM PLATE ── */}
            <div className="camera-metal-bottom px-6 py-2 flex items-center justify-between text-[7.5px] text-stone-500 font-bold font-mono tracking-wider relative overflow-hidden">
              <div className="camera-aluminium-sweep" />
              <span>COAT ASSEMBLY M6</span>
              <span>SMILE NEST LABS</span>
            </div>
          </div>{/* end camera-body-outer */}

          {/* Camera shelf shadow */}
          <div className="camera-shelf" />
        </motion.div>

        {/* ── Center CTA ── */}
        <motion.div
          custom={1.8}
          variants={slideUp}
          initial="hidden"
          animate="visible"
          className="mt-8 flex justify-center"
        >
          <button
            onClick={triggerCameraSession}
            disabled={shutterDepressed}
            className="btn-primary text-[15px] px-9 py-4 tracking-[0.08em]"
          >
            📷 ENTER STUDIO <ArrowRight size={15} className="inline -mt-0.5 ml-1" />
          </button>
        </motion.div>

        {/* ── Bottom three-column footer bar ── */}
        <motion.div
          custom={2.0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mt-10 w-full max-w-[900px] grid grid-cols-3 items-end pb-4 px-2"
        >
          {/* Left — sound status */}
          <div className="flex items-center gap-2 text-[8px] font-mono font-bold text-[#A08E82] tracking-widest uppercase leading-tight">
            <Volume2 size={11} className="text-[#A08E82] flex-shrink-0" />
            <span>Sound On For<br />The Full Experience</span>
          </div>

          {/* Center — tiny analog tagline */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[7.5px] font-mono font-bold text-[#A08E82] tracking-[0.22em] text-center">
              LOAD FILM ✦ FRAME YOUR STORY ✦ MAKE IT LAST
            </span>
          </div>

          {/* Right — scroll indicator */}
          <div className="flex flex-col items-end text-[8px] font-mono font-bold text-[#A08E82] tracking-widest uppercase">
            <span>Scroll To Explore</span>
            <span className="scroll-arrow mt-1">↓</span>
          </div>
        </motion.div>
      </main>

      {/* ══════════════════════════════════════
          FLASH / BLACKOUT
      ══════════════════════════════════════ */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-white z-[9999] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {blackout && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[9999] pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
