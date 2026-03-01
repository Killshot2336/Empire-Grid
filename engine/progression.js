
import { clamp } from "./util.js";

const DOCTRINES = [
  { id:"powerBaron", name:"POWER BARON", perk:"Power conversion + overload bonuses" },
  { id:"popKing", name:"POPULATION KING", perk:"Housing scaling + migration surges" },
  { id:"stabilityArchitect", name:"STABILITY ARCHITECT", perk:"Crisis farming + resilience" },
  { id:"tradeSyndicate", name:"TRADE SYNDICATE", perk:"Contracts + market spikes" },
  { id:"techSupremacy", name:"TECH SUPREMACY", perk:"Research + automation" },
  { id:"wonderRush", name:"WONDER RUSH", perk:"Mega projects + milestone spikes" },
];

const TECH = {
  economy: [
    { id:"markets", name:"Markets", desc:"+Credits tick", cost: 40 },
    { id:"supply", name:"Supply Chains", desc:"+Industry efficiency", cost: 60 },
    { id:"trade", name:"Trade Network", desc:"+Logistics value", cost: 80 },
  ],
  power: [
    { id:"grid", name:"Smart Grid", desc:"+Power cap & stability", cost: 45 },
    { id:"storage", name:"Energy Storage", desc:"Reduces blackout pressure", cost: 75 },
    { id:"overdrive", name:"Overdrive", desc:"High power = big rewards", cost: 95 },
  ],
  civic: [
    { id:"security", name:"Security Net", desc:"Reduces riot pressure", cost: 50 },
    { id:"policies", name:"Policies", desc:"Unlock emergency controls", cost: 70 },
    { id:"arcology", name:"Arcologies", desc:"High density housing", cost: 110 },
  ]
};

const WONDERS = [
  { id:"skyspine", name:"SKYSPINE ARRAY", effect:"Power conversion to credits when surplus" },
  { id:"forgeheart", name:"FORGEHEART CORE", effect:"Industry spikes, pollution manageable" },
  { id:"aegis", name:"AEGIS PROTOCOL", effect:"Crisis pressure reduced + emergency boost" },
  { id:"echelon", name:"ECHELON MARKET", effect:"Contracts pay insane during booms" },
  { id:"oracle", name:"ORACLE GRID", effect:"Tech costs reduced & automation unlock" },
  { id:"riftseal", name:"RIFT SEAL", effect:"Rifts become profit instead of danger" },
  { id:"helios", name:"HELIOS TOWER", effect:"Storms become resources" },
  { id:"atlasgate", name:"ATLAS GATE", effect:"Prestige bonuses amplified" },
];

export class Progression {
  constructor() {
    this._era = 0;
    this._xp = 0;
    this._doctrine = null;
    this._tech = new Set();
    this._rp = 0; // research points
    this._wondersBuilt = 0;
    this._wonderKeys = new Map(); // tileId -> wonderId
    this._mutations = [];
    this._prestige = 0;
  }

  state() {
    return {
      era: this._era, xp: this._xp, doctrine: this._doctrine,
      tech: Array.from(this._tech),
      rp: this._rp,
      wondersBuilt: this._wondersBuilt,
      wonderKeys: Array.from(this._wonderKeys.entries()),
      mutations: this._mutations,
      prestige: this._prestige,
    };
  }

  loadState(st) {
    if (!st) return;
    this._era = st.era ?? 0;
    this._xp = st.xp ?? 0;
    this._doctrine = st.doctrine ?? null;
    this._tech = new Set(st.tech ?? []);
    this._rp = st.rp ?? 0;
    this._wondersBuilt = st.wondersBuilt ?? 0;
    this._wonderKeys = new Map(st.wonderKeys ?? []);
    this._mutations = st.mutations ?? [];
    this._prestige = st.prestige ?? 0;
  }

  era() { return this._era; }
  doctrine() { return this._doctrine; }
  doctrines() { return DOCTRINES; }
  techTree() { return TECH; }
  wonders() { return WONDERS; }

  isWonderUnlocked() {
    return this._tech.has("policies") || this._rp >= 65 || this._era >= 1;
  }

  maxBuildingLevel(type) {
    // era gating
    const base = 4 + this._era * 2;
    if (type === "wonder") return 3 + this._era;
    return clamp(base, 4, 14);
  }

  chooseDoctrine(id) {
    if (this._doctrine) return false;
    this._doctrine = id;
    return true;
  }

  addResearch(amount) {
    this._rp += amount;
  }

  canBuyTech(id) {
    if (this._tech.has(id)) return false;
    const node = this.findTech(id);
    if (!node) return false;
    return this._rp >= node.cost;
  }

  buyTech(id) {
    if (!this.canBuyTech(id)) return false;
    const node = this.findTech(id);
    this._rp -= node.cost;
    this._tech.add(id);
    return true;
  }

  findTech(id) {
    for (const k of Object.keys(TECH)) {
      for (const n of TECH[k]) if (n.id === id) return n;
    }
    return null;
  }

  assignWonder(tile) {
    // deterministically assign by tileId if not yet
    if (this._wonderKeys.has(tile.id)) return this._wonderKeys.get(tile.id);
    const pick = WONDERS[(tile.id + this._wondersBuilt) % WONDERS.length].id;
    this._wonderKeys.set(tile.id, pick);
    return pick;
  }

  wonderInfoById(id) {
    return WONDERS.find(w => w.id === id) || WONDERS[0];
  }

  tick(dt, sim, eco, crisis) {
    // earn research from research tiles + era
    const g = sim.g;
    const techMult = this._tech.has("oracle") ? 1.12 : 1.0;
    this.addResearch((g.research * 0.20) * dt * techMult);

    // XP toward era: based on city scale + stability mastery
    const cityScale = (g.pop * 0.012 + g.industry * 0.18 + g.logistics * 0.28);
    const mastery = (g.stability * 0.8 + Math.max(0, g.power) * 0.004);
    this._xp += (cityScale + mastery) * dt * 0.25;

    // era thresholds
    const need = 280 + this._era * 520;
    if (this._xp >= need) {
      this._xp -= need;
      this.advanceEra(sim, eco, crisis);
    }

    // Wonder progress
    // Wonders progress via industry + stability; crises slow them
    const built = sim.world.tiles.filter(t => t.discovered && t.building?.type === "wonder");
    for (const t of built) {
      t.wonder = t.wonder || { key: this.assignWonder(t), prog: 0 };
      const slow = crisis.level > 40 ? 0.65 : 1.0;
      const rate = (g.industry * 0.0018 + g.stability * 0.09) * dt * slow;
      t.wonder.prog = clamp(t.wonder.prog + rate, 0, 1);
      if (t.wonder.prog >= 1 && !t.wonder.done) {
        t.wonder.done = true;
        this._wondersBuilt++;
        // big reward burst
        sim.g.credits += 900 + this._era * 350;
        // rule bends: tech boost
        this._rp += 60 + this._era * 15;
        // reduce crisis pressure a bit as “stabilization”
        crisis.level = Math.max(0, crisis.level - 12);
        crisis.blackout = Math.max(0, crisis.blackout - 10);
        crisis.riot = Math.max(0, crisis.riot - 10);
      }
    }
  }

  advanceEra(sim, eco, crisis) {
    this._era++;
    sim.g.era = this._era;
    // mild “reset pressure” but not brutal
    crisis.level = Math.max(0, crisis.level - 10);

    // mutation choice is handled in UI later; we seed a random list for now
    if (this._mutations.length < this._era) {
      const picks = ["NEON_OVERDRIVE", "GRID_HARDENED", "MARKET_FEVER", "STORM_HARVEST", "ARC_DENSITY", "BLACKOUT_PROOF"];
      this._mutations.push(picks[(this._era * 7) % picks.length]);
    }

    // era reward
    sim.g.credits += 650 + this._era * 250;
    this._rp += 35 + this._era * 10;
  }

  cheatUnlockAll() {
    for (const k of Object.keys(TECH)) for (const n of TECH[k]) this._tech.add(n.id);
    this._rp += 9999;
  }

  cheatAdvanceEra(sim, eco) {
    this._xp = 1e9;
  }
}

