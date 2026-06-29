'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, FlipHorizontal, Clock, Download,
  Share2, ArrowLeft, RefreshCw, Layers, MonitorPlay,
  Film, CheckCircle, ExternalLink, Loader2, Settings,
  CameraOff
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

import { useWebcam } from '@/hooks/useWebcam';
import { useAnalytics } from '@/context/AnalyticsContext';
import { applyPreviewFilter, applyHeavyFilter, drawVignette, applyFilmImperfections, FilterType, LIGHT_FILTERS } from '@/lib/filters';
import { drawFrame, FrameCategory, FRAME_CATEGORIES } from '@/lib/frames';
import { playShutterSound, playFilmWindSound, playRevealSound } from '@/lib/audio';

type BoothMode = 'photo' | 'strip';

const VintageScrew: React.FC = () => (
  <div className="w-2 h-2 rounded-full bg-gradient-to-tr from-stone-400 to-stone-200 border border-stone-600 shadow-inner flex items-center justify-center relative select-none">
    <div className="w-1 h-[1px] bg-stone-700/80 transform rotate-[45deg]" />
  </div>
);

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

/**
 * Helper to draw an image or video onto a canvas using "cover" fit.
 * This crops the source image/video to fit the destination canvas dimensions
 * without any squishing or stretching.
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  dW: number,
  dH: number
) {
  let sW = 0;
  let sH = 0;
  
  if (img instanceof HTMLVideoElement) {
    sW = img.videoWidth;
    sH = img.videoHeight;
  } else if (img instanceof HTMLCanvasElement) {
    sW = img.width;
    sH = img.height;
  } else {
    sW = img.width;
    sH = img.height;
  }
  
  if (!sW || !sH) {
    ctx.drawImage(img, 0, 0, dW, dH);
    return;
  }
  
  const sAspect = sW / sH;
  const dAspect = dW / dH;
  
  let sx = 0, sy = 0, sw = sW, sh = sH;
  
  if (sAspect > dAspect) {
    // Source is wider than destination - crop horizontally
    sw = sH * dAspect;
    sx = (sW - sw) / 2;
  } else {
    // Source is taller than destination - crop vertically
    sh = sW / dAspect;
    sy = (sH - sh) / 2;
  }
  
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dW, dH);
}

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
  const [showPrintDoor,  setShowPrintDoor] = useState(false);

  const [photoStack, setPhotoStack] = useState<{
    id: string;
    media: string;
    boomerang: string | null;
    type: BoothMode;
    filter: FilterType;
    frame: FrameCategory;
    rotation: number;
    xOffset: number;
    yOffset: number;
  }[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [cameraShake, setCameraShake] = useState<boolean>(false);

  // --- Vintage Camera States ---
  const [authenticLook,       setAuthenticLook]       = useState<boolean>(true);
  const [stripCustomMessage,  setStripCustomMessage]  = useState<string>('MEMORIES');
  const [stripLocation,       setStripLocation]       = useState<string>('SMILE NEST LAB');
  const [stripDate,           setStripDate]           = useState<boolean>(true);
  const [shutterSpeed,        setShutterSpeed]        = useState<string>('125');
  const [shutterDepressed,    setShutterDepressed]    = useState<boolean>(false);
  const [viewfinderBlackout,  setViewfinderBlackout]  = useState<boolean>(false);
  const [isDeveloping,        setIsDeveloping]        = useState<boolean>(false);
  const [devMessage,          setDevMessage]          = useState<string>('');

  const shouldMirror  = facingMode === 'user';

  const cycleFilter = () => {
    const nextIdx = (LIGHT_FILTERS.indexOf(selectedFilter) + 1) % LIGHT_FILTERS.length;
    setSelectedFilter(LIGHT_FILTERS[nextIdx]);
    playRevealSound();
  };

  const cycleFrame = () => {
    const nextIdx = (FRAME_CATEGORIES.indexOf(selectedFrame) + 1) % FRAME_CATEGORIES.length;
    setSelectedFrame(FRAME_CATEGORIES[nextIdx]);
    playRevealSound();
  };

  const selectPhotoFromStack = (photo: {
    id: string;
    media: string;
    boomerang: string | null;
    type: BoothMode;
    filter: FilterType;
    frame: FrameCategory;
    rotation: number;
    xOffset: number;
    yOffset: number;
  }) => {
    setActivePhotoId(photo.id);
    setCapturedMedia(photo.media);
    setCapturedBoomerang(photo.boomerang);
    setCapturedId(photo.id);
    playRevealSound();
  };

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
      
      if (!video || !canvas || video.ended) { 
        raf = requestAnimationFrame(loop); 
        return; 
      }
      
      // Auto-play the video if it gets paused by the browser (mobile optimization)
      if (video.paused && stream) {
        video.play().catch(() => {});
        raf = requestAnimationFrame(loop);
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) { raf = requestAnimationFrame(loop); return; }

      // Force canvas drawing buffer to be a constant high-quality 4:3 aspect ratio
      const targetWidth = 640;
      const targetHeight = 480;
      if (canvas.width !== targetWidth) {
        canvas.width  = targetWidth;
        canvas.height = targetHeight;
      }
      
      const { width: w, height: h } = canvas;
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      if (shouldMirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      applyPreviewFilter(ctx, selectedFilter);
      // Use cover fit to prevent distortion on any camera aspect ratio (e.g. mobile portrait)
      drawImageCover(ctx, video, w, h);
      ctx.restore();
      if (selectedFilter !== 'Normal') drawVignette(ctx, w, h);
      drawFrame(ctx, w, h, selectedFrame);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [selectedFilter, selectedFrame, shouldMirror, stream]);

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
            ctx.fillText(`✦  ${(stripCustomMessage || 'SMILE NEST').toUpperCase()}  ✦`, canvas.width / 2, canvas.height - 52);

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
              ctx.fillStyle = '#D48D93'; // accent color (Muted Pink)
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
    // Set to a high-resolution 4:3 canvas
    raw.width   = 1280;
    raw.height  = 960;
    const rCtx  = raw.getContext('2d')!;
    rCtx.save();
    if (shouldMirror) { rCtx.translate(raw.width, 0); rCtx.scale(-1, 1); }
    // Crop with cover fit to prevent aspect ratio distortion
    drawImageCover(rCtx, video, raw.width, raw.height);
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
    setCameraShake(true);
    
    // Viewfinder blackout (mirror slap) lasts 130ms, then flash initiates
    await new Promise(r => setTimeout(r, 130));
    setViewfinderBlackout(false);
    setFlash(true);
    
    // Flash overlay active for 250ms, Shutter plunger pops back up
    setTimeout(() => {
      setShutterDepressed(false);
      setFlash(false);
      setCameraShake(false);
    }, 250);

    // Film winding gears click-whir right as screen returns
    setTimeout(() => {
      playFilmWindSound();
    }, 280);

    // Let the physical interaction finish before proceeding to canvas extraction
    await new Promise(r => setTimeout(r, 420));
  };
  const doConfetti = () => confetti({ particleCount: 80, spread: 70, origin: { y: 0.65 }, colors: ['#D48D93','#8CA88C','#EADFCD','#4E3F35'] });

  // ── Countdown helper ──
  const runCountdown = (sec: number): Promise<void> =>
    new Promise(resolve => {
      setCountdown(sec);
      playRevealSound();
      const iv = setInterval(() => {
        sec--;
        if (sec > 0) {
          setCountdown(sec);
          playRevealSound();
        }
        else {
          clearInterval(iv);
          setCountdown(null);
          resolve();
        }
      }, 1000);
    });

  const runFilmDevelopment = async () => {
    setIsDeveloping(true);
    
    // Play darkroom winding mechanical sound ticking loop
    playFilmWindSound();
    const soundInterval = setInterval(() => {
      playFilmWindSound();
    }, 700);

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
    }, 1000);
    
    // Simulate mechanical development timing
    await new Promise(r => setTimeout(r, 3600));
    clearInterval(interval);
    clearInterval(soundInterval);
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

      const finalMedia = uploadResult?.capture?.image_url || dataUrl;
      const finalId = uploadResult?.capture?.id || String(Date.now());

      const newPhoto = {
        id: finalId,
        media: finalMedia,
        boomerang: null,
        type: 'photo' as BoothMode,
        filter: selectedFilter,
        frame: selectedFrame,
        rotation: (Math.random() - 0.5) * 6,
        xOffset: (Math.random() - 0.5) * 15,
        yOffset: (Math.random() - 0.5) * 15,
      };

      setPhotoStack(prev => [...prev, newPhoto]);
      setActivePhotoId(finalId);

      setCapturedMedia(finalMedia);
      setCapturedId(finalId);
      setCapturedBoomerang(null);
      doConfetti();

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

      let finalMedia = '';
      let finalBoomerang = '';
      let finalId = '';

      if (uploadResult && uploadResult.capture) {
        const urls = uploadResult.capture.image_url.split('|');
        finalMedia = urls[0];
        finalBoomerang = urls[1] || '';
        finalId = uploadResult.capture.id;
      } else if (uploadResult && (uploadResult as any).fallbackStrip) {
        finalMedia = (uploadResult as any).fallbackStrip;
        finalBoomerang = (uploadResult as any).fallbackBoomerang || '';
        finalId = String(Date.now());
      }

      const newPhoto = {
        id: finalId,
        media: finalMedia,
        boomerang: finalBoomerang || null,
        type: 'strip' as BoothMode,
        filter: selectedFilter,
        frame: selectedFrame,
        rotation: (Math.random() - 0.5) * 6,
        xOffset: (Math.random() - 0.5) * 15,
        yOffset: (Math.random() - 0.5) * 15,
      };

      setPhotoStack(prev => [...prev, newPhoto]);
      setActivePhotoId(finalId);

      setCapturedMedia(finalMedia);
      setCapturedId(finalId);
      setCapturedBoomerang(finalBoomerang || null);
      doConfetti();
    }

    setIsCapturing(false);
  };

  const handleReset = () => {
    setCapturedMedia(null);
    setCapturedBoomerang(null);
    setCapturedId(null);
    setPhotoStack([]);
    setStripPhotos([]);
  };

  const handleShare = async () => {
    const activePhoto = photoStack.find(p => p.id === activePhotoId);
    if (!activePhoto || isSharing) return;
    setIsSharing(true);
    try {
      await logQrShare(activePhoto.id);
      const url = `${window.location.origin}/share/${activePhoto.id}`;
      setShareUrl(url);
      
      // Use native sharing sheet on mobile platforms if supported
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'My SmileNest Capture',
            text: 'Check out my photobooth capture!',
            url: url
          });
          setIsSharing(false);
          return;
        } catch (shareErr) {
          console.warn('Native share dismissed or failed, falling back to modal:', shareErr);
        }
      }
      
      setShowShareModal(true);
    } catch (e) {
      console.error('Share failed', e);
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async (fmt: 'png' | 'jpg') => {
    const activePhoto = photoStack.find(p => p.id === activePhotoId);
    if (!activePhoto) return;
    const media = activePhoto.media;
    const filename = `smilenest-${activePhoto.type}-${Date.now()}.${fmt}`;
    
    try {
      await logDownload(activePhoto.id, fmt);
    } catch {}

    if (fmt === 'jpg') {
      try {
        let objectUrl = media;
        if (!media.startsWith('data:')) {
          const proxyUrl = `/api/download?url=${encodeURIComponent(media)}&filename=${encodeURIComponent(filename)}`;
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
          ctx.fillStyle = '#FAF6EE'; // clean page background color
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          
          const a = document.createElement('a');
          a.download = filename;
          a.href = canvas.toDataURL('image/jpeg', 0.95);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          if (!media.startsWith('data:')) {
            URL.revokeObjectURL(objectUrl);
          }
        };
        img.src = objectUrl;
      } catch (err) {
        console.error('JPG download failed', err);
        window.open(media, '_blank');
      }
    } else {
      if (media.startsWith('data:')) {
        const a = document.createElement('a');
        a.download = filename;
        a.href = media;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const proxyUrl = `/api/download?url=${encodeURIComponent(media)}&filename=${encodeURIComponent(filename)}`;
        const a = document.createElement('a');
        a.download = filename;
        a.href = proxyUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  const handleDownloadBoomerang = () => {
    const activePhoto = photoStack.find(p => p.id === activePhotoId);
    if (!activePhoto || !activePhoto.boomerang) return;
    const boomerang = activePhoto.boomerang;
    const filename = `smilenest-boomerang-${Date.now()}.gif`;

    try {
      logDownload(activePhoto.id, 'png');
    } catch {}

    if (boomerang.startsWith('data:')) {
      const a = document.createElement('a');
      a.download = filename;
      a.href = boomerang;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const proxyUrl = `/api/download?url=${encodeURIComponent(boomerang)}&filename=${encodeURIComponent(filename)}`;
      const a = document.createElement('a');
      a.download = filename;
      a.href = proxyUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
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
            onClick={() => setShowPrintDoor(s => !s)}
            className="p-2 rounded-lg transition-colors"
            style={{
              border: '1px solid var(--border)',
              background: showPrintDoor ? 'var(--surface-2)' : 'transparent',
              color: 'var(--text-secondary)',
            }}
            title="Open Print Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* ── MAIN LAYOUT ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col items-center justify-center gap-6">

        {/* Strip progress indicator */}
        {isCapturing && mode === 'strip' && stripStep > 0 && (
          <div className="w-full max-w-6xl xl:max-w-7xl flex items-center gap-2 px-1">
            {[1, 2, 3, 4].map(n => (
              <div
                key={n}
                className="flex-1 h-1.5 rounded-full transition-all duration-300"
                style={{
                  background: n <= stripStep ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ))}
            <span className="text-xs ml-1 font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {stripStep}/4
            </span>
          </div>
        )}

        {/* Leica Rangefinder Camera Body Frame */}
        <motion.div
          animate={cameraShake ? {
            x: [0, -3, 3, -3, 3, -1.5, 1.5, 0],
            y: [0, 2.5, -2.5, 2.5, -2.5, 1, -1, 0]
          } : {}}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="w-full max-w-6xl xl:max-w-7xl rounded-[28px] overflow-hidden border border-[#A89885] shadow-2xl relative bg-[#3D352E] flex flex-col"
        >
          
          {/* Camera Top Plate (Metallic bar) */}
          <div className="camera-metal-plate px-6 py-4.5 flex items-center justify-between z-10 relative border-b border-[#948674] select-none">
            
            {/* Symmetrical vintage screws on left/right corners */}
            <div className="absolute left-2.5 top-3.5"><VintageScrew /></div>
            <div className="absolute right-2.5 top-3.5"><VintageScrew /></div>

            {/* Left cluster: Dials */}
            <div className="flex items-center gap-6 xl:gap-8 pl-4">
              {/* Shutter Speed Dial */}
              <div className="flex flex-col items-center hidden sm:flex">
                <span className="text-[10.5px] font-bold text-[#554d42] mb-1 font-mono tracking-wider">SPEED</span>
                <div className="relative w-30 xl:w-34 h-14 flex items-center justify-center">
                  {/* Left Label (B) - Static */}
                  <span className={`text-[9.5px] xl:text-[10.5px] absolute left-0 font-bold font-mono transition-all ${shutterSpeed === 'B' ? 'text-[#D48D93] scale-105' : 'text-[#7A665A]/80'}`}>
                    BULB
                  </span>

                  {/* Rotating Dial */}
                  <div 
                    onClick={() => {
                      const speeds = ['B', '1', '2', '4', '8', '15', '30', '60', '125', '250', '500'];
                      const nextIdx = (speeds.indexOf(shutterSpeed) + 1) % speeds.length;
                      setShutterSpeed(speeds[nextIdx]);
                      playRevealSound();
                    }}
                    className="w-13 h-13 rounded-full camera-dial flex items-center justify-center text-[9px] font-bold text-[#333] relative active:scale-95 transition-transform z-10 animate-press"
                    style={{ transform: `rotate(${['B', '1', '2', '4', '8', '15', '30', '60', '125', '250', '500'].indexOf(shutterSpeed) * 32.7}deg)` }}
                    title="Adjust Shutter Speed"
                  >
                    <div className="absolute top-0.5 w-1 h-2.5 bg-[#4E3F35] rounded-full" />
                    <span className="sr-only">{shutterSpeed}</span>
                  </div>

                  {/* Right Label (Hi-Speed) - Static */}
                  <span className={`text-[9.5px] xl:text-[10.5px] absolute right-0 font-bold font-mono transition-all ${shutterSpeed === '500' ? 'text-[#D48D93] scale-105' : 'text-[#7A665A]/80'}`}>
                    1/500
                  </span>
                </div>
                {/* Active indicator window below */}
                <div className="mt-1 bg-stone-950/10 border border-stone-450/20 px-2 py-0.5 rounded text-[8.5px] xl:text-[9.5px] font-bold font-mono text-[#554d42] tracking-wide select-none">
                  {shutterSpeed === 'B' ? 'BULB MODE' : `1/${shutterSpeed} SEC`}
                </div>
              </div>

              {/* Mode Selector Dial */}
              <div className="flex flex-col items-center">
                <span className="text-[10.5px] font-bold text-[#554d42] mb-1 font-mono tracking-wider">MODE</span>
                <div className="relative w-32 xl:w-36 h-14 flex items-center justify-center">
                  {/* Left Label - Static */}
                  <span className={`text-[9.5px] xl:text-[10.5px] absolute left-0 font-bold font-mono transition-all ${mode === 'photo' ? 'text-[#D48D93] scale-105' : 'text-[#7A665A]/80'}`}>
                    SINGLE
                  </span>

                  {/* The rotating dial */}
                  <button
                    onClick={() => {
                      setMode(m => m === 'photo' ? 'strip' : 'photo');
                      setCapturedMedia(null);
                      playRevealSound();
                    }}
                    className="w-13 h-13 rounded-full camera-dial flex items-center justify-center text-[9px] font-bold text-[#333] relative active:scale-95 transition-transform z-10"
                    style={{ transform: `rotate(${mode === 'photo' ? -45 : 45}deg)` }}
                    title="Switch Mode"
                  >
                    <div className="absolute top-0.5 w-1 h-2.5 bg-[#4E3F35] rounded-full" />
                  </button>

                  {/* Right Label - Static */}
                  <span className={`text-[9.5px] xl:text-[10.5px] absolute right-0 font-bold font-mono transition-all ${mode === 'strip' ? 'text-[#D48D93] scale-105' : 'text-[#7A665A]/80'}`}>
                    STRIP
                  </span>
                </div>
                {/* Active indicator window below */}
                <div className="mt-1 bg-stone-950/10 border border-stone-450/20 px-2 py-0.5 rounded text-[8.5px] xl:text-[9.5px] font-bold font-mono text-[#554d42] tracking-wide select-none">
                  {mode === 'photo' ? '1 PHOTO' : '4-STRIP'}
                </div>
              </div>

              {/* Timer Selector Dial */}
              <div className="flex flex-col items-center">
                <span className="text-[10.5px] font-bold text-[#554d42] mb-1 font-mono tracking-wider">TIMER</span>
                <div className="relative w-32 xl:w-36 h-14 flex items-center justify-center">
                  {/* Left Label (3S) - Static */}
                  <span className={`text-[9.5px] xl:text-[10.5px] absolute left-1 top-4.5 font-bold font-mono transition-all ${countdownDuration === 3 ? 'text-[#D48D93] scale-105' : 'text-[#7A665A]/80'}`}>
                    3S
                  </span>
                  
                  {/* Top Label (5S) - Static */}
                  <span className={`text-[9.5px] xl:text-[10.5px] absolute top-0.5 left-1/2 -translate-x-1/2 font-bold font-mono transition-all ${countdownDuration === 5 ? 'text-[#D48D93] scale-105' : 'text-[#7A665A]/80'}`}>
                    5S
                  </span>

                  {/* The rotating dial */}
                  <button
                    onClick={() => {
                      const nextTimer = countdownDuration === 3 ? 5 : countdownDuration === 5 ? 10 : 3;
                      setCountdownDuration(nextTimer);
                      playRevealSound();
                    }}
                    className="w-13 h-13 rounded-full camera-dial flex items-center justify-center text-[9px] font-bold text-[#333] relative active:scale-95 transition-transform z-10"
                    style={{ transform: `rotate(${countdownDuration === 3 ? -45 : countdownDuration === 5 ? 0 : 45}deg)` }}
                    title="Set Countdown Timer"
                  >
                    <div className="absolute top-0.5 w-1 h-2.5 bg-[#4E3F35] rounded-full" />
                  </button>

                  {/* Right Label (10S) - Static */}
                  <span className={`text-[9.5px] xl:text-[10.5px] absolute right-1 top-4.5 font-bold font-mono transition-all ${countdownDuration === 10 ? 'text-[#D48D93] scale-105' : 'text-[#7A665A]/80'}`}>
                    10S
                  </span>
                </div>
                {/* Active indicator window below */}
                <div className="mt-1 bg-stone-950/10 border border-stone-450/20 px-2 py-0.5 rounded text-[8.5px] xl:text-[9.5px] font-bold font-mono text-[#554d42] tracking-wide select-none">
                  {countdownDuration}s DELAY
                </div>
              </div>

            </div>

            {/* Center Plate: Brand & Serial Number */}
            <div className="flex flex-col items-center select-none leading-none mx-2 shrink-0 hidden lg:flex">
              <span className="text-base sm:text-lg font-black tracking-[0.25em] text-[#4E3F35] font-serif leading-none">SMILE•NEST</span>
              <span className="text-[10px] tracking-[0.25em] text-[#7A665A] font-bold font-mono mt-1.5 leading-none">M6 CLASSIC</span>
            </div>

            {/* Right cluster: Gauge, battery, counter, plunger */}
            <div className="flex items-center gap-5 pr-4">
              {/* Battery Status Indicator */}
              <div className="flex flex-col items-center hidden sm:flex">
                <span className="text-[10.5px] font-bold text-[#554d42] mb-1 font-mono tracking-wider">BATTERY</span>
                <div className="w-11 h-11 rounded-full border border-[#948674] bg-[#1a1918] flex items-center justify-center relative shadow-inner overflow-hidden select-none">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06),transparent)]" />
                  <div className="w-3.5 h-3.5 rounded-full bg-[#8CA88C] shadow-[0_0_6px_#8CA88C] border border-[#6b856b]" />
                </div>
                <div className="mt-1 bg-stone-950/10 border border-stone-450/20 px-2 py-0.5 rounded text-[8.5px] xl:text-[9.5px] font-bold font-mono text-[#554d42] tracking-wide select-none opacity-80">
                  FULL
                </div>
              </div>

              {/* Analog exposure needle */}
              <div className="flex flex-col items-center hidden md:flex">
                <span className="text-[10.5px] font-bold text-[#554d42] mb-1 font-mono tracking-wider">EXPOSURE</span>
                <div className="exposure-meter flex items-center justify-center w-16 h-10">
                  <div className="absolute inset-x-1.5 top-0.5 flex justify-between text-[9px] text-stone-500 font-bold font-mono leading-none">
                    <span>-</span>
                    <span>o</span>
                    <span>+</span>
                  </div>
                  <div className="exposure-meter-needle animate-pulse" />
                </div>
                <div className="mt-1 bg-stone-950/10 border border-stone-450/20 px-2 py-0.5 rounded text-[8.5px] xl:text-[9.5px] font-bold font-mono text-[#554d42] tracking-wide select-none opacity-80">
                  AUTO
                </div>
              </div>

              {/* Rolling film counter wheel */}
              <div className="flex flex-col items-center">
                <span className="text-[10.5px] font-bold text-[#554d42] mb-1 font-mono tracking-wider">COUNTER</span>
                <div className="film-counter-display text-[12.5px] w-11 h-11 leading-none">
                  {mode === 'strip' ? (stripStep > 0 ? `0${stripStep}` : (stripPhotos.length > 0 ? '04' : '00')) : (capturedMedia ? '01' : '00')}
                </div>
                <div className="mt-1 bg-stone-950/10 border border-stone-450/20 px-2 py-0.5 rounded text-[8.5px] xl:text-[9.5px] font-bold font-mono text-[#554d42] tracking-wide select-none opacity-80">
                  SHOTS
                </div>
              </div>

              {/* Shutter Plunger */}
              <div className="flex flex-col items-center hidden sm:flex">
                <span className="text-[10.5px] font-bold text-[#D48D93] mb-1 font-mono tracking-wider">SHUTTER</span>
                <button 
                  onClick={triggerCapture}
                  disabled={isCapturing || permissionState !== 'granted' || isDeveloping || !!capturedMedia}
                  className={`camera-shutter-plunger w-13 h-13 xl:w-14 h-14 ${shutterDepressed ? 'depressed' : ''}`}
                  title="Take Photo"
                />
                <div className="mt-1 bg-stone-950/10 border border-stone-450/20 px-2 py-0.5 rounded text-[8.5px] xl:text-[9.5px] font-bold font-mono text-[#D48D93] tracking-wide select-none uppercase">
                  PRESS
                </div>
              </div>
            </div>
          </div>

          {/* Main Camera Body (Leatherette vulcanite casing) */}
          <div className="camera-leatherette p-4 md:p-6 grid grid-cols-2 md:flex md:flex-row items-center justify-between relative min-h-[300px] xl:min-h-[340px] gap-6 md:gap-4">
            
            {/* Left Side: Film stock selector knob */}
            <div className="flex flex-col items-center shrink-0 w-32 xl:w-36 col-span-1 order-2 md:order-1 justify-self-center">
              <div className="flex flex-col items-center select-none" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))' }}>
                <span className="text-xs xl:text-sm font-bold text-[#FAF6EE] mb-2 font-mono tracking-wider">FILM STOCK</span>
                <button
                  onClick={cycleFilter}
                  disabled={isCapturing || isDeveloping}
                  className="w-18 h-18 xl:w-20 h-20 rounded-full camera-dial flex items-center justify-center relative cursor-pointer active:scale-95 transition-transform"
                  style={{
                    transform: `rotate(${Object.keys(FILTER_LABELS).indexOf(selectedFilter) * 45}deg)`,
                    background: 'radial-gradient(circle at 40% 40%, #555 0%, #222 70%, #111 100%)',
                    border: '2.5px solid #8e8070'
                  }}
                  title="Click to Cycle Film Stock"
                >
                  <div className="absolute top-0.5 w-1 h-3 bg-[#D48D93] rounded-full border border-white/20" />
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#948674] to-[#dfd5c5] border border-stone-900 shadow-md flex items-center justify-center">
                    <div className="w-3.5 h-[1.5px] bg-stone-850" />
                  </div>
                </button>
                <div className="mt-3 bg-stone-950/90 border border-stone-800 rounded-lg px-2 py-1.5 flex items-center justify-center text-center shadow-inner w-28 xl:w-32 h-9 xl:h-10 overflow-hidden relative">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={selectedFilter}
                      initial={{ x: 25, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -25, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                      className="text-xs xl:text-sm font-black text-[#D48D93] tracking-wider font-mono select-none absolute"
                    >
                      {FILTER_LABELS[selectedFilter]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Center Column: Viewfinder (Lens Bezel) */}
            <div className="w-full max-w-[480px] xl:max-w-[520px] flex-1 flex flex-col items-center justify-center relative col-span-2 order-1 md:order-2 justify-self-center">
              
              {/* Screen Viewport circular lens frame */}
              <div className="w-full aspect-[4/3] rounded-[24px] md:rounded-full overflow-hidden relative border-[8px] md:border-[12px] border-[#1a1918] outline-[3px] md:outline-[4.5px] outline-[#D6C5B3] bg-[#12100e] shadow-2xl flex items-center justify-center group z-10">
                
                {/* Viewfinder Glass reflections */}
                <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-lg z-10" />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/0 via-white/2 to-white/4 mix-blend-overlay z-10" />
                
                {/* Video elements */}
                <video 
                  ref={videoRef} 
                  playsInline 
                  muted 
                  style={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    opacity: 0.01,
                    pointerEvents: 'none',
                    overflow: 'hidden'
                  }}
                />

                {/* Loading state overlay */}
                {permissionState === 'loading' && !capturedMedia && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1c1915] z-20 text-center p-4 darkroom-flicker">
                    <div className="darkroom-dust" />
                    <Film className="h-8 w-8 text-[#D48D93] animate-pulse mb-3" />
                    <p className="text-xs text-[#FAF6EE] font-mono tracking-wider uppercase">Loading Photo Lab...</p>
                  </div>
                )}

                {/* Denied / Error state overlay */}
                {permissionState === 'denied' && !capturedMedia && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950 z-20 text-center p-6">
                    <CameraOff className="h-10 w-10 text-stone-500 mb-3 animate-pulse" />
                    <p className="text-sm font-bold text-stone-200 mb-1" style={{ fontFamily: 'Space Mono' }}>CAMERA ACCESS BLOCKED</p>
                    <p className="text-[10px] text-stone-400 max-w-[240px] mb-4 font-mono">
                      Please check your browser permissions to allow camera access for SmileNest.
                    </p>
                    <button 
                      onClick={() => startCamera()}
                      className="btn-accent text-xs font-mono font-bold"
                    >
                      TRY AGAIN
                    </button>
                  </div>
                )}

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
                      style={{ background: 'rgba(0,0,0,0.65)' }}
                    >
                      <div className="relative w-28 h-36 bg-[#1F1915] rounded-2xl border border-[#D6C5B3]/25 shadow-2xl flex flex-col justify-center items-center overflow-hidden">
                        {/* Hinge Line */}
                        <div className="absolute inset-x-0 top-1/2 h-[1.5px] bg-black/60 z-10" />
                        
                        {/* Upper Half Backing */}
                        <div className="absolute inset-x-0 top-0 h-1/2 bg-[#2a221c] border-b border-black/30 overflow-hidden flex items-end justify-center">
                          <span className="text-6xl font-serif text-[#FAF6EE] translate-y-1/2 select-none leading-none mb-[-30px]">{countdown}</span>
                        </div>

                        {/* Lower Half Backing */}
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#1F1915] overflow-hidden flex items-start justify-center">
                          <span className="text-6xl font-serif text-[#FAF6EE] -translate-y-1/2 select-none leading-none mt-[-30px]">{countdown}</span>
                        </div>

                        {/* Folding Leaf */}
                        <motion.div
                          key={`leaf-${countdown}`}
                          initial={{ rotateX: 0 }}
                          animate={{ rotateX: -180 }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                          style={{ transformOrigin: "bottom center", backfaceVisibility: "hidden" }}
                          className="absolute inset-x-0 top-0 h-1/2 bg-[#241e19] border-b border-black/30 overflow-hidden flex items-end justify-center z-20"
                        >
                          <span className="text-6xl font-serif text-[#FAF6EE] translate-y-1/2 select-none leading-none mb-[-30px]">{countdown}</span>
                        </motion.div>
                      </div>

                      {mode === 'strip' && stripStep > 0 && (
                        <p className="mt-4 text-[9px] tracking-widest uppercase text-white/70 font-mono">
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

              </div> {/* Close circular lens frame */}

              {/* Flip camera release catch lock button */}
              <button
                onClick={toggleCamera}
                disabled={isCapturing || isDeveloping}
                className="absolute bottom-[-14px] w-6 h-6 rounded-full bg-gradient-to-tr from-[#7a6d5d] to-[#c7bcae] border-2 border-stone-900 flex items-center justify-center active:translate-y-[1px] cursor-pointer shadow-md z-20"
                title="Flip Camera Lens (Lens Release Lock)"
              >
                <div className="w-2 h-2 rounded-full bg-stone-900 border border-[#bfae9e]" />
              </button>

            </div> {/* Close Center Column div */}

            {/* Right Side: Frame selector knob */}
            <div className="flex flex-col items-center shrink-0 w-32 xl:w-36 col-span-1 order-3 justify-self-center">
              <div className="flex flex-col items-center select-none" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))' }}>
                <span className="text-xs xl:text-sm font-bold text-[#FAF6EE] mb-2 font-mono tracking-wider">FRAME TYPE</span>
                <button
                  onClick={cycleFrame}
                  disabled={isCapturing || isDeveloping}
                  className="w-18 h-18 xl:w-20 h-20 rounded-full camera-dial flex items-center justify-center relative cursor-pointer active:scale-95 transition-transform"
                  style={{
                    transform: `rotate(${FRAME_CATEGORIES.indexOf(selectedFrame) * 90}deg)`,
                    background: 'radial-gradient(circle at 40% 40%, #555 0%, #222 70%, #111 100%)',
                    border: '2.5px solid #8e8070'
                  }}
                  title="Click to Cycle Frame Overlay"
                >
                  <div className="absolute top-0.5 w-1 h-3 bg-[#8CA88C] rounded-full border border-white/20" />
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#948674] to-[#dfd5c5] border border-stone-900 shadow-md flex items-center justify-center">
                    <div className="w-[1.5px] h-4 bg-stone-850" />
                  </div>
                </button>
                <div className="mt-3 bg-stone-950/90 border border-stone-800 rounded-lg px-2 py-1.5 flex items-center justify-center text-center shadow-inner w-28 xl:w-32 h-9 xl:h-10 overflow-hidden relative">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={selectedFrame}
                      initial={{ x: 25, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -25, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                      className="text-xs xl:text-sm font-black text-[#8CA88C] tracking-wider font-mono select-none absolute"
                    >
                      {selectedFrame.toUpperCase()}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
            </div>

          </div>

            {/* Camera Bottom Plate */}
            <div className="camera-metal-bottom px-8 py-4.5 flex items-center justify-between text-[11px] text-stone-600 font-bold z-20 relative border-t border-[#948674] select-none">
              {/* Symmetrical vintage screws on left/right corners of bottom plate */}
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2"><VintageScrew /></div>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2"><VintageScrew /></div>

              <div className="pl-4">
                <span>LEICA M6 COAT DESIGN</span>
              </div>
              
              <div className="hidden sm:inline text-stone-500 tracking-wider">
                <span>ANALOG SHUTTER TENSIONING</span>
              </div>

              {/* Latch control */}
              <div className="flex items-center gap-2.5 pr-4 font-mono">
                <span className="text-[10.5px] text-[#554d42] font-mono tracking-wider">BASEPLATE LATCH</span>
                <button
                  onClick={() => {
                    setShowPrintDoor(s => !s);
                    playRevealSound();
                  }}
                  className="w-12 h-6 bg-stone-300 rounded-full border border-stone-500 flex items-center justify-start p-[1px] relative shadow-inner overflow-hidden active:scale-95 transition-transform"
                  title="Unlock Baseplate (Show Print Settings)"
                >
                  <motion.div
                    animate={{ rotate: showPrintDoor ? 90 : 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-4.5 h-4.5 bg-gradient-to-tr from-stone-450 to-stone-200 border border-stone-600 rounded-full flex items-center justify-center shadow"
                  >
                    <div className="w-[1.5px] h-3 bg-stone-750" />
                  </motion.div>
                </button>
              </div>
            </div>

            {/* Sliding Print Configuration Baseplate Drawer */}
            <AnimatePresence>
              {showPrintDoor && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                  className="overflow-hidden border-t border-[#D6C8B8]"
                  style={{ background: '#FAF6EE' }}
                >
                  <div className="p-6 flex flex-col md:flex-row gap-6 text-[#2B2B2B]">
                    {/* Left blueprint block: Inputs */}
                    <div className="flex-1 flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-[#D6C8B8] pb-1">
                        <span className="text-[10px] xl:text-xs font-bold tracking-widest text-[#A67C52] font-mono">✦ PRINT LABELS</span>
                      </div>
                      
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10.5px] xl:text-[11.5px] font-bold text-[#6B6B6B] uppercase font-mono tracking-wider">Strip Header Message</label>
                          <input
                            type="text"
                            maxLength={24}
                            value={stripCustomMessage}
                            onChange={(e) => setStripCustomMessage(e.target.value)}
                            placeholder="MEMORIES"
                            className="px-3 py-2 text-xs xl:text-sm rounded-lg border border-[#D6C8B8] bg-[#F4EFE7] text-[#2B2B2B] focus:outline-none focus:border-[#A67C52] font-mono uppercase"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10.5px] xl:text-[11.5px] font-bold text-[#6B6B6B] uppercase font-mono tracking-wider">Studio / Location Stamp</label>
                          <input
                            type="text"
                            maxLength={32}
                            value={stripLocation}
                            onChange={(e) => setStripLocation(e.target.value)}
                            placeholder="SMILE NEST LAB"
                            className="px-3 py-2 text-xs xl:text-sm rounded-lg border border-[#D6C8B8] bg-[#F4EFE7] text-[#2B2B2B] focus:outline-none focus:border-[#A67C52] font-mono uppercase"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right blueprint block: Options */}
                    <div className="flex-1 flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-[#D6C8B8] pb-1">
                        <span className="text-[10px] xl:text-xs font-bold tracking-widest text-[#A67C52] font-mono">✦ IMPERFECTIONS & FORMAT</span>
                      </div>

                      <div className="flex flex-col gap-3 mt-1">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={stripDate}
                            onChange={(e) => setStripDate(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-4.5 h-4.5 rounded border border-[#D6C8B8] bg-[#F4EFE7] flex items-center justify-center peer-checked:border-[#A67C52] peer-checked:bg-[#A67C52] transition-colors">
                            <svg className="w-3 h-3 text-[#FAF6EE] hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-xs xl:text-sm font-medium text-[#6B6B6B] peer-checked:text-[#2B2B2B] transition-colors">Include Date & Time Stamp</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={authenticLook}
                            onChange={(e) => setAuthenticLook(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-4.5 h-4.5 rounded border border-[#D6C8B8] bg-[#F4EFE7] flex items-center justify-center peer-checked:border-[#A67C52] peer-checked:bg-[#A67C52] transition-colors">
                            <svg className="w-3 h-3 text-[#FAF6EE] hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-xs xl:text-sm font-medium text-[#6B6B6B] peer-checked:text-[#2B2B2B] transition-colors">
                            Bake Authentic Film Imperfections
                          </span>
                        </label>
                        
                        <p className="text-[10px] xl:text-[11px] text-[#6B6B6B] leading-normal font-mono italic mt-1 bg-[#F4EFE7]/50 p-2.5 rounded-lg border border-[#D6C8B8]/60">
                          * Adds light leaks, dust grains, and hairline sprocket scratches to prints.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Wooden Desk Mat where developed photos stack */}
          <div className="w-full max-w-6xl xl:max-w-7xl bg-[#4E3F35] rounded-[24px] border-4 border-[#3D322A] p-8 shadow-2xl relative min-h-[440px] flex items-center justify-center overflow-hidden select-none mt-4">
            {/* Wood Grain Lines */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 4px, transparent 4px, transparent 20px)' }} />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/35 via-transparent to-black/15 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06)_0%,transparent_75%)] pointer-events-none" />

            <div className="relative w-full h-full flex items-center justify-center min-h-[300px]">
              {photoStack.length === 0 ? (
                <div className="flex flex-col items-center text-center opacity-30 gap-3 border-2 border-dashed border-[#FAF6EE]/15 p-10 rounded-2xl w-60">
                  <div className="w-16 h-24 border-2 border-dashed border-[#FAF6EE]/30 rounded-lg flex items-center justify-center">
                    <Camera className="w-6 h-6 text-[#FAF6EE]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold font-mono tracking-widest text-[#FAF6EE] uppercase">PRINT DESK</p>
                    <p className="text-[9px] font-mono text-[#FAF6EE] mt-1">Photos will eject and stack here</p>
                  </div>
                </div>
              ) : (
                photoStack.map((item, idx) => {
                  const isActive = activePhotoId === item.id;
                  if (item.type === 'photo') {
                    return (
                      <motion.div
                        key={item.id}
                        onClick={() => selectPhotoFromStack(item)}
                        initial={{ y: -260, opacity: 0, scale: 0.8, rotate: 0 }}
                        animate={{
                          y: 0,
                          x: item.xOffset,
                          rotate: item.rotation,
                          scale: isActive ? 1.05 : 0.95,
                          opacity: 1,
                          zIndex: isActive ? 50 : idx + 5
                        }}
                        whileHover={{ scale: isActive ? 1.08 : 0.98, transition: { duration: 0.15 } }}
                        transition={{ type: 'spring', stiffness: 120, damping: 15 }}
                        className="polaroid cursor-pointer absolute shadow-2xl bg-[#FFFDF8] border border-[#D6C8B8]"
                        style={{
                          padding: '12px 12px 36px',
                          width: '180px',
                          transformOrigin: 'center center'
                        }}
                      >
                        <img src={item.media} className="w-full aspect-[4/3] object-cover rounded-sm" alt="capture" />
                        <div className="polaroid-label text-[8px] mt-1.5 font-mono text-center tracking-widest text-[#7C756E]">
                          ✦ {item.filter.toUpperCase()} ✦
                        </div>
                      </motion.div>
                    );
                  } else {
                    return (
                      <div
                        key={item.id}
                        className="absolute flex items-center justify-center gap-4"
                        style={{
                          transform: `translate(${item.xOffset}px, ${item.yOffset}px)`,
                          zIndex: isActive ? 50 : idx + 5,
                          pointerEvents: 'none'
                        }}
                      >
                        <motion.div
                          onClick={(e) => { e.stopPropagation(); selectPhotoFromStack(item); }}
                          initial={{ y: -260, opacity: 0, scale: 0.8, rotate: 0 }}
                          animate={{
                            y: 0,
                            rotate: item.rotation - (isActive && item.boomerang ? 4 : 0),
                            scale: isActive ? 1.05 : 0.95,
                            opacity: 1
                          }}
                          whileHover={{ scale: isActive ? 1.08 : 0.98 }}
                          transition={{ type: 'spring', stiffness: 120, damping: 15 }}
                          className="cursor-pointer shadow-2xl bg-[#FCFBF9] p-2 rounded-lg flex flex-col items-center border border-[#D6C8B8] pointer-events-auto"
                          style={{
                            width: '110px',
                            transformOrigin: 'center center'
                          }}
                        >
                          <img src={item.media} className="w-full h-auto object-contain rounded max-h-[220px]" alt="Photo Strip" />
                        </motion.div>

                        {isActive && item.boomerang && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8, x: -30, rotate: 0 }}
                            animate={{ opacity: 1, scale: 1.05, x: 0, rotate: item.rotation + 6 }}
                            transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.1 }}
                            className="shadow-2xl bg-[#12100e] border-y-2 border-stone-850 rounded flex flex-col relative overflow-hidden pointer-events-auto"
                            style={{
                              width: '120px',
                              transformOrigin: 'center center'
                            }}
                          >
                            <div className="h-2 w-full bg-[#12100e] bg-[repeating-linear-gradient(90deg,#fff_0px,#fff_2px,transparent_2px,transparent_6px)] opacity-40 border-b border-stone-900" />
                            <div className="px-1 py-0.5 bg-stone-950">
                              <img src={item.boomerang} className="w-full aspect-[4/3] object-cover rounded border border-stone-900" alt="Boomerang" />
                              <div className="flex items-center justify-between text-[4px] text-[#cda270] mt-0.5 font-mono">
                                <span>SAFETY FILM</span>
                                <span>▲ 12A</span>
                              </div>
                            </div>
                            <div className="h-2 w-full bg-[#12100e] bg-[repeating-linear-gradient(90deg,#fff_0px,#fff_2px,transparent_2px,transparent_6px)] opacity-40 border-t border-stone-900" />
                          </motion.div>
                        )}
                      </div>
                    );
                  }
                })
              )}
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
                  onClick={() => setShowPrintDoor(s => !s)}
                  className="lg:hidden p-3 rounded-full transition-all"
                  style={{
                    border: `1px solid ${showPrintDoor ? 'var(--accent)' : 'var(--border)'}`,
                    background: showPrintDoor ? 'var(--accent-light)' : 'var(--surface)',
                    color: showPrintDoor ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                  title="Print Settings"
                >
                  <Settings size={18} />
                </button>
              </>
            ) : (
              <div className="flex flex-wrap gap-3 justify-center items-center">
                <button
                  onClick={handleReset}
                  className="btn-ghost"
                >
                  <RefreshCw size={14} /> Reset
                </button>

                {mode === 'strip' ? (
                  <>
                    <div className="flex gap-2">
                      <button onClick={() => handleDownload('png')} className="btn-primary" title="Download Printable Photo Strip (PNG)">
                        <Download size={14} /> Strip (PNG)
                      </button>
                      <button onClick={() => handleDownload('jpg')} className="btn-ghost" title="Download Printable Photo Strip (JPG)">
                        <Download size={14} /> Strip (JPG)
                      </button>
                    </div>
                    {capturedBoomerang && (
                      <button onClick={handleDownloadBoomerang} className="btn-primary" title="Download Looping Boomerang Animation (GIF)">
                        <Film size={14} /> Boomerang (GIF)
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload('png')} className="btn-primary">
                      <Download size={14} /> PNG
                    </button>
                    <button onClick={() => handleDownload('jpg')} className="btn-ghost">
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
                <span className="film-label self-center">✦ SHARE LINK</span>
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
