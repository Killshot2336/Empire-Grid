 import { clamp, lerp } from "./util.js";

export class EffectsManager {
  constructor() {
    this.particles = [];
    this.floats = [];
    this.shake = 0;
    this._audio = null;
    this._hum = null;
    this._humGain = null;
    this._initAudio();
  }

  _initAudio() {
    try {
      this._audio = new (window.AudioContext || window.webkitAudioContext)();
      // subtle hum
      const osc = this._audio.createOscillator();
      const gain = this._audio.createGain();
      osc.type = "sine";
      osc.frequency.value = 55;
      gain.gain.value = 0.0;
      osc.connect(gain).connect(this._audio.destination);
      osc.start();

      this._hum = osc;
      this._humGain = gain;
    } catch {
      this._audio = null;
    }
  }

  ensureAudio() {
    if (!this._audio) return;
    if (this._audio.state === "suspended") this._audio.resume().catch(() => {});
  }

  tick(dt, gs) {
    this.shake = lerp(this.shake, 0, clamp(dt * 5, 0, 1));

    // hum based on glow + time
    if (this._humGain) {
      const target = gs.glow ? 0.018 : 0.008;
      this._humGain.gain.value = lerp(this._humGain.gain.value, target, clamp(dt * 2.5, 0, 1));
    }

    // particles
    for (const p of this.particles) {
      p.vx *= (1 - dt * 2.4);
      p.vy *= (1 - dt * 2.4);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const f of this.floats) {
      f.y -= dt * 0.45;
      f.life -= dt;
      f.a = clamp(f.life / f.max, 0, 1);
    }
    this.floats = this.floats.filter(f => f.life > 0);
  }

  burst(x, y, type) {
    this.ensureAudio();
    const n = type === "wonder" ? 26 : type === "upgrade" ? 18 : 12;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (type === "wonder" ? 6.5 : 4.2) * (0.35 + Math.random());
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.35,
        type
      });
    }
    this._clickSound(type === "wonder" ? 220 : 160, 0.05 + (type === "wonder" ? 0.04 : 0));
  }

  floatText(x, y, text, color = "hot") {
    this.floats.push({ x, y, text, color, life: 1.0, max: 1.0, a: 1 });
  }

  thump(strength = 0.5) {
    this.shake = clamp(this.shake + strength, 0, 1);
  }

  _clickSound(freq, t) {
    if (!this._audio) return;
    try {
      const o = this._audio.createOscillator();
      const g = this._audio.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.value = 0.0;

      o.connect(g).connect(this._audio.destination);
      const now = this._audio.currentTime;
      g.gain.setValueAtTime(0.0, now);
      g.gain.linearRampToValueAtTime(0.06, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.12 + t);
      o.start(now);
      o.stop(now + 0.16 + t);
    } catch {}
  }
}

