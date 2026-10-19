// WebAudio로 만든 효과음 (외부 파일 없음)
export class Audio {
  constructor() { this.ctx = null; this.on = true; this.engineOn = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.on ? 0.7 : 0; this.master.connect(ctx.destination);
    // 도시 소음 (브라운 노이즈)
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    this.noiseBuf = buf;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    this.amb = ctx.createGain(); this.amb.gain.value = 0.18;
    src.connect(lp); lp.connect(this.amb); this.amb.connect(this.master); src.start();
    // 엔진
    this.eng1 = ctx.createOscillator(); this.eng1.type = 'sawtooth';
    this.eng2 = ctx.createOscillator(); this.eng2.type = 'square';
    this.engF = ctx.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 300;
    this.engG = ctx.createGain(); this.engG.gain.value = 0;
    this.eng1.connect(this.engF); this.eng2.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.master);
    this.eng1.start(); this.eng2.start();
  }
  setEnabled(v) { this.on = v; if (this.master) this.master.gain.value = v ? 0.7 : 0; }
  ambient(night, inside) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.amb.gain.setTargetAtTime(inside ? 0.03 : (night ? 0.1 : 0.2), t, 0.5);
  }
  engine(active, speed, throttle, maxSpeed) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const r = Math.min(1, Math.abs(speed) / maxSpeed);
    const gear = Math.min(4, Math.floor(r * 5));
    const inGear = (r * 5 - gear);
    const f = 38 + inGear * 50 + gear * 8 + Math.abs(throttle) * 10;
    this.eng1.frequency.setTargetAtTime(f, t, 0.08);
    this.eng2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    this.engF.frequency.setTargetAtTime(220 + r * 600 + Math.abs(throttle) * 300, t, 0.1);
    this.engG.gain.setTargetAtTime(active ? 0.05 + r * 0.06 + Math.abs(throttle) * 0.03 : 0, t, 0.15);
  }
  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slide) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  click() { this.tone(900, 0.05, 'triangle', 0.08); }
  coin() { this.tone(988, 0.1, 'square', 0.06); this.tone(1319, 0.25, 'square', 0.06, 0.08); }
  beep() { this.tone(1800, 0.07, 'square', 0.05); }
  bad() { this.tone(220, 0.25, 'sawtooth', 0.07, 0, 140); }
  chime() { this.tone(659, 0.3, 'sine', 0.12); this.tone(523, 0.45, 'sine', 0.12, 0.22); }
  horn() { this.tone(415, 0.45, 'square', 0.07); this.tone(523, 0.45, 'square', 0.05); }
  crash(v = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const g = ctx.createGain(), t = ctx.currentTime, f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t, Math.random()); src.stop(t + 0.6);
  }
}
