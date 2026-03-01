export class PerformanceManager {
  constructor() {
    this.fps = 60;
    this._acc = 0;
    this._frames = 0;
  }

  tick(dt) {
    this._acc += dt;
    this._frames++;
    if (this._acc >= 0.5) {
      this.fps = Math.round(this._frames / this._acc);
      this._acc = 0;
      this._frames = 0;
    }
  }

  defaultGraphics(auto) {
    // conservative by default
    const preset = auto ? "medium" : "high";
    return {
      preset,
      particles: preset !== "potato" && preset !== "low",
      weather: preset === "high" || preset === "ultra",
      fog: preset !== "potato",
      skyline: preset !== "potato",
      parallax: preset !== "potato" && preset !== "low",
      traffic: preset === "high" || preset === "ultra",
      lighting: preset !== "potato",
      shake: preset !== "potato",
      glow: preset === "high" || preset === "ultra",
      liteSim: preset === "potato" || preset === "low",
      creatorMode: false,
    };
  }

  apply(gs) {
    // no-op placeholder (kept for expansion)
    return gs;
  }
}

