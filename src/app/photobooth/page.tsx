'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, FlipHorizontal, Clock, Download,
  Share2, ArrowLeft, RefreshCw, Layers, MonitorPlay,
  Film, CheckCircle, ExternalLink, Loader2, Settings
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

import { useWebcam } from '@/hooks/useWebcam';
import { useAnalytics } from '@/context/AnalyticsContext';
import { applyPreviewFilter, applyHeavyFilter, drawVignette, applyFilmImperfections, FilterType } from '@/lib/filters';
import { drawFrame, FrameCategory, FRAME_CATEGORIES } from '@/lib/frames';
import { playShutterSound, playFilmWindSound, playRevealSound } from '@/lib/audio';

type BoothMode = 'photo' | 'strip';

// Film stock labels for each filter
const FILTER_LABELS: Record<FilterType, string> = {
  'Normal':            'CLEAR SCREEN',
  'Kodak Gold 200':    'KODAK GOLD 200',
  'Portra 400':        'KODAK PORTRA 400',
  'Fuji Classic':      'FUJI CLASSIC CHROME',
  'Polaroid Fade':     'POLAROID 600 FADE',
  'Disposable Camera': 'DISPOSABLE CAM',
  'Black & White Film':'ILFORD HP5 MONO',
  'Vintage Sepia':     'KODAK EKTAR SEPIA',
};

const MODE_CONFIG: { id: BoothMode; icon: typeof Camera; label: string; sub: string }[] = [
  { id: 'photo',    icon: Camera,      label: 'Single',   sub: 'ONE SHOT' },
  { id: 'strip',    icon: Layers,      label: 'Strip',    sub: '4 FRAMES' },
];

export default function PhotoboothPage() {
  const {
    stream, permissionState, facingMode,
    startCamera, stopCamera, toggleCamera
  } = useWebcam();

  const { visitorId, sessionId, logCapture, logDownload, logQrShare } = useAnalytics();

  const videoRef        = useRef<HTMLVideoElement>(null);
  const previewCanvasRef= useRef<HTMLCanvasElement>(null);

  const [mode,              setMode]             = useState<BoothMode>('photo');
  const [selectedFilter,    setSelectedFilter]   = useState<FilterType>('Kodak Gold 200');
  const [selectedFrame,     setSelectedFrame]    = useState<FrameCategory>('None');
  const [countdownDuration, setCountdownDuration]= useState<number>(3);

  const [isCapturing,  setIsCapturing]  = useState(false);
  const [countdown,    setCountdown]    = useState<number | null>(null);
  const [flash,        setFlash]        = useState(false);
  const [capturedMedia,setCapturedMedia]= useState<string | null>(null);
  const [capturedBoomerang,setCapturedBoomerang]= useState<string | null>(null);
  const [capturedId,   setCapturedId]   = useState<string | null>(null);
  const [stripPhotos,  setStripPhotos]  = useState<string[]>([]);
  const [stripStep,    setStripStep]    = useState<number>(0);

  const [isSharing,      setIsSharing]     = useState(false);
  const [shareUrl,       setShareUrl]      = useState<string | null>(null);
  const [showShareModal, setShowShareModal]= useState(false);
  const [showSettings,   setShowSettings]  = useState(false);

  // --- Vintage Camera States ---
  const [authenticLook,       setAuthenticLook]       = useState<boolean>(true);
  const [stripCustomMessage,  setStripCustomMessage]  = useState<string>('MEMORIES');
  const [stripLocation,       setStripLocation]       = useState<string>('SMILE NEST LAB');
  const [stripDate,           setStripDate]           = useState<boolean>(true);
  const [shutterSpeed,        setShutterSpeed]        = useState<string>('1/125');
  const [shutterDepressed,    setShutterDepressed]    = useState<boolean>(false);
  const [viewfinderBlackout,  setViewfinderBlackout]  = useState<boolean>(false);
  const [isDeveloping,        setIsDeveloping]        = useState<boolean>(false);
  const [devMessage,          setDevMessage]          = useState<string>('');

  const shouldMirror  = facingMode === 'user';

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // ── Live Preview Loop ──
  useEffect(() => {
    let raf: number;
    const loop = () => {
      const video  = videoRef.current;
      const canvas = previewCanvasRef.current;
      if (!video || !canvas || video.paused || video.ended) { raf = requestAnimationFrame(loop); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { raf = requestAnimationFrame(loop); return; }

      if (canvas.width !== video.videoWidth) {
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
      }
      const { width: w, height: h } = canvas;
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      if (shouldMirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      applyPreviewFilter(ctx, selectedFilter);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
      if (selectedFilter !== 'Normal') drawVignette(ctx, w, h);
      drawFrame(ctx, w, h, selectedFrame);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [selectedFilter, selectedFrame, shouldMirror]);

  // ── Stitch photo strip ──
  const stitchPhotoStrip = (photos: string[]): Promise<string> =>
    new Promise(resolve => {
      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d')!;
      const W = 400, H = 300, PAD = 16, FOOTER = 80;
      canvas.width  = W + PAD * 2;
      canvas.height = H * 4 + PAD * 5 + FOOTER;

      // 1. Clean transparent background (to allow PNG rounded corners)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 2. Draw rounded paper strip card
      ctx.beginPath();
      ctx.roundRect(0, 0, canvas.width, canvas.height, 16);
      ctx.fillStyle = '#FCFBF9'; // warm off-white vintage paper
      ctx.fill();

      // 3. Add subtle vintage paper texture shading
      const paperGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      paperGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      paperGrad.addColorStop(1, 'rgba(214, 200, 184, 0.06)'); // subtle warm texture tint
      ctx.fillStyle = paperGrad;
      ctx.fill();

      let done = 0;
      const imgs = photos.map((src, i) => {
        const img = new Image();
        img.onload = () => {
          if (++done === 4) {
            imgs.forEach((im, idx) => {
              const dx = PAD, dy = PAD + idx * (H + PAD);
              // Draw the filtered + framed image
              ctx.drawImage(im, dx, dy, W, H);
              
              // Soft warm border around each printed photo box
              ctx.strokeStyle = '#D6C8B8';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(dx, dy, W, H);
            });

            // 4. Vintage print footer with custom text
            ctx.fillStyle = '#5A524A'; // typewriter ink grey
            ctx.font = 'bold 11px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`◼  ${(stripCustomMessage || 'SMILE NEST').toUpperCase()}  ◼`, canvas.width / 2, canvas.height - 52);

            // 5. Custom Location
            ctx.fillStyle = '#7C756E';
            ctx.font = '9px "Space Mono", monospace';
            ctx.fillText((stripLocation || 'SMILE NEST LAB').toUpperCase(), canvas.width / 2, canvas.height - 35);

            // 6. Typewriter timestamp (if enabled)
            if (stripDate) {
              const now = new Date();
              const timestamp = now.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }).toUpperCase() + '  ' + now.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
              }).toUpperCase();
              ctx.font = '8px "Space Mono", monospace';
              ctx.fillStyle = '#A67C52'; // accent color
              ctx.fillText(timestamp, canvas.width / 2, canvas.height - 20);
            }

            // 7. Apply organic paper/film look imperfections using custom engine
            if (authenticLook) {
              applyFilmImperfections(canvas, {
                grain: true,
                dust: true,
                scratches: true
              });
            } else {
              // Light fallback grain
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imgData.data;
              for (let j = 0; j < data.length; j += 4) {
                if (data[j + 3] === 0) continue; // skip transparent corners
                const noise = (Math.random() - 0.5) * 8;
                data[j]     = Math.max(0, Math.min(255, data[j] + noise));
                data[j + 1] = Math.max(0, Math.min(255, data[j + 1] + noise));
                data[j + 2] = Math.max(0, Math.min(255, data[j + 2] + noise));
              }
              ctx.putImageData(imgData, 0, 0);
            }

            resolve(canvas.toDataURL('image/png'));
          }
        };
        img.src = src;
        return img;
      });
    });

  // ── Compile GIF / Boomerang ──
  const compileGif = (frames: string[], boomerang = false): Promise<string> =>
    new Promise(async (resolve, reject) => {
      try {
        // @ts-ignore – gifshot has no @types package
        const gifshotModule = await import('gifshot');
        const gifshot = (gifshotModule as any).default || gifshotModule;
        const seq = boomerang ? [...frames, ...[...frames].reverse().slice(1, -1)] : frames;
        gifshot.createGIF({ images: seq, gifWidth: 640, gifHeight: 480, interval: 0.15, numWorkers: 2 },
          (obj: any) => obj.error ? reject(obj.error) : resolve(obj.image));
      } catch (e) { reject(e); }
    });

  // ── Single capture helper ──
  const captureFrame = async () => {
    const video = videoRef.current!;
    const raw   = document.createElement('canvas');
    raw.width   = video.videoWidth || 640;
    raw.height  = video.videoHeight || 480;
    const rCtx  = raw.getContext('2d')!;
    rCtx.save();
    if (shouldMirror) { rCtx.translate(raw.width, 0); rCtx.scale(-1, 1); }
    rCtx.drawImage(video, 0, 0, raw.width, raw.height);
    rCtx.restore();

    const out  = document.createElement('canvas');
    out.width  = raw.width;
    out.height = raw.height;
    const t0   = performance.now();

    // Always bake custom film stock coloring into high-fidelity image output
    applyHeavyFilter(raw, out, selectedFilter);

    // Apply procedural imperfections overlays (grain, light leaks, dust, scratches, soft focus, vignette)
    if (authenticLook) {
      applyFilmImperfections(out, {
        grain: true,
        lightLeaks: true,
        dust: true,
        scratches: true,
        vignette: true,
        softFocus: true
      });
    } else {
      // Soft vignette is standard on vintage cameras
      const fCtx = out.getContext('2d')!;
      drawVignette(fCtx, out.width, out.height);
    }

    // Apply birthday/wedding borders if selected
    drawFrame(out.getContext('2d')!, out.width, out.height, selectedFrame);

    return { dataUrl: out.toDataURL('image/png'), ms: Math.round(performance.now() - t0) };
  };

  const doCaptureInteraction = async () => {
    setShutterDepressed(true);
    playShutterSound();
    setViewfinderBlackout(true);
    
    // Viewfinder blackout (mirror slap) lasts 130ms, then flash initiates
    await new Promise(r => setTimeout(r, 130));
    setViewfinderBlackout(false);
    setFlash(true);
    
    // Flash overlay active for 250ms, Shutter plunger pops back up
    setTimeout(() => {
      setShutterDepressed(false);
      setFlash(false);
    }, 250);

    // Film winding gears click-whir right as screen returns
    setTimeout(() => {
      playFilmWindSound();
    }, 280);

    // Let the physical interaction finish before proceeding to canvas extraction
    await new Promise(r => setTimeout(r, 420));
  };
  const doConfetti = () => confetti({ particleCount: 80, spread: 70, origin: { y: 0.65 }, colors: ['#A67C52','#8A6542','#D6C8B8','#2B2B2B'] });

  // ── Countdown helper ──
  const runCountdown = (sec: number): Promise<void> =>
    new Promise(resolve => {
      setCountdown(sec);
      const iv = setInterval(() => {
        sec--;
        if (sec > 0) { setCountdown(sec); }
        else { clearInterval(iv); setCountdown(null); resolve(); }
      }, 1000);
    });

  const runFilmDevelopment = async () => {
    setIsDeveloping(true);
    const messages = [
      "Processing film...",
      "Developing your memories...",
      "Chamber chemistry reacting...",
      "Creating timeless moments..."
    ];
    
    setDevMessage(messages[0]);
    const interval = setInterval(() => {
      setDevMessage(prev => {
        const idx = messages.indexOf(prev);
        return messages[(idx + 1) % messages.length];
      });
    }, 1100);
    
    // Simulate mechanical development timing
    await new Promise(r => setTimeout(r, 3600));
    clearInterval(interval);
    playRevealSound();
    setIsDeveloping(false);
  };

  // ── Main Capture ──
  const triggerCapture = async () => {
    if (isCapturing || !videoRef.current) return;
    setIsCapturing(true);
    setCapturedMedia(null);
    setCapturedBoomerang(null);
    setCapturedId(null);
    setShareUrl(null);
    setStripPhotos([]);

    if (mode === 'photo') {
      await runCountdown(countdownDuration);
      await doCaptureInteraction();
      const { dataUrl, ms } = await captureFrame();
      
      // Start chemical darkroom process & database upload in parallel
      const devPromise = runFilmDevelopment();
      
      const uploadPromise = (async () => {
        try {
          const res = await fetch('/api/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'capture',
              visitorId,
              sessionId,
              type: 'photo',
              filterUsed: selectedFilter,
              frameUsed: selectedFrame,
              capturedMedia: dataUrl,
              processingTimeMs: ms
            })
          });
          if (res.ok) {
            return await res.json();
          }
        } catch (err) {
          console.error('Error saving capture:', err);
        }
        return null;
      })();

      const [, uploadResult] = await Promise.all([devPromise, uploadPromise]);

      if (uploadResult && uploadResult.capture) {
        setCapturedMedia(uploadResult.capture.image_url);
        setCapturedId(uploadResult.capture.id);
        doConfetti();
      } else {
        // Fallback: show local preview if network upload fails
        setCapturedMedia(dataUrl);
      }

    } else if (mode === 'strip') {
      const photos: string[] = [];
      for (let i = 1; i <= 4; i++) {
        setStripStep(i);
        await runCountdown(countdownDuration);
        await doCaptureInteraction();
        const { dataUrl } = await captureFrame();
        photos.push(dataUrl);
        setStripPhotos([...photos]);
        if (i < 4) await new Promise(r => setTimeout(r, 800));
      }
      setStripStep(0);
      
      // Start development overlay instantly
      const devPromise = runFilmDevelopment();

      const uploadPromise = (async () => {
        const t0 = performance.now();
        
        // Stitch the photo strip locally
        const localStripUrl = await stitchPhotoStrip(photos);

        // Compile the boomerang animation locally
        let localBoomerangUrl = '';
        try {
          localBoomerangUrl = await compileGif(photos, true);
        } catch (e) {
          console.error('Boomerang compile failed:', e);
        }

        const ms = Math.round(performance.now() - t0);

        try {
          const res = await fetch('/api/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'capture',
              visitorId,
              sessionId,
              type: 'strip',
              filterUsed: selectedFilter,
              frameUsed: selectedFrame,
              capturedMedia: localStripUrl,
              capturedBoomerang: localBoomerangUrl || null,
              processingTimeMs: ms
            })
          });

          if (res.ok) {
            return await res.json();
          }
        } catch (err) {
          console.error('Error saving strip capture:', err);
        }
        return { fallbackStrip: localStripUrl, fallbackBoomerang: localBoomerangUrl };
      })();

      const [, uploadResult] = await Promise.all([devPromise, uploadPromise]);

      if (uploadResult && uploadResult.capture) {
        const urls = uploadResult.capture.image_url.split('|');
        setCapturedMedia(urls[0]);
        setCapturedBoomerang(urls[1] || null);
        setCapturedId(uploadResult.capture.id);
        doConfetti();
      } else if (uploadResult && (uploadResult as any).fallbackStrip) {
        // Fallback: show local stitched images
        setCapturedMedia((uploadResult as any).fallbackStrip);
        setCapturedBoomerang((uploadResult as any).fallbackBoomerang || null);
      }
    }

    setIsCapturing(false);
  };

  const handleShare = async () => {
    if (!capturedId || isSharing) return;
    setIsSharing(true);
    try {
      await logQrShare(capturedId);
      setShareUrl(`${window.location.origin}/share/${capturedId}`);
      setShowShareModal(true);
    } catch (e) {
      console.error('Share failed', e);
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = (fmt: 'png' | 'jpg') => {
    if (!capturedMedia) return;
    
    if (fmt === 'jpg') {
      // Render transparency-to-white behind the image using a temporary canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#F8F5F0'; // clean page background color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        const a = document.createElement('a');
        a.download = `smilenest-${mode}-${Date.now()}.jpg`;
        a.href = canvas.toDataURL('image/jpeg', 0.95);
        a.click();
        if (capturedId) logDownload(capturedId, 'jpg');
      };
      img.src = capturedMedia;
    } else {
      const a = document.createElement('a');
      a.download = `smilenest-${mode}-${Date.now()}.png`;
      a.href = capturedMedia;
      a.click();
      if (capturedId) logDownload(capturedId, 'png');
    }
  };

  const handleDownloadBoomerang = () => {
    if (!capturedBoomerang) return;
    const a = document.createElement('a');
    a.download = `smilenest-boomerang-${Date.now()}.gif`;
    a.href = capturedBoomerang;
    a.click();
    if (capturedId) logDownload(capturedId, 'png');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

      {/* Flash */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-white z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* ── HEADER ── */}
      <header
        className="w-full px-5 py-3.5 flex items-center justify-between"
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

        <div className="flex items-center gap-3">
          <span
            className="hidden sm:inline text-xs font-bold tracking-widest uppercase"
            style={{ color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace' }}
          >
            PHOTO LAB
          </span>
          <button
            onClick={() => setShowSettings(s => !s)}
            className="p-2 rounded-lg transition-colors"
            style={{
              border: '1px solid var(--border)',
              background: showSettings ? 'var(--surface-2)' : 'transparent',
              color: 'var(--text-secondary)',
            }}
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* ── MAIN LAYOUT ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

        {/* ── LEFT PANEL (Mobile: collapsible via settings toggle) ── */}
        <aside
          className={`flex-col gap-4 ${showSettings ? 'flex' : 'hidden'} lg:flex`}
        >

          {/* Mode Selector */}
          <div className="card p-4 flex flex-col gap-3">
            <div className="film-label self-start">◼ MODE</div>
            <div className="grid grid-cols-2 gap-2">
              {MODE_CONFIG.map(({ id, icon: Icon, label, sub }) => (
                <button
                  key={id}
                  onClick={() => { setMode(id); setCapturedMedia(null); }}
                  className="mode-tab"
                  style={mode === id ? { background: 'var(--text-primary)', borderColor: 'var(--text-primary)', color: 'var(--bg)' } : {}}
                >
                  <Icon size={16} />
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: 'Space Mono, monospace',
                      letterSpacing: '0.06em',
                      opacity: 0.6,
                    }}
                  >{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Countdown */}
          <div className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="film-label self-start">◼ TIMER</div>
              <Clock size={13} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="flex gap-2">
              {[3, 5, 10].map(sec => (
                <button
                  key={sec}
                  onClick={() => setCountdownDuration(sec)}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    border: `1px solid ${countdownDuration === sec ? 'var(--accent)' : 'var(--border)'}`,
                    background: countdownDuration === sec ? 'var(--accent-light)' : 'var(--bg)',
                    color: countdownDuration === sec ? 'var(--accent)' : 'var(--text-secondary)',
                    fontFamily: 'Space Mono, monospace',
                  }}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="card p-4 flex flex-col gap-3">
            <div className="film-label self-start">◼ FILM STOCK</div>
            <div className="grid grid-cols-3 gap-1.5 max-h-60 overflow-y-auto">
              {(Object.keys(FILTER_LABELS) as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedFilter(f)}
                  className="film-chip"
                  style={selectedFilter === f ? {
                    borderColor: 'var(--accent)',
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                  } : {}}
                >
                  <span style={{ fontSize: 8, letterSpacing: '0.04em' }}>{FILTER_LABELS[f]}</span>
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace', fontSize: 9 }}>
              ◼ Double-pass pipeline bakes film stock chemistry
            </p>
          </div>

          {/* Frame Overlays */}
          <div className="card p-4 flex flex-col gap-3">
            <div className="film-label self-start">◼ FRAME</div>
            <div className="grid grid-cols-3 gap-1.5">
              {FRAME_CATEGORIES.map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedFrame(f)}
                  className="film-chip"
                  style={selectedFrame === f ? {
                    borderColor: 'var(--text-primary)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-primary)',
                  } : {}}
                >
                  <span style={{ fontSize: 8 }}>{f.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Print settings */}
          <div className="card p-4 flex flex-col gap-3">
            <div className="film-label self-start">◼ PRINT SETTINGS</div>
            
            {/* Authentic film look toggle */}
            <label className="flex items-center gap-2 cursor-pointer mt-1 select-none">
              <input 
                type="checkbox" 
                checked={authenticLook} 
                onChange={(e) => setAuthenticLook(e.target.checked)} 
                className="accent-[#A67C52] h-3.5 w-3.5 rounded border-stone-300"
              />
              <span className="text-[10px] font-bold text-stone-600 uppercase" style={{ fontFamily: 'Space Mono' }}>
                AUTHENTIC IMPERFECTIONS
              </span>
            </label>

            {/* Custom footer text */}
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold text-stone-500 uppercase" style={{ fontFamily: 'Space Mono' }}>Custom Message</span>
              <input 
                type="text"
                value={stripCustomMessage}
                onChange={(e) => setStripCustomMessage(e.target.value.slice(0, 24))}
                placeholder="Typewriter Footer"
                className="w-full text-xs p-1.5 rounded border border-stone-300 bg-white/50 focus:outline-none focus:border-[#A67C52] text-stone-700 font-mono"
              />
            </div>

            {/* Custom location */}
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-bold text-stone-500 uppercase" style={{ fontFamily: 'Space Mono' }}>Studio Location</span>
              <input 
                type="text"
                value={stripLocation}
                onChange={(e) => setStripLocation(e.target.value.slice(0, 24))}
                placeholder="Studio Lab"
                className="w-full text-xs p-1.5 rounded border border-stone-300 bg-white/50 focus:outline-none focus:border-[#A67C52] text-stone-700 font-mono"
              />
            </div>

            {/* Date toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={stripDate} 
                onChange={(e) => setStripDate(e.target.checked)} 
                className="accent-[#A67C52] h-3.5 w-3.5 rounded border-stone-300"
              />
              <span className="text-[9px] font-bold text-stone-500 uppercase" style={{ fontFamily: 'Space Mono' }}>
                PRINT TIMESTAMP
              </span>
            </label>
          </div>
        </aside>

        {/* ── CENTER: VIEWFINDER + CONTROLS ── */}
        <section className="flex flex-col gap-5 items-center justify-center">

          {/* Strip progress indicator */}
          {isCapturing && mode === 'strip' && stripStep > 0 && (
            <div className="w-full max-w-xl flex items-center gap-2 px-1">
              {[1,2,3,4].map(n => (
                <div
                  key={n}
                  className="flex-1 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: n <= stripStep ? 'var(--accent)' : 'var(--border)',
                  }}
                />
              ))}
              <span className="text-xs ml-1" style={{ color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace', fontSize: 9 }}>
                {stripStep}/4
              </span>
            </div>
          )}

          {/* Leica Rangefinder Camera Body Frame */}
          <div className="w-full max-w-xl rounded-[28px] overflow-hidden border border-[#A89885] shadow-2xl relative bg-[#3D352E] flex flex-col">
            
            {/* Camera Top Plate (Metallic bar) */}
            <div className="camera-metal-plate px-4 py-3 flex items-center justify-between z-10 relative">
              {/* Left group: Dial and logo */}
              <div className="flex items-center gap-3">
                {/* Decorative Shutter Speed Dial */}
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-bold text-[#554d42] mb-0.5" style={{ fontFamily: 'Space Mono' }}>SHUTTER</span>
                  <div 
                    onClick={() => {
                      const speeds = ['B', '1', '2', '4', '8', '15', '30', '60', '125', '250', '500'];
                      const nextIdx = (speeds.indexOf(shutterSpeed) + 1) % speeds.length;
                      setShutterSpeed(speeds[nextIdx]);
                      playRevealSound();
                    }}
                    className="w-10 h-10 rounded-full camera-dial flex items-center justify-center text-[8px] font-bold text-[#333] relative"
                    style={{ transform: `rotate(${['B', '1', '2', '4', '8', '15', '30', '60', '125', '250', '500'].indexOf(shutterSpeed) * 30}deg)` }}
                  >
                    <div className="absolute top-1 w-1 h-1.5 bg-[#ff3b30] rounded-full" />
                    <span className="sr-only">{shutterSpeed}</span>
                  </div>
                </div>
                
                {/* Brand Plate */}
                <div className="flex flex-col ml-1">
                  <div className="flex items-center gap-1 leading-none">
                    <span className="text-xs font-black tracking-wider text-[#2B2B2B]" style={{ fontFamily: 'Playfair Display, serif' }}>
                      SMILE<span className="text-[#a51c1c]">NEST</span>
                    </span>
                    <div className="w-2 h-2 rounded-full bg-[#a51c1c] shrink-0" />
                  </div>
                  <span className="text-[7px] tracking-widest text-[#776c5c] font-bold" style={{ fontFamily: 'Space Mono' }}>PHOTO LAB</span>
                </div>
              </div>

              {/* Center rangefinder safety text */}
              <div className="hidden sm:flex flex-col items-center">
                <span className="text-[7px] font-bold tracking-widest text-[#776c5c]" style={{ fontFamily: 'Space Mono' }}>RANGEFINDER</span>
                <span className="text-[8px] font-semibold text-[#554d42]">M6 CLASSIC</span>
              </div>

              {/* Right group: exposure, counter, physical button */}
              <div className="flex items-center gap-3">
                {/* Analog exposure needle */}
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-bold text-[#554d42] mb-0.5" style={{ fontFamily: 'Space Mono' }}>EXPOSURE</span>
                  <div className="exposure-meter flex items-center justify-center">
                    <div className="absolute inset-x-1 top-0.5 flex justify-between text-[5px] text-stone-500 font-bold">
                      <span>-</span>
                      <span>o</span>
                      <span>+</span>
                    </div>
                    <div className="exposure-meter-needle" />
                  </div>
                </div>

                {/* Rolling film counter wheel */}
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-bold text-[#554d42] mb-0.5" style={{ fontFamily: 'Space Mono' }}>COUNTER</span>
                  <div className="film-counter-display">
                    {mode === 'strip' ? (stripStep > 0 ? `0${stripStep}` : (stripPhotos.length > 0 ? '04' : '00')) : (capturedMedia ? '01' : '00')}
                  </div>
                </div>

                {/* Shutter Plunger */}
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-bold text-[#554d42] mb-0.5" style={{ fontFamily: 'Space Mono' }}>SHUTTER</span>
                  <button 
                    onClick={triggerCapture}
                    disabled={isCapturing || permissionState !== 'granted' || isDeveloping}
                    className={`camera-shutter-plunger ${shutterDepressed ? 'depressed' : ''}`}
                  />
                </div>
              </div>
            </div>

            {/* Main Camera Body (Leatherette vulcanite casing) */}
            <div className="camera-leatherette p-6 flex flex-col items-center justify-center relative">
              
              {/* Screen viewport (Lens Bezel) */}
              <div className="w-full aspect-[4/3] rounded-xl overflow-hidden relative lens-bezel bg-[#12100e]">
                
                {/* Viewfinder Glass reflections */}
                <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-lg z-10" />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/0 via-white/2 to-white/4 mix-blend-overlay z-10" />
                
                {/* Video elements */}
                <video ref={videoRef} className="hidden" playsInline muted />

                {/* Preview canvas */}
                <canvas
                  ref={previewCanvasRef}
                  className={`w-full h-full object-cover ${capturedMedia || isDeveloping ? 'hidden' : 'block'}`}
                  style={{ display: capturedMedia || isDeveloping ? 'none' : 'block' }}
                />

                {/* Viewfinder frame lines overlay */}
                {!capturedMedia && !isDeveloping && (
                  <div className="absolute inset-4 pointer-events-none border border-dashed border-white/10 rounded z-10 flex items-center justify-center">
                    <div className="w-4 h-4 border border-white/25 rounded-full" />
                    <div className="absolute top-2 right-2 text-[7px] font-mono text-white/40 tracking-widest">{shutterSpeed} SEC</div>
                    <div className="absolute bottom-2 right-2 text-[7px] font-mono text-white/40 tracking-widest">ISO {mode === 'strip' ? '400' : '200'}</div>
                    <div className="absolute top-2 left-2 text-[7px] font-mono text-white/40 tracking-widest">f/1.4</div>
                  </div>
                )}

                {/* Strip thumbnails (during active capture sequence) */}
                {!capturedMedia && !isDeveloping && mode === 'strip' && stripPhotos.length > 0 && (
                  <div className="absolute right-3 top-3 bottom-3 w-14 flex flex-col gap-1.5 justify-center z-15">
                    {stripPhotos.map((img, i) => (
                      <div
                        key={i}
                        className="aspect-[4/3] rounded border border-white/25 shadow-md overflow-hidden shrink-0"
                      >
                        <img src={img} className="w-full h-full object-cover" alt="" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Shutter blackout overlay */}
                <AnimatePresence>
                  {viewfinderBlackout && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black z-30 pointer-events-none"
                    />
                  )}
                </AnimatePresence>

                {/* Countdown display overlay */}
                <AnimatePresence mode="wait">
                  {countdown !== null && (
                    <motion.div
                      key={countdown}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center z-20"
                      style={{ background: 'rgba(0,0,0,0.55)' }}
                    >
                      <div className="countdown-number">{countdown}</div>
                      {mode === 'strip' && stripStep > 0 && (
                        <p className="mt-2 text-[8px] tracking-widest uppercase text-white/70 font-mono">
                          Shot {stripStep} of 4
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── FILM DEVELOPMENT SCREEN ── */}
                <AnimatePresence>
                  {isDeveloping && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 z-35 flex flex-col items-center justify-between darkroom-flicker p-6 text-center select-none"
                    >
                      {/* Film dust / scratches */}
                      <div className="darkroom-dust" />
                      <div className="film-scratch-overlay" />

                      {/* Top sprocket holes */}
                      <div className="w-full sprocket-hole-row absolute top-0 left-0 right-0 z-10" />

                      {/* Sliding film reel cells */}
                      <div className="flex-1 flex items-center justify-center overflow-hidden w-full relative py-8">
                        <div className="film-strip-scroller flex gap-4">
                          {[...Array(6)].map((_, index) => {
                            const photoSrc = stripPhotos[index % Math.max(1, stripPhotos.length)];
                            return (
                              <div key={index} className="film-frame-cell flex flex-col items-center p-2 rounded w-44 aspect-[4/3] shrink-0 border border-stone-850">
                                {photoSrc ? (
                                  <motion.img 
                                    initial={{ opacity: 0.1, filter: 'sepia(0.8) contrast(0.7) brightness(0.8)' }}
                                    animate={{ opacity: 0.9, filter: 'sepia(0) contrast(1) brightness(1)' }}
                                    transition={{ duration: 3.4, ease: 'easeIn' }}
                                    src={photoSrc} 
                                    className="w-full h-full object-cover rounded-sm border border-stone-900" 
                                    alt="developing" 
                                  />
                                ) : (
                                  <div className="w-full h-full bg-stone-950 flex items-center justify-center rounded-sm">
                                    <Film size={22} className="text-stone-800 animate-pulse" />
                                  </div>
                                )}
                                <div className="w-full flex items-center justify-between mt-1 px-1 text-[7px] text-[#cda270]/70 font-mono">
                                  <span>KODAK GOLD</span>
                                  <span>0{ (index % 4) + 1 }</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bottom sprocket holes */}
                      <div className="w-full sprocket-hole-row-bottom absolute bottom-0 left-0 right-0 z-10" />

                      {/* Chemical loading labels */}
                      <div className="mb-4 z-10">
                        <h4 className="text-xs font-bold tracking-widest text-[#f3ede2] uppercase" style={{ fontFamily: 'Space Mono' }}>
                          {devMessage}
                        </h4>
                        <p className="text-[8px] text-[#cda270] tracking-widest uppercase mt-0.5 font-mono">
                          Darkroom developer reacting with silver halide...
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Developed captures overlay */}
                <AnimatePresence>
                  {capturedMedia && !isDeveloping && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center z-20 p-4"
                      style={{ background: 'rgba(23, 21, 18, 0.93)' }}
                    >
                      {mode === 'strip' ? (
                        <div className="flex items-center justify-center gap-5 w-full h-full max-w-full px-2">
                          
                          {/* Photo Strip */}
                          <motion.div
                            initial={{ scale: 0.88, rotate: -2, opacity: 0 }}
                            animate={{ scale: 1, rotate: -1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                            className="flex flex-col items-center gap-1 shrink-0"
                          >
                            <span className="text-[8px] tracking-widest uppercase font-bold text-stone-400" style={{ fontFamily: 'Space Mono, monospace' }}>◼ PHOTO STRIP</span>
                            <div 
                              className="bg-[#FCFBF9] p-1.5 rounded-lg shadow-2xl flex flex-col items-center select-none"
                              style={{ border: '1px solid var(--border)', maxWidth: '120px' }}
                            >
                              <img 
                                src={capturedMedia} 
                                className="block w-full h-auto object-contain rounded" 
                                style={{ maxHeight: '270px' }}
                                alt="Photo Strip" 
                              />
                            </div>
                          </motion.div>

                          {/* Looping Boomerang in sprocket frame */}
                          {capturedBoomerang && (
                            <motion.div
                              initial={{ scale: 0.88, rotate: 2, opacity: 0 }}
                              animate={{ scale: 1, rotate: 1, opacity: 1 }}
                              transition={{ type: 'spring', stiffness: 280, damping: 20, delay: 0.1 }}
                              className="flex flex-col items-center gap-1"
                            >
                              <span className="text-[8px] tracking-widest uppercase font-bold text-stone-400" style={{ fontFamily: 'Space Mono, monospace' }}>◼ 35MM REEL</span>
                              
                              {/* Sprocket frame wrapper */}
                              <div className="w-[190px] bg-[#12100e] border-y-4 border-stone-800 rounded shadow-2xl flex flex-col relative select-none overflow-hidden">
                                <div className="h-4 w-full bg-[#12100e] bg-[repeating-linear-gradient(90deg,#fff_0px,#fff_4px,transparent_4px,transparent_11px)] opacity-50 border-b border-stone-900" />
                                
                                <div className="px-2 py-1 flex flex-col bg-stone-950 relative">
                                  <img 
                                    src={capturedBoomerang} 
                                    className="block w-full aspect-[4/3] object-cover rounded border border-stone-900" 
                                    style={{ maxHeight: '130px' }}
                                    alt="Boomerang Reel" 
                                  />
                                  <div className="flex items-center justify-between text-[7px] text-[#cda270] mt-1 font-mono tracking-wider">
                                    <span>SAFETY FILM 5063</span>
                                    <span>▲ 12A</span>
                                  </div>
                                </div>

                                <div className="h-4 w-full bg-[#12100e] bg-[repeating-linear-gradient(90deg,#fff_0px,#fff_4px,transparent_4px,transparent_11px)] opacity-50 border-t border-stone-900" />
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ) : (
                        // Single Photo polaroid print
                        <motion.div
                          initial={{ scale: 0.88, rotate: -1, opacity: 0 }}
                          animate={{ scale: 1, rotate: 0, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                          className="polaroid max-w-[80%] max-h-[85%]"
                          style={{ width: 'auto', padding: '12px 12px 42px' }}
                        >
                          <img src={capturedMedia} className="block max-w-full max-h-[50vh] object-contain rounded-sm" alt="capture" />
                          <div className="polaroid-label text-[10px] mt-2">
                            ◼  {selectedFilter.toUpperCase()}  ◼
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Camera Bottom Plate */}
            <div className="camera-metal-bottom px-6 py-2 flex items-center justify-between text-[8px] text-stone-600 font-bold z-10" style={{ fontFamily: 'Space Mono' }}>
              <span>LEICA M6 COAT DESIGN</span>
              <span className="hidden sm:inline">ANALOG SHUTTER TENSIONING</span>
              <span>SMILE NEST LABS</span>
            </div>
          </div>

          {/* ── CONTROL HUD ── */}
          <div className="w-full max-w-2xl flex items-center justify-center gap-6 py-2">
            {!capturedMedia ? (
              <>
                {/* Camera toggle */}
                <button
                  onClick={toggleCamera}
                  disabled={isCapturing || isDeveloping}
                  className="p-3 rounded-full transition-all"
                  style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)' }}
                  title="Flip Camera"
                >
                  <FlipHorizontal size={18} />
                </button>

                {/* Shutter */}
                <button
                  onClick={triggerCapture}
                  disabled={isCapturing || permissionState !== 'granted' || isDeveloping}
                  className="shutter-btn"
                  title="Take Photo"
                />

                {/* Settings toggle (mobile) */}
                <button
                  onClick={() => setShowSettings(s => !s)}
                  className="lg:hidden p-3 rounded-full transition-all"
                  style={{
                    border: `1px solid ${showSettings ? 'var(--accent)' : 'var(--border)'}`,
                    background: showSettings ? 'var(--accent-light)' : 'var(--surface)',
                    color: showSettings ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  <Settings size={18} />
                </button>
              </>
            ) : (
              <div className="flex flex-wrap gap-3 justify-center items-center">
                <button
                  onClick={() => { setCapturedMedia(null); setCapturedBoomerang(null); }}
                  className="btn-ghost py-2.5 px-4 text-sm"
                >
                  <RefreshCw size={14} /> Retake
                </button>

                {mode === 'strip' ? (
                  <>
                    <div className="flex gap-2">
                      <button onClick={() => handleDownload('png')} className="btn-primary py-2.5 px-4 text-sm" title="Download Printable Photo Strip (PNG)">
                        <Download size={14} /> Strip (PNG)
                      </button>
                      <button onClick={() => handleDownload('jpg')} className="btn-ghost py-2.5 px-4 text-sm" title="Download Printable Photo Strip (JPG)">
                        <Download size={14} /> Strip (JPG)
                      </button>
                    </div>
                    {capturedBoomerang && (
                      <button onClick={handleDownloadBoomerang} className="btn-primary py-2.5 px-4 text-sm" title="Download Looping Boomerang Animation (GIF)">
                        <Film size={14} /> Boomerang (GIF)
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload('png')} className="btn-primary py-2.5 px-4 text-sm">
                      <Download size={14} /> PNG
                    </button>
                    <button onClick={() => handleDownload('jpg')} className="btn-ghost py-2.5 px-4 text-sm">
                      <Download size={14} /> JPG
                    </button>
                  </div>
                )}

                <button
                  onClick={handleShare}
                  disabled={isSharing}
                  className="btn-accent"
                >
                  {isSharing ? (
                    <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                  ) : (
                    <><Share2 size={14} /> Share & QR</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Capture mode description */}
          {!capturedMedia && (
            <p className="text-xs text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
              {mode === 'photo' && `Press shutter · ${countdownDuration}s countdown · Single capture`}
              {mode === 'strip' && `4 automatic shots · ${countdownDuration}s each · Stitched vintage strip & boomerang`}
            </p>
          )}
        </section>
      </main>

      {/* ── SHARE / QR MODAL ── */}
      <AnimatePresence>
        {showShareModal && shareUrl && (
          <div
            className="fixed inset-0 flex items-center justify-center p-6 z-50"
            style={{ background: 'rgba(43,35,25,0.6)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className="max-w-sm w-full p-8 rounded-2xl flex flex-col gap-6 text-center"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}
            >
              <div className="flex flex-col items-center gap-2">
                <CheckCircle size={32} style={{ color: 'var(--success)' }} />
                <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Capture Shared!
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Scan the QR code on your mobile to view and download.
                </p>
              </div>

              <div
                className="p-4 rounded-xl mx-auto"
                style={{ border: '1px solid var(--border)', background: '#fff' }}
              >
                <QRCodeSVG value={shareUrl} size={192} level="M" includeMargin />
              </div>

              <div className="flex flex-col gap-2">
                <span className="film-label self-center">◼ SHARE LINK</span>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg truncate"
                  style={{
                    color: 'var(--accent)',
                    background: 'var(--accent-lighter)',
                    border: '1px solid rgba(166,124,82,0.2)',
                  }}
                >
                  {shareUrl} <ExternalLink size={11} />
                </a>
              </div>

              <button
                onClick={() => setShowShareModal(false)}
                className="btn-primary w-full"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
