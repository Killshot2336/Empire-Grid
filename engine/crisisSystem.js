import { clamp } from "./util.js";

export class CrisisSystem {
  constructor(sim, progression, rng) {
    this.sim = sim;
    this.progression = progression;
    this.rng = rng;

    this.level = 0;          // overall crisis intensity
    this.blackout = 0;       // power failure pressure
    this.riot = 0;           // instability pressure
    this.damage = 0;         // ongoing city damage (moderate, recoverable)
    this._t = 0;
    this._msg = "";
  }

  state() {
    return { level: this.level, blackout: this.blackout, riot: this.riot, damage: this.damage, msg: this._msg };
  }
  loadState(st) {
    if (!st) return;
    this.level = st.level ?? 0;
    this.blackout = st.blackout ?? 0;
    this.riot = st.riot ?? 0;
    this.damage = st.damage ?? 0;
    this._msg = st.msg ?? "";
  }

  cheatCalm() {
    this.level = 0;
    this.blackout = 0;
    this.riot = 0;
    this.damage = 0;
    this._msg = "CALM RESTORED";
  }

  tick(dt, gs) {
    this._t += dt;
    const g = this.sim.g;

    // pressures
    const powerDeficit = Math.max(0, -g.power);
    const instability = Math.max(0, 1.0 - g.stability);

    this.blackout = clamp(this.blackout + (powerDeficit * 0.006) * dt - 0.02 * dt, 0, 100);
    this.riot = clamp(this.riot + (instability * 0.9 + g.heat * 0.001) * dt - 0.018 * dt, 0, 100);

    // storms amplify
    if (this.sim.isStorming()) {
      this.blackout = clamp(this.blackout + 0.04 * dt, 0, 100);
      this.riot = clamp(this.riot + 0.02 * dt, 0, 100);
    }

    // level
    const target = (this.blackout + this.riot) * 0.5;
    this.level = clamp(this.level + (target - this.level) * 0.06 * dt, 0, 100);

    // effects (moderate but dramatic)
    if (this.level > 55) {
      // damage ticks up
      this.damage = clamp(this.damage + (this.level - 55) * 0.0025 * dt, 0, 100);

      // reduce credits slightly
      g.credits *= (1 - 0.00022 * dt * (this.level - 55));

      // rare strike events
      if (this._t > 6 && this.rng.chance(0.0025 * dt)) {
        this._t = 0;
        if (this.blackout > this.riot) this._msg = "BLACKOUT CASCADE — GRID STAGGERING";
        else this._msg = "RIOT WAVE — DISTRICTS LOCKING DOWN";
      }
    } else {
      // recover
      this.damage = clamp(this.damage - 0.08 * dt, 0, 100);
      if (this._msg && this.rng.chance(0.02 * dt)) this._msg = "";
    }
  }

  status() {
    if (this.level < 18) return { k: "STABLE", cls: "ok" };
    if (this.level < 45) return { k: "STRAINED", cls: "warn" };
    return { k: "CRITICAL", cls: "danger" };
  }
}

