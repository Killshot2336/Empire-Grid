import { clamp } from "./util.js";

export class Simulation {
  constructor(world, progression) {
    this.world = world;
    this.progression = progression;

    this._time = 0;
    this._cameraFocus = { x: world.start.x, y: world.start.y };
    this._storm = 0;
    this._weather = world.time.weather || "clear";

    // global aggregates
    this.g = {
      credits: 500,
      power: 0,
      powerCap: 0,
      pop: 0,
      stability: 1.0,
      industry: 0,
      pollution: 0,
      logistics: 0,
      security: 0,
      research: 0,
      heat: 0,
      day: world.time.day || 0.35,
      era: 0
    };
  }

  state() {
    return {
      time: this._time,
      g: this.g,
      cameraFocusX: this._cameraFocus.x,
      cameraFocusY: this._cameraFocus.y,
      camera: this._cameraSave
    };
  }

  loadState(st) {
    if (!st) return;
    if (typeof st.time === "number") this._time = st.time;
    if (st.g) this.g = st.g;
    if (typeof st.cameraFocusX === "number") this._cameraFocus.x = st.cameraFocusX;
    if (typeof st.cameraFocusY === "number") this._cameraFocus.y = st.cameraFocusY;
  }

  setCameraFocus(x, y) { this._cameraFocus = { x, y }; }
  setCameraSave(cam) { this._cameraSave = cam; }

  pickTile(wx, wy) {
    const x = Math.floor(wx + 0.00001);
    const y = Math.floor(wy + 0.00001);
    if (x < 0 || y < 0 || x >= this.world.w || y >= this.world.h) return null;
    return this.world.tiles[y * this.world.w + x];
  }

  neighbors(tile) {
    const out = [];
    const { w, h, tiles } = this.world;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = tile.x + dx, y = tile.y + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      out.push(tiles[y * w + x]);
    }
    return out;
  }

  discoverAround(x, y, r) {
    const r2 = r * r;
    for (const t of this.world.tiles) {
      const dx = t.x - x, dy = t.y - y;
      if (dx * dx + dy * dy <= r2) t.discovered = true;
    }
  }

  tick(dt, gs) {
    this._time += dt;

    // day/night cycle
    this.g.day = (this.g.day + dt * 0.006) % 1;

    // weather progression
    if (gs.weather) {
      this._storm = clamp(this._storm + dt * (this._weather === "storm" ? 0.18 : -0.10), 0, 1);
      if (this._storm <= 0.02 && Math.random() < 0.0025 * dt) this._weather = "storm";
      if (this._storm >= 0.95 && Math.random() < 0.0025 * dt) this._weather = "clear";
    } else {
      this._weather = "clear";
      this._storm = 0;
    }
    this.world.time.weather = this._weather;

    // aggregate stats from tiles (lite sim if needed)
    let creditsTick = 0;
    let powerGen = 0, powerUse = 0;
    let pop = 0, stability = 0, industry = 0;
    let pollution = 0, logistics = 0, security = 0, research = 0, heat = 0;

    const tiles = this.world.tiles;
    const lite = !!gs.liteSim;

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (!t.discovered || !t.building) continue;

      // base contributes
      pop += t.pop;
      powerGen += t.powerGen;
      powerUse += t.powerUse;
      stability += t.stability;
      industry += t.industry;
      pollution += t.pollution;
      logistics += t.logistics;
      security += t.security;
      research += t.research;
      heat += t.heat;

      // credits
      creditsTick += t.industry * 0.12 + t.pop * 0.02 + (t.logistics * 0.05);

      // adjacency bonus (lite mode reduces frequency)
      if (!lite || (i % 3 === 0)) {
        const ns = this.neighbors(t);
        let adj = 0;
        for (const n of ns) {
          if (!n.building) continue;
          if (t.building.type === "industrial" && n.building.type === "power") adj += 0.08;
          if (t.building.type === "residential" && n.building.type === "civic") adj += 0.07;
          if (t.building.type === "research" && n.building.type === "industrial") adj += 0.05;
          if (t.building.type === "logistics" && n.building.type !== "wild") adj += 0.03;
        }
        creditsTick += t.industry * adj;
        stability += adj * 0.12;
      }
    }

    // global caps / conversion
    this.g.powerCap = powerGen;
    this.g.power = powerGen - powerUse;

    // stability is averaged over built tiles
    const builtCount = Math.max(1, this.countBuilt());
    const stabAvg = stability / builtCount;
    this.g.stability = clamp(0.35 + stabAvg, 0, 2);

    this.g.pop = pop;
    this.g.industry = industry;
    this.g.pollution = pollution;
    this.g.logistics = logistics;
    this.g.security = security;
    this.g.research = research;
    this.g.heat = heat;

    // weather penalty
    if (this._weather === "storm") {
      creditsTick *= 0.92;
      this.g.stability = clamp(this.g.stability - 0.08 * this._storm, 0, 2);
    }

    // credits tick (scaled)
    this.g.credits += creditsTick * dt;

    // passive discovery (frontier vibe)
    const frontier = this.countDiscovered() < 120 ? 1 : 0;
    if (frontier) {
      this.discoverAround(this.world.start.x, this.world.start.y, 6);
    }
  }

  countBuilt() {
    let c = 0;
    for (const t of this.world.tiles) if (t.discovered && t.building) c++;
    return c;
  }
  countDiscovered() {
    let c = 0;
    for (const t of this.world.tiles) if (t.discovered) c++;
    return c;
  }

  isStorming() { return this._weather === "storm"; }
  stormLevel() { return this._storm; }
}
