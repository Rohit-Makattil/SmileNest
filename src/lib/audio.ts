// AI Photobooth Audio Synthesizer
// Programmatic synthesis using browser Web Audio API (zero external assets needed)

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  return new AudioCtx();
}

// Helper to generate white noise buffer
function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function playShutterSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Shutter Curtain 1 (sharp transient metal hit)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(650, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.09);

    // 2. High-frequency friction click (noise)
    const noiseNode1 = ctx.createBufferSource();
    noiseNode1.buffer = createNoiseBuffer(ctx, 0.1);
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.frequency.setValueAtTime(1600, now);
    filter1.Q.setValueAtTime(4, now);

    const noiseGain1 = ctx.createGain();
    noiseGain1.gain.setValueAtTime(0.15, now);
    noiseGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    noiseNode1.connect(filter1);
    filter1.connect(noiseGain1);
    noiseGain1.connect(ctx.destination);

    noiseNode1.start(now);
    noiseNode1.stop(now + 0.11);

    // 3. Shutter Curtain 2 (delayed bounce slap)
    const delay = 0.045; // 45ms after first curtain
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(220, now + delay);
    osc2.frequency.exponentialRampToValueAtTime(40, now + delay + 0.06);

    gain2.gain.setValueAtTime(0.25, now + delay);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + delay);
    osc2.stop(now + delay + 0.07);

    // Secondary noise curtain flap
    const noiseNode2 = ctx.createBufferSource();
    noiseNode2.buffer = createNoiseBuffer(ctx, 0.06);
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'bandpass';
    filter2.frequency.setValueAtTime(2800, now + delay);
    filter2.Q.setValueAtTime(5, now + delay);

    const noiseGain2 = ctx.createGain();
    noiseGain2.gain.setValueAtTime(0.08, now + delay);
    noiseGain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

    noiseNode2.connect(filter2);
    filter2.connect(noiseGain2);
    noiseGain2.connect(ctx.destination);

    noiseNode2.start(now + delay);
    noiseNode2.stop(now + delay + 0.07);

  } catch (e) {
    console.warn('Shutter sound synthesis failed:', e);
  }
}

export function playFilmWindSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const duration = 0.65; // 650ms winding whir

    // 1. Motor Humming sound
    const motorOsc = ctx.createOscillator();
    const motorGain = ctx.createGain();
    
    motorOsc.type = 'sawtooth';
    motorOsc.frequency.setValueAtTime(95, now);
    // Sweeps up and down slightly to mimic gear load speed variation
    motorOsc.frequency.linearRampToValueAtTime(110, now + duration * 0.3);
    motorOsc.frequency.linearRampToValueAtTime(80, now + duration);

    // Motor lowpass filter to remove harsh highs
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = 'lowpass';
    motorFilter.frequency.setValueAtTime(180, now);

    motorGain.gain.setValueAtTime(0.08, now);
    motorGain.gain.linearRampToValueAtTime(0.06, now + duration - 0.1);
    motorGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    motorOsc.connect(motorFilter);
    motorFilter.connect(motorGain);
    motorGain.connect(ctx.destination);

    motorOsc.start(now);
    motorOsc.stop(now + duration + 0.05);

    // 2. Winding mechanical gear ticks (ch-ch-ch-ch-ch-ch)
    const ticksCount = 12;
    for (let i = 0; i < ticksCount; i++) {
      const tickTime = now + (duration / ticksCount) * i;
      
      const tickOsc = ctx.createOscillator();
      const tickGain = ctx.createGain();
      
      tickOsc.type = 'triangle';
      tickOsc.frequency.setValueAtTime(1400 - (i * 20), tickTime);
      
      tickGain.gain.setValueAtTime(0.025, tickTime);
      tickGain.gain.exponentialRampToValueAtTime(0.001, tickTime + 0.02);
      
      tickOsc.connect(tickGain);
      tickGain.connect(ctx.destination);
      
      tickOsc.start(tickTime);
      tickOsc.stop(tickTime + 0.025);

      // Noise component for tick gear tooth friction
      const tickNoise = ctx.createBufferSource();
      tickNoise.buffer = createNoiseBuffer(ctx, 0.015);
      
      const tickFilter = ctx.createBiquadFilter();
      tickFilter.type = 'bandpass';
      tickFilter.frequency.setValueAtTime(3200, tickTime);
      tickFilter.Q.setValueAtTime(8, tickTime);
      
      const tickNoiseGain = ctx.createGain();
      tickNoiseGain.gain.setValueAtTime(0.035, tickTime);
      tickNoiseGain.gain.exponentialRampToValueAtTime(0.001, tickTime + 0.015);

      tickNoise.connect(tickFilter);
      tickFilter.connect(tickNoiseGain);
      tickNoiseGain.connect(ctx.destination);

      tickNoise.start(tickTime);
      tickNoise.stop(tickTime + 0.02);
    }
  } catch (e) {
    console.warn('Film winding sound synthesis failed:', e);
  }
}

export function playRevealSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Carousel slide trigger click ("clack")
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(2400, now);
    clickOsc.frequency.exponentialRampToValueAtTime(1200, now + 0.02);

    clickGain.gain.setValueAtTime(0.08, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.03);

    // 2. Carousel slide frame drops into slot ("thump")
    const thumpDelay = 0.035; // 35ms delay
    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(180, now + thumpDelay);
    thumpOsc.frequency.exponentialRampToValueAtTime(55, now + thumpDelay + 0.12);

    thumpGain.gain.setValueAtTime(0.4, now + thumpDelay);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + thumpDelay + 0.14);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thumpOsc.start(now + thumpDelay);
    thumpOsc.stop(now + thumpDelay + 0.15);

    // Mechanical wood friction noise for dropping frame
    const thumpNoise = ctx.createBufferSource();
    thumpNoise.buffer = createNoiseBuffer(ctx, 0.08);
    const thumpFilter = ctx.createBiquadFilter();
    thumpFilter.type = 'bandpass';
    thumpFilter.frequency.setValueAtTime(450, now + thumpDelay);
    thumpFilter.Q.setValueAtTime(2, now + thumpDelay);

    const thumpNoiseGain = ctx.createGain();
    thumpNoiseGain.gain.setValueAtTime(0.05, now + thumpDelay);
    thumpNoiseGain.gain.exponentialRampToValueAtTime(0.001, now + thumpDelay + 0.08);

    thumpNoise.connect(thumpFilter);
    thumpFilter.connect(thumpNoiseGain);
    thumpNoiseGain.connect(ctx.destination);

    thumpNoise.start(now + thumpDelay);
    thumpNoise.stop(now + thumpDelay + 0.09);

  } catch (e) {
    console.warn('Reveal sound synthesis failed:', e);
  }
}

