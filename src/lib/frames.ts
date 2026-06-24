// AI Photobooth Frame Overlay System

export type FrameCategory = 'None' | 'Birthday' | 'Wedding' | 'Graduation' | 'Festival' | 'Party';

export const FRAME_CATEGORIES: FrameCategory[] = ['None', 'Birthday', 'Wedding', 'Graduation', 'Festival', 'Party'];

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: FrameCategory
) {
  if (frame === 'None') return;

  ctx.save();

  // Typography config
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (frame) {
    case 'Birthday':
      // Sweet pink border
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#ec4899'; // Pink-500
      ctx.strokeRect(0, 0, width, height);

      // Bottom bar
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(7, height - 48, width - 14, 41);

      // Text
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🎂 HAPPY BIRTHDAY! 🎉', width / 2, height - 27);

      // Decorative dots
      ctx.fillStyle = '#fbbf24'; // Yellow
      ctx.beginPath(); ctx.arc(35, 35, 8, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(width - 35, 35, 8, 0, Math.PI*2); ctx.fill();
      break;

    case 'Wedding':
      // Elegant gold double line border
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#d97706'; // Amber-600 (Gold)
      ctx.strokeRect(12, 12, width - 24, height - 24);

      ctx.lineWidth = 1.5;
      ctx.strokeRect(18, 18, width - 36, height - 36);

      // Bottom text bar
      ctx.fillStyle = 'rgba(8, 7, 17, 0.85)';
      ctx.fillRect(width / 2 - 140, height - 44, 280, 28);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'italic 16px serif';
      ctx.fillText('✨ Love & Joy Always ✨', width / 2, height - 29);
      break;

    case 'Graduation':
      // Dark slate border
      ctx.lineWidth = 16;
      ctx.strokeStyle = '#1e293b'; // Slate-800
      ctx.strokeRect(0, 0, width, height);

      // Bottom ribbon
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(8, height - 52, width - 16, 44);

      // Text
      ctx.fillStyle = '#fbbf24'; // Gold
      ctx.font = 'bold 18px Courier New, monospace';
      ctx.fillText('🎓 CLASS OF 2026 🎓', width / 2, height - 30);
      break;

    case 'Festival':
      // Emerald green festival border
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#059669'; // Emerald-600
      ctx.strokeRect(0, 0, width, height);

      // Bottom text block
      ctx.fillStyle = '#059669';
      ctx.fillRect(7, height - 48, width - 14, 41);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('✨ CELEBRATE THE MOMENT ✨', width / 2, height - 27);

      // Corner ornaments
      ctx.fillStyle = '#f43f5e'; // Rose
      ctx.beginPath(); ctx.arc(25, 25, 6, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(width - 25, 25, 6, 0, Math.PI*2); ctx.fill();
      break;

    case 'Party':
      // Violet neon party border
      ctx.lineWidth = 16;
      ctx.strokeStyle = '#7c3aed'; // Violet-600
      ctx.strokeRect(0, 0, width, height);

      // Bottom panel
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(8, height - 52, width - 16, 44);

      // Glowing text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('⚡ LET\'S PARTY ⚡', width / 2, height - 30);
      break;
  }

  ctx.restore();
}
