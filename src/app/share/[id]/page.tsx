'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Download, Camera, ArrowLeft, Loader2, Calendar, Layers, Film } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CaptureData {
  id: string;
  visitor_id: string;
  type: 'photo' | 'strip' | 'boomerang';
  filter_used: string;
  frame_used: string;
  image_url: string;
  created_at: string;
}

// Film stock label map
const FILTER_LABELS: Record<string, string> = {
  'Normal':            'CLEAR',
  'Kodak Gold 200':    'KODAK GOLD 200',
  'Portra 400':        'PORTRA 400',
  'Fuji Classic':      'FUJI CLASSIC',
  'Polaroid Fade':     'POLAROID FADE',
  'Disposable Camera': 'DISPOSABLE CAM',
  'Black & White Film':'ILFORD HP5',
  'Vintage Sepia':     'VINTAGE SEPIA',
};

export default function ShareLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const [unwrappedParams, setUnwrappedParams] = useState<{ id: string } | null>(null);
  const [capture, setCapture]= useState<CaptureData | null>(null);
  const [loading, setLoading]= useState(true);
  const [error,   setError]  = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setUnwrappedParams(p)).catch(() => setError('Failed to load'));
  }, [params]);

  useEffect(() => {
    if (!unwrappedParams) return;
    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/share?id=${unwrappedParams.id}`);
        if (!res.ok) {
          setError('Capture not found or expired.');
          return;
        }
        const data = await res.json();
        if (data.error || !data.capture) {
          setError('Capture not found or expired.');
        } else {
          setCapture(data.capture as CaptureData);
        }
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    };
    fetch_();
  }, [unwrappedParams]);

  const handleDownload = async (url: string, filename: string, isJpg: boolean) => {
    if (!capture) return;
    try {
      await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', captureId: capture.id, format: isJpg ? 'jpg' : 'png' }),
      });
    } catch {}

    if (isJpg) {
      try {
        let objectUrl = url;
        if (!url.startsWith('data:')) {
          const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
          const res = await fetch(proxyUrl);
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
        }

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#F8F5F0'; // page background color
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          const a = document.createElement('a');
          a.download = filename;
          a.href = canvas.toDataURL('image/jpeg', 0.95);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          if (!url.startsWith('data:')) {
            URL.revokeObjectURL(objectUrl);
          }
        };
        img.src = objectUrl;
      } catch (err) {
        console.error('JPG download failed', err);
        window.open(url, '_blank');
      }
    } else {
      if (url.startsWith('data:')) {
        const a = document.createElement('a');
        a.download = filename;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
        const a = document.createElement('a');
        a.download = filename;
        a.href = proxyUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  const urls = capture ? capture.image_url.split('|') : [];
  const stripUrl = urls[0] || '';
  const boomerangUrl = urls[1] || null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <header
        className="w-full px-6 py-3.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <Link href="/" className="flex items-center gap-2 hover:opacity-75 transition-opacity">
          <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
          <div
            className="h-7 w-7 rounded flex items-center justify-center"
            style={{ background: 'var(--text-primary)' }}
          >
            <Camera size={14} style={{ color: 'var(--bg)' }} />
          </div>
          <span className="text-base font-semibold">
            Smile<span style={{ color: 'var(--accent)' }}>Nest</span>
          </span>
        </Link>
        <span
          className="text-xs font-bold tracking-widest uppercase hidden sm:inline"
          style={{ color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace' }}
        >
          SHARED CAPTURE
        </span>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-lg mx-auto w-full px-6 py-14 flex flex-col items-center justify-center gap-8">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Retrieving capture…</p>
          </div>
        ) : error || !capture ? (
          <div
            className="card p-8 text-center flex flex-col gap-5 w-full"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <Camera size={24} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <h2
                className="text-xl font-semibold mb-2"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Capture Not Found
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                This capture may have expired or been removed. Take a new one!
              </p>
            </div>
            <Link href="/photobooth" className="btn-accent">
              <Camera size={15} /> Open Photobooth
            </Link>
          </div>
        ) : (
          <>
            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="film-label mx-auto mb-3">◼ SHARED CAPTURE</div>
              <h1
                className="text-3xl font-bold"
                style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
              >
                Review Your Smile
              </h1>
            </motion.div>

            {/* Multi-Preview or Polaroid */}
            {capture.type === 'strip' ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
                {/* Photo Strip */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                  animate={{ opacity: 1, scale: 1, rotate: -1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 20 }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="text-[10px] tracking-widest uppercase font-bold text-stone-400" style={{ fontFamily: 'Space Mono, monospace' }}>◼ PHOTO STRIP</span>
                  <div 
                    className="bg-[#FCFBF9] p-2 rounded-lg shadow-xl flex flex-col items-center select-none"
                    style={{ border: '1px solid var(--border)', maxWidth: '160px' }}
                  >
                    <img 
                      src={stripUrl} 
                      className="block w-full h-auto object-contain rounded" 
                      style={{ maxHeight: '45vh' }}
                      alt="Photo Strip" 
                    />
                  </div>
                </motion.div>

                {/* Boomerang */}
                {boomerangUrl && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                    animate={{ opacity: 1, scale: 1, rotate: 1 }}
                    transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 20 }}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span className="text-[10px] tracking-widest uppercase font-bold text-stone-400" style={{ fontFamily: 'Space Mono, monospace' }}>◼ 35MM REEL</span>
                    
                    {/* Sprocket frame wrapper */}
                    <div className="w-[220px] bg-[#12100e] border-y-4 border-stone-800 rounded shadow-2xl flex flex-col relative select-none overflow-hidden">
                      {/* Top sprockets */}
                      <div className="h-4 w-full bg-[#12100e] bg-[repeating-linear-gradient(90deg,#fff_0px,#fff_4px,transparent_4px,transparent_11px)] opacity-50 border-b border-stone-900" />
                      
                      {/* Video clip area */}
                      <div className="px-2.5 py-1.5 flex flex-col bg-stone-950 relative">
                        <img 
                          src={boomerangUrl} 
                          className="block w-full aspect-[4/3] object-cover rounded border border-stone-900" 
                          style={{ maxHeight: '160px' }}
                          alt="Boomerang Reel" 
                        />
                        <div className="flex items-center justify-between text-[7.5px] text-[#cda270] mt-1.5 font-mono tracking-wider">
                          <span>SMILE SAFETY 5063</span>
                          <span>▲ 12A</span>
                        </div>
                      </div>

                      {/* Bottom sprockets */}
                      <div className="h-4 w-full bg-[#12100e] bg-[repeating-linear-gradient(90deg,#fff_0px,#fff_4px,transparent_4px,transparent_11px)] opacity-50 border-t border-stone-900" />
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              // Single Photo Polaroid
              <motion.div
                initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
                animate={{ opacity: 1, scale: 1, rotate: -1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 20 }}
                className="polaroid w-full max-w-sm"
              >
                <img
                  src={stripUrl}
                  className="w-full object-contain rounded-sm"
                  style={{ maxHeight: '50vh' }}
                  alt="SmileNest capture"
                />
                <div className="polaroid-label flex items-center justify-between px-2 mt-2">
                  <span>◼ SMILE NEST ◼</span>
                  <span style={{ opacity: 0.5, fontSize: 9 }}>{capture.type.toUpperCase()}</span>
                </div>
              </motion.div>
            )}

            {/* Metadata */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="w-full flex flex-col gap-4"
            >
              <div
                className="flex items-center justify-between px-4 py-3 rounded-xl text-xs"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar size={12} style={{ color: 'var(--accent)' }} />
                  {new Date(capture.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <span
                    style={{ fontFamily: 'Space Mono, monospace', fontSize: 9 }}
                  >
                    {FILTER_LABELS[capture.filter_used] ?? capture.filter_used}
                  </span>
                </div>
                <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <Layers size={12} style={{ color: 'var(--accent)' }} />
                  {capture.frame_used} frame
                </div>
              </div>

              {/* Download buttons */}
              {capture.type === 'strip' ? (
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDownload(stripUrl, `smilenest-strip-${capture.id}.png`, false)}
                      className="btn-primary flex-1"
                    >
                      <Download size={14} /> Strip (PNG)
                    </button>
                    <button
                      onClick={() => handleDownload(stripUrl, `smilenest-strip-${capture.id}.jpg`, true)}
                      className="btn-ghost flex-1"
                    >
                      <Download size={14} /> Strip (JPG)
                    </button>
                  </div>
                  {boomerangUrl && (
                    <button
                      onClick={() => handleDownload(boomerangUrl, `smilenest-boomerang-${capture.id}.gif`, false)}
                      className="btn-accent w-full justify-center"
                    >
                      <Film size={14} /> Download Boomerang (GIF)
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => handleDownload(stripUrl, `smilenest-photo-${capture.id}.png`, false)}
                    className="btn-primary flex-1"
                  >
                    <Download size={14} /> PNG
                  </button>
                  <button
                    onClick={() => handleDownload(stripUrl, `smilenest-photo-${capture.id}.jpg`, true)}
                    className="btn-ghost flex-1"
                  >
                    <Download size={14} /> JPG
                  </button>
                </div>
              )}

              <div className="divider" />

              <Link href="/photobooth" className="btn-accent w-full justify-center">
                <Camera size={15} /> Take Your Own Photo
              </Link>
            </motion.div>
          </>
        )}
      </main>

      <footer
        className="py-6 text-center"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} SmileNest Photobooth
        </p>
      </footer>
    </div>
  );
}
