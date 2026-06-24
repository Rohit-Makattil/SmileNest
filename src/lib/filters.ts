// AI Photobooth Vintage Film Stock Processing Engine

export type FilterType = 
  | 'Normal'
  | 'Kodak Gold 200' 
  | 'Portra 400' 
  | 'Fuji Classic' 
  | 'Polaroid Fade' 
  | 'Disposable Camera' 
  | 'Black & White Film' 
  | 'Vintage Sepia';

export const LIGHT_FILTERS: FilterType[] = [
  'Normal',
  'Kodak Gold 200',
  'Portra 400',
  'Fuji Classic',
  'Polaroid Fade',
  'Disposable Camera',
  'Black & White Film',
  'Vintage Sepia'
];

// Lightweight GPU CSS-based preview filters for the video canvas loop
export function applyPreviewFilter(ctx: CanvasRenderingContext2D, filter: FilterType) {
  switch (filter) {
    case 'Kodak Gold 200':
      // Warm, saturated golden cast with punchy contrast
      ctx.filter = 'sepia(0.18) saturate(1.22) contrast(1.05) brightness(1.02) hue-rotate(-3deg)';
      break;
    case 'Portra 400':
      // Soft contrast, warm pastel tones, flattering highlights
      ctx.filter = 'contrast(0.94) brightness(1.03) saturate(1.04) sepia(0.08)';
      break;
    case 'Fuji Classic':
      // Cool green-blue tint, rich shadow contrast
      ctx.filter = 'contrast(1.12) brightness(0.96) saturate(1.06) hue-rotate(5deg) sepia(0.02)';
      break;
    case 'Polaroid Fade':
      // Faded blacks (washed shadows), warm midtones, high highlight contrast
      ctx.filter = 'contrast(1.15) brightness(1.04) saturate(0.86) sepia(0.12)';
      break;
    case 'Disposable Camera':
      // Harsh saturation, yellow-green cast, high contrast
      ctx.filter = 'contrast(1.12) brightness(0.98) saturate(1.18) hue-rotate(-8deg) sepia(0.04)';
      break;
    case 'Black & White Film':
      // Ilford silver-halide deep monochrome contrast
      ctx.filter = 'grayscale(1) contrast(1.24) brightness(1.02)';
      break;
    case 'Vintage Sepia':
      // Pure historical archival brown wash
      ctx.filter = 'sepia(1) contrast(0.94) saturate(0.75) brightness(0.98)';
      break;
    case 'Normal':
    default:
      ctx.filter = 'none';
      break;
  }
}

// Vintage radial vignette layer
export function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.max(width, height) * 0.45,
    width / 2, height / 2, Math.max(width, height) * 0.75
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(43, 35, 25, 0.42)'); // warm sepia-tinted dark border
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// Procedural Analog Film Look Imperfections Generator
export function applyFilmImperfections(
  canvas: HTMLCanvasElement, 
  options: {
    grain?: boolean;
    lightLeaks?: boolean;
    dust?: boolean;
    scratches?: boolean;
    vignette?: boolean;
    softFocus?: boolean;
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // 1. Soft Focus / Glow Halation
  if (options.softFocus) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.filter = 'blur(4px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
  }

  // 2. Light Leaks (Fiery orange/pink glows bleeding from edges)
  if (options.lightLeaks && Math.random() < 0.85) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen'; // additive blend
    
    const numLeaks = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < numLeaks; i++) {
      // Choose a random edge or corner
      const leakX = Math.random() < 0.5 ? 0 : w;
      const leakY = Math.random() * h;
      const radius = Math.random() * (w * 0.45) + (w * 0.3);

      const leakGrad = ctx.createRadialGradient(leakX, leakY, 0, leakX, leakY, radius);
      leakGrad.addColorStop(0, 'rgba(255, 75, 0, 0.40)');  // Warm orange center
      leakGrad.addColorStop(0.3, 'rgba(255, 0, 120, 0.16)'); // Soft pink fringe
      leakGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');          // Fades to black (screen transparency)

      ctx.fillStyle = leakGrad;
      ctx.beginPath();
      ctx.arc(leakX, leakY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Vintage Vignette
  if (options.vignette) {
    drawVignette(ctx, w, h);
  }

  // 4. Fine Film Grain (True per-pixel RGB math noise)
  if (options.grain) {
    ctx.save();
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    // Dynamic grain intensity
    const intensity = 13 + Math.random() * 5; 
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue; // Skip transparency (e.g. photo strip margins)
      
      const noise = (Math.random() - 0.5) * intensity;
      data[i]     = Math.max(0, Math.min(255, data[i] + noise));     // Red
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // Green
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // Blue
    }
    ctx.putImageData(imgData, 0, 0);
    ctx.restore();
  }

  // 5. Dust Specks and Curved Lint fibers
  if (options.dust) {
    ctx.save();
    const dustParticles = Math.floor(Math.random() * 6) + 4; // 4 to 10 specs
    
    for (let i = 0; i < dustParticles; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      
      // Randomize color: 75% dark grey, 25% white lint
      ctx.strokeStyle = Math.random() < 0.75 ? 'rgba(18, 18, 18, 0.55)' : 'rgba(240, 240, 240, 0.65)';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = Math.random() * 0.8 + 0.5;

      if (Math.random() < 0.45) {
        // Draw curved dust fiber
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(
          x + (Math.random() - 0.5) * 8, 
          y + (Math.random() - 0.5) * 8, 
          x + (Math.random() - 0.5) * 14, 
          y + (Math.random() - 0.5) * 14
        );
        ctx.stroke();
      } else {
        // Draw tiny circular speck
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 1.3 + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 6. Hairline Scratches (Moving film sprocket marks)
  if (options.scratches && Math.random() < 0.75) {
    ctx.save();
    const numScratches = Math.floor(Math.random() * 2) + 1; // 1 or 2 lines
    
    for (let i = 0; i < numScratches; i++) {
      const x = Math.random() * w;
      ctx.strokeStyle = Math.random() < 0.6 ? 'rgba(15, 15, 15, 0.15)' : 'rgba(240, 240, 240, 0.22)';
      ctx.lineWidth = 0.4;
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 12, h); // slightly tilted straight vertical run
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Bakes high-fidelity film stock profile into captured canvas pixels
export function applyHeavyFilter(
  srcCanvas: HTMLCanvasElement, 
  destCanvas: HTMLCanvasElement, 
  filter: FilterType
) {
  const destCtx = destCanvas.getContext('2d');
  if (!destCtx) return;

  const w = srcCanvas.width;
  const h = srcCanvas.height;
  destCanvas.width = w;
  destCanvas.height = h;

  destCtx.clearRect(0, 0, w, h);
  
  // 1. Draw source with mapped CSS filter onto output
  destCtx.save();
  applyPreviewFilter(destCtx, filter);
  destCtx.drawImage(srcCanvas, 0, 0, w, h);
  destCtx.restore();
}

