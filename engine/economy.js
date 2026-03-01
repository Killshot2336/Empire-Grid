import { clamp } from "./util.js";

const BUILDINGS = {
  residential: { name: "RESIDENTIAL", desc: "Population + passive credits", cost: 55, color: "hot" },
  industrial:  { name: "INDUSTRY", desc: "Industry + credits, adds pollution", cost: 85, color: "amber" },
  power:       { name: "POWER", desc: "Generates power, stabilizes grid", cost: 90, color: "ok" },
  civic:       { name: "CIVIC", desc: "Stability + security", cost: 95, color: "pink" },
  research:    { name: "RESEARCH", desc: "Research points + tech speed", cost: 110, color: "hot" },
  logistics:   { name: "LOGISTICS", desc: "Logistics throughput + trade", cost: 120, color: "amber" },
  wonder:      { name: "WONDER", desc: "Mega project that changes rules", cost: 500, color: "pink" },
};

export class Economy {
  constructor(sim, progression) {
    this.sim = sim;
    this.progression = progression;

    this._cool = 0;
    this._creditsSpending = 0;
  }

  state() {
    return { cool: this._cool, spend: this._creditsSpending };
  }
  loadState(st) {
    if (!st) return;
    if (typeof st.cool === "number") this._cool = st.cool;
    if (typeof st.spend === "number") this._creditsSpending = st.spend;
  }

  cheatAdd(key, amt) {
    if (key === "credits") this.sim.g.credits += amt;
  }

  buildingDefs() { return BUILDINGS; }

  tick(dt, gs) {
    this._cool = Math.max(0, this._cool - dt);

    // global soft caps & drift
    // Industry drives pollution; civic/security reduces heat
    const g = this.sim.g;
    g.heat = clamp(g.heat + (g.pollution * 0.0012 - g.security * 0.0016) * dt, 0, 1000);
  }

  tryBuildOrUpgrade(tile, buildId, creative = false) {
    if (!tile.discovered) return { ok: false, msg: "Explore first." };
    if (!tile.canBuild) return { ok: false, msg: "Cannot build here." };
    if (this._cool > 0 && !creative) return { ok: false };

    const def = BUILDINGS[buildId];
    if (!def) return { ok: false };

    // Wonders: only if unlocked
    if (buildId === "wonder" && !this.progression.isWonderUnlocked()) {
      return { ok: false, msg: "Wonders unlock after early tech." };
    }

    // build new
    if (!tile.building) {
      const cost = def.cost * this.costMult(tile, buildId);
      if (!creative && this.sim.g.credits < cost) return { ok: false, msg: "Not enough credits." };
      if (!creative) this.sim.g.credits -= cost;

      tile.building = { type: buildId, lvl: 1 };
      tile.zone = buildId;
      tile.level = 1;

      // reveal area
      this.sim.discoverAround(tile.x, tile.y, 3);

      this.applyStats(tile);

      this._cool = 0.04;
      return { ok: true, text: `-${Math.round(cost)} credits`, color: "amber", fx: "build", thump: 0.35 };
    }

    // upgrade existing
    const maxLvl = this.progression.maxBuildingLevel(buildId);
    const next = tile.building.lvl + 1;
    if (next > maxLvl) return { ok: false, msg: "Max level (for this era)." };

    const base = def.cost * 0.75;
    const cost = base * (1.28 ** (next - 1)) * this.costMult(tile, buildId);
    if (!creative && this.sim.g.credits < cost) return { ok: false, msg: "Not enough credits." };
    if (!creative) this.sim.g.credits -= cost;

    tile.building.lvl = next;
    tile.level = next;

    this.applyStats(tile);

    // anomalies/relic bonus
    if (tile.anomaly === "relic" && next >= 3) {
      this.sim.g.credits += 120;
      return { ok: true, text: `RELIC SURGE +120`, color: "pink", fx: "upgrade", thump: 0.55 };
    }

    this._cool = 0.03;
    return { ok: true, text: `UPGRADE L${next}`, color: "hot", fx: "upgrade", thump: 0.45 };
  }

  costMult(tile, buildId) {
    // terrain affects cost and build identity
    let m = 1;
    if (tile.terrain === "badlands") m *= 1.12;
    if (tile.terrain === "fertile" && buildId === "residential") m *= 0.92;
    if (tile.terrain === "highland" && buildId === "power") m *= 0.95;
    if (tile.res === "rare") m *= 0.98;
    return m;
  }

  applyStats(tile) {
    // zero
    tile.pop = 0;
    tile.powerGen = 0;
    tile.powerUse = 0;
    tile.stability = 0;
    tile.industry = 0;
    tile.pollution = 0;
    tile.logistics = 0;
    tile.security = 0;
    tile.research = 0;
    tile.heat = 0;

    if (!tile.building) return;

    const lvl = tile.building.lvl;
    const era = this.progression.era();
    const eraBoost = 1 + era * 0.22;

    switch (tile.building.type) {
      case "residential":
        tile.pop = Math.floor((6 + lvl * 9) * eraBoost);
        tile.powerUse = (2 + lvl * 1.2) * eraBoost;
        tile.stability = 0.06 + lvl * 0.03;
        if (tile.terrain === "fertile") tile.stability += 0.05;
        break;

      case "industrial":
        tile.industry = (4 + lvl * 6.5) * eraBoost;
        tile.powerUse = (3 + lvl * 1.8) * eraBoost;
        tile.pollution = (1.2 + lvl * 1.6) * eraBoost;
        tile.stability -= 0.02 * lvl;
        if (tile.res === "oil") tile.industry *= 1.15;
        break;

      case "power":
        tile.powerGen = (12 + lvl * 14) * eraBoost;
        tile.stability = 0.10 + lvl * 0.04;
        tile.pollution = (0.6 + lvl * 0.8) * eraBoost;
        if (tile.terrain === "highland") tile.powerGen *= 1.12;
        break;

      case "civic":
        tile.stability = 0.18 + lvl * 0.07;
        tile.security = (1.4 + lvl * 1.1) * eraBoost;
        tile.powerUse = (1.2 + lvl * 0.7) * eraBoost;
        break;

      case "research":
        tile.research = (1.2 + lvl * 1.45) * eraBoost;
        tile.powerUse = (2.2 + lvl * 1.1) * eraBoost;
        tile.stability = 0.05 + lvl * 0.02;
        if (tile.res === "silicon") tile.research *= 1.18;
        break;

      case "logistics":
        tile.logistics = (1.8 + lvl * 1.9) * eraBoost;
        tile.powerUse = (1.8 + lvl * 0.9) * eraBoost;
        tile.industry += (1.2 + lvl * 1.2) * eraBoost;
        break;

      case "wonder":
        // Wonders are handled in progression but also grant base aura
        tile.powerUse = (8 + lvl * 3) * eraBoost;
        tile.stability = 0.22 + lvl * 0.06;
        tile.industry = (6 + lvl * 5) * eraBoost;
        tile.wonder = tile.wonder || { key: this.progression.assignWonder(tile), prog: 0 };
        break;

      default:
        break;
    }

    // anomaly heat
    if (tile.anomaly === "rift") {
      tile.heat += 2.5 * lvl;
      tile.stability -= 0.04;
    }
  }
}
