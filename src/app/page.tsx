'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Shield, ArrowRight, Sparkles, Smile, Heart
} from 'lucide-react';
import { useAnalytics } from '@/context/AnalyticsContext';
import { playShutterSound, playFilmWindSound, playRevealSound } from '@/lib/audio';

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any, delay: i * 0.12 },
  }),
};


const SHUTTER_SPEEDS = ['B', '1', '2', '4', '8', '15', '30', '60', '125', '250', '500'];
const FILM_ROLLS = ['GOLD 200', 'PORTRA 400', 'FUJI CHROME', 'HP5 B&W'];

export default function RedesignedLandingPage() {
  const router = useRouter();
  const { isMockMode } = useAnalytics();

  // --- Interactive Camera States ---
  const [shutterSpeed, setShutterSpeed] = useState('125');
  const [filmRoll, setFilmRoll] = useState('GOLD 200');
  const [shutterDepressed, setShutterDepressed] = useState(false);
  const [flash, setFlash] = useState(false);
  const [blackout, setBlackout] = useState(false);

  const cycleShutterSpeed = () => {
    const currentIdx = SHUTTER_SPEEDS.indexOf(shutterSpeed);
    const nextIdx = (currentIdx + 1) % SHUTTER_SPEEDS.length;
    setShutterSpeed(SHUTTER_SPEEDS[nextIdx]);
    playRevealSound();
  };

  const cycleFilmRoll = () => {
    const currentIdx = FILM_ROLLS.indexOf(filmRoll);
    const nextIdx = (currentIdx + 1) % FILM_ROLLS.length;
    setFilmRoll(FILM_ROLLS[nextIdx]);
    playRevealSound();
  };

  const triggerCameraSession = async () => {
    if (shutterDepressed) return;
    setShutterDepressed(true);
    playShutterSound();
    setBlackout(true);
    
    // Quick blackout for mirror slap
    await new Promise(r => setTimeout(r, 120));
    setBlackout(false);
    setFlash(true);
    
    // Clear flash
    setTimeout(() => {
      setFlash(false);
    }, 200);

    // Motor wind whir
    setTimeout(() => {
      playFilmWindSound();
    }, 250);

    // Route to photobooth
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
      {/* ── Header ── */}
      <header
        className="w-full px-6 py-6 flex items-center justify-between max-w-5xl mx-auto z-10"
        style={{ borderBottom: '1.5px solid var(--border)' }}
      >
        <Link href="/" className="flex flex-col select-none group">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-xl font-bold tracking-[0.2em] font-serif text-[#4E3F35]">
              SMILE<span className="text-[#D48D93] font-normal font-serif">NEST</span>
            </span>
            <Smile size={14} className="text-[#D48D93] group-hover:rotate-12 transition-transform duration-300" />
          </div>
          <span className="text-[7px] tracking-[0.28em] text-[#A08E82] font-bold font-mono mt-0.5 flex items-center gap-1">
            ANALOG STUDIO ✦ ESTD 2026
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-xs font-mono font-bold tracking-wider">
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
            className="btn-primary"
          >
            📸 Take Memories
          </button>
        </nav>
      </header>

      {/* ── MAIN STUDIO ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col gap-20 z-10">
        
        {/* ── THE INTERACTIVE CAMERA HERO ── */}
        <section className="flex flex-col items-center justify-center py-6 text-center relative">
          
          {/* Decorative Sparkly Stars in Background */}
          <div className="absolute top-10 left-10 md:left-24 text-[#D48D93] opacity-40 animate-pulse hidden sm:block">✦</div>
          <div className="absolute bottom-12 right-12 md:right-32 text-[#8CA88C] opacity-40 animate-pulse hidden sm:block">★</div>
          <div className="absolute top-28 right-8 text-[#A08E82] opacity-30 text-xs hidden sm:block">✦</div>

          <motion.div
            custom={0} variants={fadeUp} initial="hidden" animate="visible"
            className="inline-flex items-center gap-2 mb-8"
          >
            <span className="text-[9px] font-bold tracking-[0.25em] text-[#D48D93] font-mono bg-[#EADFCD]/40 px-3.5 py-1.5 rounded-full border border-[#D6C5B3]">
              ✦ SMILENEST PHOTO CABIN ✦
            </span>
          </motion.div>

          {/* Illustrated Rangefinder Camera Element */}
          <motion.div
            custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="w-full max-w-[440px] px-2 relative"
          >
            {/* Tiny camera doodle header */}
            <div className="absolute -top-4 right-10 text-[8px] font-mono font-bold text-[#A08E82] tracking-wider flex items-center gap-1 select-none">
              <Camera size={10} className="text-[#D48D93]" /> Rangefinder Assembly
            </div>

            {/* The Camera Box */}
            <div className="w-full rounded-[24px] overflow-hidden border border-[#D6C5B3] shadow-lg bg-[#3D352E] flex flex-col select-none relative">
              
              {/* Metallic top plate */}
              <div className="camera-metal-plate px-4 py-2.5 flex items-center justify-between z-10 relative">
                
                {/* Knurled Shutter Speed Dial */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[6px] font-bold text-[#554d42] font-mono" style={{ letterSpacing: '0.05em' }}>SPEED</span>
                  <div 
                    onClick={cycleShutterSpeed}
                    className="w-9 h-9 rounded-full camera-dial flex items-center justify-center text-[7.5px] font-bold text-[#333] relative cursor-pointer active:scale-95 transition-transform"
                    style={{ transform: `rotate(${SHUTTER_SPEEDS.indexOf(shutterSpeed) * 32}deg)` }}
                    title="Adjust Shutter Speed"
                  >
                    <div className="absolute top-0.5 w-0.5 h-1.5 bg-[#D48D93] rounded-full" />
                    <span className="sr-only">{shutterSpeed}</span>
                  </div>
                </div>
                
                {/* Brand / Model text */}
                <div className="flex flex-col items-center leading-none">
                  <span className="text-[8px] font-black tracking-[0.18em] text-[#4E3F35] font-mono">RANGEFINDER</span>
                  <span className="text-[9px] font-extrabold text-[#554d42] mt-0.5">M6 CLASSIC</span>
                </div>

                {/* Right cluster: exposure gauge, counter, plunger */}
                <div className="flex items-center gap-2.5">
                  {/* Exposure gauge */}
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[6px] font-bold text-[#554d42] font-mono">METER</span>
                    <div className="exposure-meter flex items-center justify-center w-11 h-6">
                      <div className="absolute inset-x-0.5 top-0 flex justify-between text-[4.5px] text-stone-500 font-bold font-mono">
                        <span>-</span>
                        <span>o</span>
                        <span>+</span>
                      </div>
                      <div className="exposure-meter-needle" />
                    </div>
                  </div>

                  {/* Red LED counter display */}
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[6px] font-bold text-[#554d42] font-mono">COUNT</span>
                    <div className="film-counter-display w-7 h-7 text-[10px] text-[#D48D93] border-[#A08E82] shadow-inner" style={{ textShadow: '0 0 4px rgba(212, 141, 147, 0.7)' }}>
                      04
                    </div>
                  </div>

                  {/* Red Plunger Shutter Button */}
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[6px] font-bold text-[#D48D93] font-mono">SHUTTER</span>
                    <button 
                      onClick={triggerCameraSession}
                      disabled={shutterDepressed}
                      className={`camera-shutter-plunger w-9 h-9 ${shutterDepressed ? 'depressed' : ''}`}
                      title="Press Shutter to Start"
                    />
                  </div>
                </div>
              </div>

              {/* vulcanite leather camera body */}
              <div className="camera-leatherette px-6 py-8 flex items-center justify-center relative min-h-[170px]">
                
                {/* Leica red circle branding logo */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#D48D93] border border-white/20 flex items-center justify-center shadow-md">
                  <span className="text-[7px] text-white font-black tracking-widest font-serif">SMILE</span>
                </div>

                {/* VIEW FINDER / LENS BEZEL */}
                <div 
                  onClick={triggerCameraSession}
                  className="w-36 h-36 rounded-full border-[10px] border-[#1a1918] outline-[3.5px] outline-[#D6C5B3] bg-[#12100e] overflow-hidden relative shadow-2xl cursor-pointer group"
                  title="Click Lens Viewfinder to Enter"
                >
                  {/* Glass Glare Reflections */}
                  <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-full z-10" />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/0 via-white/5 to-white/10 opacity-70 z-10 group-hover:opacity-90 transition-opacity" />
                  
                  {/* Preview image inside the lens */}
                  <img 
                    src="/cafe_polaroid.png" 
                    className="w-full h-full object-cover opacity-80 scale-105 group-hover:scale-100 transition-transform duration-700" 
                    alt="Viewfinder preview" 
                  />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center z-15">
                    <span className="text-[8px] font-bold tracking-[0.18em] text-[#FAF6EE] font-mono">PEER IN GLASS</span>
                    <span className="text-[7px] text-[#D48D93] font-mono mt-0.5 tracking-wider font-bold">CLICK TO SHOOT</span>
                  </div>
                </div>

                {/* Right side: Film Roll canister label indicator */}
                <div 
                  onClick={cycleFilmRoll}
                  className="absolute right-6 top-1/2 -translate-y-1/2 bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer shadow-md text-stone-300 font-mono select-none hover:border-[#D48D93] transition-colors"
                  title="Click to Cycle Film Stock"
                >
                  <span className="text-[5.5px] text-[#A08E82] font-bold tracking-widest leading-none">FILM ROLL</span>
                  <span className="text-[7.5px] font-bold text-[#D48D93] leading-none mt-0.5 truncate max-w-[65px]">{filmRoll}</span>
                  <span className="text-[5px] text-stone-500 leading-none">36 EXP</span>
                </div>
              </div>

              {/* bottom plate */}
              <div className="camera-metal-bottom px-6 py-1.5 flex items-center justify-between text-[7px] text-stone-600 font-bold font-mono">
                <span>COAT ASSEMBLY M6</span>
                <span>SMILE NEST LABS</span>
              </div>
            </div>

            {/* Oak wood mantle shelf decoration */}
            <div className="w-full h-3 bg-amber-900/10 border-b-2 border-[#D6C5B3]/40 rounded-full shadow-inner mt-2 flex items-center justify-center opacity-80" />
            <div className="w-[92%] h-1 bg-[#D6C5B3]/30 mx-auto rounded-b shadow-sm" />
          </motion.div>

          {/* Main Call to Actions */}
          <motion.div
            custom={3} variants={fadeUp} initial="hidden" animate="visible"
            className="mt-8 flex flex-wrap gap-4 justify-center items-center"
          >
            <button
              onClick={triggerCameraSession}
              disabled={shutterDepressed}
              className="btn-primary"
            >
              📸 Take Memories
            </button>
          </motion.div>
        </section>

      </main>

      {/* ── FOOTER / LAB PHILOSOPHY ── */}
      <footer
        className="w-full py-12 px-6 mt-16 text-center max-w-5xl mx-auto"
        style={{ borderTop: '1.5px solid var(--border)' }}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center select-none leading-none">
            <span className="text-lg font-bold tracking-[0.25em] font-serif text-[#4E3F35]">SMILE•NEST</span>
            <span className="text-[7px] tracking-[0.3em] font-bold font-mono text-[#A08E82] mt-1">ANALOG PHOTO STUDIO</span>
          </div>

          <p className="text-[11px] max-w-md italic leading-relaxed text-[#7A665A]" style={{ fontFamily: 'var(--font-serif)' }}>
            "We believe that a photograph is not just a digit on a screen, but a physical slice of time, developed with care. Step inside, pull the curtain, and let the gears wind."
          </p>

          <div className="flex items-center gap-4 text-[10px] font-mono text-[#A08E82] font-bold tracking-wider">
            <span>© {new Date().getFullYear()} LAB STUDIO</span>
            <span>·</span>
            <Link href="/admin/dashboard" className="hover:text-[#D48D93] transition-colors">ADMIN PORTAL</Link>
          </div>
        </div>
      </footer>

      {/* Fullscreen Flash Overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-white z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Viewfinder blackout simulation */}
      <AnimatePresence>
        {blackout && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
