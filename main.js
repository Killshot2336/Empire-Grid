import { clamp, fmt, nowMs } from "./engine/util.js";
import { RNG } from "./engine/rng.js";
import { SaveSystem } from "./engine/saveSystem.js";
import { MapGenerator } from "./engine/mapGenerator.js";
import { Camera } from "./engine/camera.js";
import { Simulation } from "./engine/simulation.js";
import { Economy } from "./engine/economy.js";
import { CrisisSystem } from "./engine/crisisSystem.js";
import { Progression } from "./engine/progression.js";
import { RenderManager } from "./engine/renderManager.js";
import { EffectsManager } from "./engine/effectsManager.js";
import { PerformanceManager } from "./engine/performanceManager.js";

import { HUD } from "./ui/hud.js";
import { Panels } from "./ui/panels.js";
import { Tutorial } from "./ui/tutorial.js";
import { Input } from "./ui/input.js";

/* ===========================
   Empire Grid — Main Entrypoint
   =========================== */

const canvas = document.getElementById("game");
const boot = document.getElementById("boot");
const btnStart = document.getElementById("btnStart");
const btnContinue = document.getElementById("btnContinue");
const seedInput = document.getElementById("seedInput");
const modeSelect = document.getElementById("modeSelect");
const chkAutoPerf = document.getElementById("chkAutoPerf");
const chkCreator = document.getElementById("chkCreator");
const bootFoot = document.getElementById("bootFoot");

const adminLock = document.getElementById("adminLock");
const adminPass = document.getElementById("adminPass");
const adminEnter = document.getElementById("adminEnter");
const adminCancel = document.getElementById("adminCancel");
const adminMsg = document.getElementById("adminMsg");

const save = new SaveSystem("empireGrid_v3_holy");

let state = null;
let running = false;
let last = nowMs();

const perf = new PerformanceManager();
const fx = new EffectsManager();
const camera = new Camera();
const render = new RenderManager(canvas, camera, perf, fx);

let hud = null;
let panels = null;
let tutorial = null;
let input = null;

function defaultNewGame({ seed, mode, autoPerf, creator }) {
  const rng = new RNG(seed || RNG.makeSeed());
  const gen = new MapGenerator(rng);
  const world = gen.generateMegaregion({
    w: 140, h: 90,
    waterLevel: 0.48,
    mountainLevel: 0.72,
    anomalyRate: 0.015,
    resourceRate: 0.055
  });

  const progression = new Progression();
  const sim = new Simulation(world, progression);
  const eco = new Economy(sim, progression);
  const crisis = new CrisisSystem(sim, progression, rng);

  const gs = perf.defaultGraphics(autoPerf);
  gs.creatorMode = !!creator;

  const s = {
    meta: {
      version: 3,
      createdAt: Date.now(),
      seed: rng.seed,
      mode,
    },
    rngState: rng.state(),
    world,
    simState: sim.state(),
    ecoState: eco.state(),
    progState: progression.state(),
    crisisState: crisis.state(),
    ui: {
      selectedBuild: "residential",
      overlay: "none",
      graphics: gs,
      speed: 1,
      tutorialDone: false,
    }
  };

  return { s, rng, sim, eco, progression, crisis };
}

function setupFromSave(blob) {
  const rng = new RNG(blob.meta.seed);
  rng.loadState(blob.rngState);

  const progression = new Progression();
  progression.loadState(blob.progState);

  const sim = new Simulation(blob.world, progression);
  sim.loadState(blob.simState);

  const eco = new Economy(sim, progression);
  eco.loadState(blob.ecoState);

  const crisis = new CrisisSystem(sim, progression, rng);
  crisis.loadState(blob.crisisState);

  return { s: blob, rng, sim, eco, progression, crisis };
}

function mountUI() {
  hud = new HUD(document.getElementById("hudRoot"));
  panels = new Panels(document.getElementById("hudRoot"));
  tutorial = new Tutorial();
  input = new Input(canvas, camera);

  hud.mount();
  panels.mount();

  panels.onAction = (action) => {
    if (!state) return;
    const { sim } = state;

    switch (action.type) {
      case "selectBuild":
        state.s.ui.selectedBuild = action.id;
        break;
      case "toggleOverlay":
        state.s.ui.overlay = action.id;
        break;
      case "setSpeed":
        state.s.ui.speed = clamp(action.value, 0.5, 3);
        break;
      case "setGraphics":
        state.s.ui.graphics = action.value;
        break;
      case "exportSave":
        panels.showExport(save.exportString(state.s));
        break;
      case "importSave":
        {
          const blob = save.importString(action.value);
          if (!blob) return panels.toast("Invalid import.");
          hardLoad(blob);
          panels.toast("Imported save.");
        }
        break;
      case "wipeSave":
        save.clear();
        panels.toast("Save wiped.");
        showBoot("Save wiped.");
        break;
      case "newGame":
        save.clear();
        showBoot("New game ready.");
        break;
      case "center":
        camera.centerOn(sim.state().cameraFocusX, sim.state().cameraFocusY);
        break;
      case "toggleCreator":
        state.s.ui.graphics.creatorMode = !state.s.ui.graphics.creatorMode;
        break;
      default:
        break;
    }
  };

  input.onTap = (wx, wy) => {
    if (!state) return;
    if (tutorial && tutorial.locked()) return;

    const { sim, eco } = state;

    const tile = sim.pickTile(wx, wy);
    if (!tile) return;

    // Build placement / upgrade
    const mode = state.s.meta.mode;
    const buildId = state.s.ui.selectedBuild;

    const result = eco.tryBuildOrUpgrade(tile, buildId, mode === "creative");
    if (result.ok) {
      fx.burst(tile.x, tile.y, result.fx || "build");
      fx.floatText(tile.x, tile.y, result.text, result.color);
      fx.thump(result.thump || 0.6);
      sim.setCameraFocus(tile.x, tile.y);
      maybeProgressTutorial("buildPlaced");
      autosave();
    } else if (result.msg) {
      panels.toast(result.msg);
      fx.thump(0.2);
    }
  };

  input.onDrag = (dx, dy) => {
    camera.pan(dx, dy);
  };
  input.onZoom = (z, cx, cy) => {
    camera.zoom(z, cx, cy);
  };
}

function updateBootContinueButton() {
  btnContinue.disabled = !save.has();
  btnContinue.textContent = save.has() ? "Continue" : "No Save";
}

function showBoot(msg = "") {
  boot.classList.remove("hidden");
  bootFoot.textContent = msg;
  updateBootContinueButton();
  running = false;
}

function hideBoot() {
  boot.classList.add("hidden");
}

function hardLoad(blob) {
  state = setupFromSave(blob);
  // apply graphics
  perf.apply(state.s.ui.graphics);
  render.setGraphics(state.s.ui.graphics);
  camera.resetForWorld(state.s.world, render.pixelRatio);
  camera.load(state.s.simState?.camera || null);
  last = nowMs();
  running = true;

  // tutorial
  if (!state.s.ui.tutorialDone && state.s.meta.mode !== "creative") {
    startTutorial();
  } else {
    tutorial.end();
  }
}

function startNewGame(seed, mode) {
  const autoPerf = chkAutoPerf.checked;
  const creator = chkCreator.checked;
  state = defaultNewGame({ seed, mode, autoPerf, creator });
  perf.apply(state.s.ui.graphics);
  render.setGraphics(state.s.ui.graphics);
  camera.resetForWorld(state.s.world, render.pixelRatio);
  last = nowMs();
  running = true;

  if (mode !== "creative") startTutorial();
  else tutorial.end();

  autosave(true);
}

function autosave(force = false) {
  if (!state) return;
  save.write(state.s, force);
}

function maybeProgressTutorial(signal) {
  if (!tutorial) return;
  if (!state) return;
  const advanced = tutorial.signal(signal, state);
  if (advanced) {
    // small reward burst
    fx.thump(0.3);
  }
  if (tutorial.done()) {
    state.s.ui.tutorialDone = true;
    autosave(true);
  }
}

function loop() {
  requestAnimationFrame(loop);
  if (!running || !state) return;

  const t = nowMs();
  let dt = (t - last) / 1000;
  last = t;

  // clamp dt for tab hitch
  dt = clamp(dt, 0, 0.075);

  const speed = state.s.ui.speed || 1;
  const gs = state.s.ui.graphics || perf.defaultGraphics(true);

  // Performance: cap speed on potato/low to avoid death
  const speedCap = gs.preset === "potato" ? 1.25 : (gs.preset === "low" ? 1.75 : 3);
  const simSpeed = Math.min(speed, speedCap);

  const { sim, eco, crisis, progression } = state;

  // Update managers
  perf.tick(dt);
  fx.tick(dt, gs);

  // Sim tick
  sim.tick(dt * simSpeed, gs);
  eco.tick(dt * simSpeed, gs);
  crisis.tick(dt * simSpeed, gs);

  // Progression ticks (eras/wonders/tech)
  progression.tick(dt * simSpeed, sim, eco, crisis);

  // Tutorial runner
  tutorial.tick(dt, state, render);

  // Update UI
  hud.render(state, fmt);
  panels.render(state, fmt);

  // Render world
  render.draw(state, gs);

  // Autosave occasionally
  save.maybeAuto(state.s);
}

function bindBoot() {
  btnStart.addEventListener("click", () => {
    const seed = seedInput.value.trim();
    const mode = modeSelect.value;
    hideBoot();
    startNewGame(seed || null, mode);
  });

  btnContinue.addEventListener("click", () => {
    const blob = save.read();
    if (!blob) return;
    hideBoot();
    hardLoad(blob);
  });
}

function bindAdmin() {
  // Ctrl+Shift+A (or on mobile: triple-tap top-left corner)
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
      openAdmin();
    }
  });

  adminCancel.addEventListener("click", closeAdmin);
  adminEnter.addEventListener("click", tryAdminEnter);
  adminPass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryAdminEnter();
  });
}

function openAdmin() {
  adminLock.classList.remove("hidden");
  adminPass.value = "";
  adminMsg.textContent = "";
  adminPass.focus();
}

function closeAdmin() {
  adminLock.classList.add("hidden");
}

function tryAdminEnter() {
  const pass = adminPass.value.trim();
  // Passcode: BAKER (you can change)
  if (pass !== "BAKER") {
    adminMsg.textContent = "Wrong passcode.";
    return;
  }
  closeAdmin();
  panels.openAdminTools((tool) => {
    if (!state) return;
    const { eco, sim, progression, crisis } = state;

    if (tool === "addMoney") {
      eco.cheatAdd("credits", 500000);
      fx.thump(0.5);
    }
    if (tool === "unlockAll") {
      progression.cheatUnlockAll();
      fx.thump(0.7);
    }
    if (tool === "skipEra") {
      progression.cheatAdvanceEra(sim, eco);
      fx.thump(0.8);
    }
    if (tool === "healCrisis") {
      crisis.cheatCalm();
      fx.thump(0.6);
    }
    if (tool === "wipe") {
      save.clear();
      showBoot("Save wiped.");
    }
    autosave(true);
  });
}

function startTutorial() {
  tutorial.start(state, render, () => autosave(true), (sig) => maybeProgressTutorial(sig));
}

/* Mobile admin: triple-tap corner */
let cornerTaps = [];
let allowMobileAdmin = false;

// enable mobile admin only after first user interaction
window.addEventListener("pointerup", () => {
  allowMobileAdmin = true;
}, { once: true });

window.addEventListener("pointerdown", (e) => {
  if (!allowMobileAdmin) return;

  if (boot && !boot.classList.contains("hidden")) return;
  const near = e.clientX < 60 && e.clientY < 60;
  if (!near) return;
  const t = Date.now();
  cornerTaps.push(t);
  cornerTaps = cornerTaps.filter(x => t - x < 900);
  if (cornerTaps.length >= 3) {
    cornerTaps = [];
    openAdmin();
  }
});

function init() {
  mountUI();
  bindBoot();
  bindAdmin();

  // default
  updateBootContinueButton();

  // If saved game exists, show quick info
  if (save.has()) {
    const blob = save.read();
    if (blob?.meta) {
      bootFoot.textContent = `Saved: ${blob.meta.mode.toUpperCase()} • Seed ${blob.meta.seed}`;
    }
  }

  // fit canvas
  render.resize();
  window.addEventListener("resize", () => render.resize());

  showBoot("");
  loop();
}

init();

