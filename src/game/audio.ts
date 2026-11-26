/**
 * Procedural Web Audio sound engine for CHAIN TRACE.
 * Zero external audio files — 100% synthesized in browser.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastDrawTick = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playDrawTick(pitchShift = 0): void {
    const nowMs = performance.now();
    if (nowMs - this.lastDrawTick < 45) return;
    this.lastDrawTick = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 + pitchShift * 40, now);
    osc.frequency.exponentialRampToValueAtTime(760 + pitchShift * 40, now + 0.03);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playWeaponLaunch(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Metallic chain whip noise burst + low swoosh
    const bufferSize = Math.floor(ctx.sampleRate * 0.22);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp((-i / bufferSize) * 4.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + 0.22);
    filter.Q.value = 1.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // Chain clink overtone
    const clink = ctx.createOscillator();
    const clinkGain = ctx.createGain();
    clink.type = 'sine';
    clink.frequency.setValueAtTime(1950, now);
    clink.frequency.exponentialRampToValueAtTime(920, now + 0.09);
    clinkGain.gain.setValueAtTime(0.05, now);
    clinkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    clink.connect(clinkGain);
    clinkGain.connect(ctx.destination);
    clink.start(now);
    clink.stop(now + 0.1);
  }

  public playFighterFollow(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.14);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playHit(critical = false, blocked = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (blocked) {
      // Metallic guard thud + ring
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.14);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
      return;
    }

    // Heavy impact sub punch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(critical ? 220 : 165, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.18);

    gain.gain.setValueAtTime(critical ? 0.28 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);

    // Metallic bite for head / heavy hit
    if (critical) {
      const ring = ctx.createOscillator();
      const ringGain = ctx.createGain();
      ring.type = 'square';
      ring.frequency.setValueAtTime(1320, now);
      ring.frequency.exponentialRampToValueAtTime(660, now + 0.18);
      ringGain.gain.setValueAtTime(0.07, now);
      ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      ring.connect(ringGain);
      ringGain.connect(ctx.destination);
      ring.start(now);
      ring.stop(now + 0.2);
    }
  }

  public playParry(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [1180, 1760, 2340].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.94, now + 0.35);
      gain.gain.setValueAtTime(0.09 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  public playClash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [980, 1480].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.22);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    });
  }

  public playDodge(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playRoundGong(isKo = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = isKo ? [110, 165, 220] : [220, 330, 440];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 0.7);
      gain.gain.setValueAtTime(0.14 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.76);
    });
  }
}

export const soundEngine = new SoundEngine();
