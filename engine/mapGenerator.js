import { clamp } from "./util.js";

export class MapGenerator {
  constructor(rng) {
    this.rng = rng;
  }

  generateMegaregion({ w, h, waterLevel, mountainLevel, anomalyRate, resourceRate }) {
    // Value-noise-ish height field (fast)
    const field = new Float32Array(w * h);
    const octaves = 5;
    const base = this.rng.range(0.8, 1.25);

    const sample = (x, y, freq) => {
      const rx = x * freq + this.rng.range(-999, 999);
      const ry = y * freq + this.rng.range(-999, 999);
      // cheap pseudo gradients
      const s = Math.sin(rx * 0.11) * Math.cos(ry * 0.13) + Math.sin((rx + ry) * 0.07);
      return (s * 0.5 + 0.5);
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0;
        let amp = 1;
        let freq = 0.015 * base;
        let norm = 0;
        for (let o = 0; o < octaves; o++) {
          v += sample(x, y, freq) * amp;
          norm += amp;
          amp *= 0.55;
          freq *= 2.05;
        }
        v /= norm;

        // shape island-ish + coastline drama
        const nx = (x / (w - 1)) * 2 - 1;
        const ny = (y / (h - 1)) * 2 - 1;
        const d = Math.sqrt(nx * nx + ny * ny);
        v = v - (d * 0.55);

        field[y * w + x] = v;
      }
    }

    // Normalize
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < field.length; i++) { mn = Math.min(mn, field[i]); mx = Math.max(mx, field[i]); }
    const inv = 1 / (mx - mn || 1);
    for (let i = 0; i < field.length; i++) field[i] = (field[i] - mn) * inv;

    const tiles = [];
    let id = 0;

    const neighbors = (x, y) => {
      const n = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        n.push(field[yy * w + xx]);
      }
      return n;
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const height = field[y * w + x];
        const ns = neighbors(x, y);
        const nAvg = ns.reduce((a, b) => a + b, 0) / (ns.length || 1);
        const rough = clamp(Math.abs(height - nAvg) * 2.2, 0, 1);

        const isWater = height < waterLevel;
        const isMountain = height > mountainLevel;

        let terrain = "plains";
        if (isWater) terrain = "water";
        else if (isMountain) terrain = "mountain";
        else if (height > 0.62) terrain = "highland";
        else if (height < 0.54) terrain = "lowland";

        // biomes flavor
        if (!isWater && !isMountain) {
          if (rough > 0.55 && height > 0.58) terrain = "badlands";
          if (height > 0.60 && this.rng.chance(0.08)) terrain = "crag";
          if (height < 0.56 && this.rng.chance(0.10)) terrain = "fertile";
        }

        const canBuild = !isWater && terrain !== "mountain";

        // resources
        let res = null;
        if (canBuild && this.rng.chance(resourceRate)) {
          const pick = this.rng.f();
          res = pick < 0.28 ? "oil" : pick < 0.55 ? "silicon" : pick < 0.78 ? "rare" : "water";
        }

        // anomalies
        const anomaly = canBuild && this.rng.chance(anomalyRate) ? (this.rng.f() < 0.6 ? "relic" : "rift") : null;

        tiles.push({
          id: id++,
          x, y,
          height,
          terrain,
          canBuild,
          discovered: false,
          zone: "wild",
          level: 0,
          building: null, // {type, lvl}
          res,
          anomaly,
          // runtime stats
          pop: 0,
          powerGen: 0,
          powerUse: 0,
          stability: 0,
          industry: 0,
          pollution: 0,
          logistics: 0,
          security: 0,
          research: 0,
          heat: 0,
          wonder: null
        });
      }
    }

    // starting region discover
    const sx = Math.floor(w * 0.45 + this.rng.range(-8, 8));
    const sy = Math.floor(h * 0.55 + this.rng.range(-6, 6));
    const revealR = 5;
    for (const t of tiles) {
      const dx = t.x - sx, dy = t.y - sy;
      if (dx * dx + dy * dy <= revealR * revealR) t.discovered = true;
    }

    return {
      w, h,
      start: { x: sx, y: sy },
      tiles,
      time: { day: 0.35, weather: "clear" },
    };
  }
}
