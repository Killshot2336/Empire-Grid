import { clamp, lerp } from "./util.js";

export class RenderManager {
  constructor(canvas, camera, perf, fx) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.camera = camera;
    this.perf = perf;
    this.fx = fx;
    this.pixelRatio = Math.min(2, window.devicePixelRatio || 1);

    this._w = 0;
    this._h = 0;

    this._noise = this._makeNoiseCanvas(256, 256);
    this._t = 0;

    this.graphics = null;
  }

  setGraphics(gs) { this.graphics = gs; }

  resize() {
    this.pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    this._w = Math.floor(window.innerWidth * this.pixelRatio);
    this._h = Math.floor(window.innerHeight * this.pixelRatio);
    this.canvas.width = this._w;
    this.canvas.height = this._h;
    this.canvas.style.width = window.innerWidth + "px";
    this.canvas.style.height = window.innerHeight + "px";
    this.ctx.setTransform(1,0,0,1,0,0);
  }

  draw(state, gs) {
    this._t += 0.016;
    const ctx = this.ctx;
    const w = this._w, h = this._h;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,w,h);

    // Background
    this._drawBackground(state, gs);

    // World
    this._drawWorld(state, gs);

    // Effects
    this._drawEffects(state, gs);

    // Creator overlay
    if (gs.creatorMode) this._drawCreator(state);
  }

  _drawBackground(state, gs) {
    const ctx = this.ctx;
    const w = this._w, h = this._h;
    const day = state.sim.g.day;
    const night = day < 0.25 || day > 0.75;
    const storm = state.sim.isStorming() ? state.sim.stormLevel() : 0;

    // gradient
    const g = ctx.createRadialGradient(w*0.35, h*0.25, 60, w*0.5, h*0.55, Math.max(w,h));
    g.addColorStop(0, `rgba(${night?18:24},${night?30:40},${night?68:90},1)`);
    g.addColorStop(0.55, `rgba(${night?6:10},${night?10:14},${night?24:34},1)`);
    g.addColorStop(1, `rgba(2,3,6,1)`);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    // skyline + parallax
    if (gs.skyline) {
      const shift = (Math.sin(this._t*0.2)*0.5+0.5);
      const baseY = h*0.32 + storm*h*0.05;
      const layers = gs.parallax ? 2 : 1;

      for (let L = 0; L < layers; L++) {
        const p = L===0 ? 0.55 : 0.35;
        const off = Math.sin(this._t*0.06 + L)*24*this.pixelRatio;
        ctx.globalAlpha = L===0 ? 0.7 : 0.35;
        ctx.fillStyle = L===0 ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.35)";
        ctx.beginPath();
        ctx.moveTo(0, h);
        let x = 0;
        while (x <= w+40) {
          const bw = (22 + (x*0.0008*w*0.0) + Math.random()*18) * this.pixelRatio;
          const bh = (30 + (Math.sin((x*0.002)+this._t*0.1)*0.5+0.5)*120) * this.pixelRatio * (L===0?1:0.8);
          ctx.lineTo(x, baseY + off + (L*18*this.pixelRatio) - bh);
          ctx.lineTo(x + bw, baseY + off + (L*18*this.pixelRatio) - bh);
          x += bw;
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // fog/noise
    if (gs.fog) {
      ctx.globalAlpha = 0.20 + (storm * 0.22);
      ctx.drawImage(this._noise, 0,0,w,h);
      ctx.globalAlpha = 1;
    }

    // storm flashes
    if (storm > 0.2 && gs.weather && Math.random() < 0.03) {
      ctx.globalAlpha = 0.08 + storm * 0.10;
      ctx.fillStyle = "rgba(200,240,255,1)";
      ctx.fillRect(0,0,w,h);
      ctx.globalAlpha = 1;
    }
  }

  _drawWorld(state, gs) {
    const { world } = state.sim;
    const ctx = this.ctx;
    const w = this._w, h = this._h;
    const cam = this.camera;
    const ts = cam.tileSize * cam.zoomLevel * this.pixelRatio;

    // draw visible tiles (viewport cull)
    const leftTop = cam.screenToWorld(0, 0, w/this.pixelRatio, h/this.pixelRatio);
    const rightBot = cam.screenToWorld(w/this.pixelRatio, h/this.pixelRatio, w/this.pixelRatio, h/this.pixelRatio);

    const x0 = Math.max(0, Math.floor(leftTop.x) - 2);
    const y0 = Math.max(0, Math.floor(leftTop.y) - 2);
    const x1 = Math.min(world.w - 1, Math.ceil(rightBot.x) + 2);
    const y1 = Math.min(world.h - 1, Math.ceil(rightBot.y) + 2);

    // slight parallax grid drift
    const drift = gs.parallax ? Math.sin(this._t*0.08) * 6 * this.pixelRatio : 0;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = world.tiles[y*world.w + x];
        const s = cam.worldToScreen(x, y, w/this.pixelRatio, h/this.pixelRatio);
        const sx = s.x * this.pixelRatio + drift;
        const sy = s.y * this.pixelRatio;

        // tile base
        const discovered = t.discovered;
        const alpha = discovered ? 1 : 0.12;

        // terrain colors
        const terr = t.terrain;
        let base = "rgba(8,12,20,.55)";
        if (terr === "water") base = "rgba(12,32,58,.68)";
        if (terr === "fertile") base = "rgba(12,36,28,.62)";
        if (terr === "badlands") base = "rgba(40,24,20,.62)";
        if (terr === "highland") base = "rgba(18,24,42,.62)";
        if (terr === "mountain") base = "rgba(18,18,22,.68)";

        ctx.globalAlpha = alpha;
        ctx.fillStyle = base;
        ctx.fillRect(sx, sy, ts, ts);

        // grid lines
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = "rgba(125,243,255,.10)";
        ctx.lineWidth = Math.max(1, this.pixelRatio);
        ctx.strokeRect(sx+0.5, sy+0.5, ts-1, ts-1);

        if (!discovered) continue;

        // resources glow
        if (t.res && gs.glow) {
          const col = t.res === "oil" ? "rgba(255,180,84,.18)" :
                      t.res === "silicon" ? "rgba(125,243,255,.18)" :
                      t.res === "rare" ? "rgba(255,79,216,.16)" : "rgba(77,255,136,.14)";
          ctx.fillStyle = col;
          ctx.fillRect(sx+2, sy+2, ts-4, ts-4);
        }

        // anomalies
        if (t.anomaly && gs.glow) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = t.anomaly === "rift" ? "rgba(255,79,216,.45)" : "rgba(125,243,255,.40)";
          ctx.beginPath();
          ctx.arc(sx + ts*0.82, sy + ts*0.18, Math.max(2, ts*0.10), 0, Math.PI*2);
          ctx.fill();
        }

        // buildings
        if (t.building) this._drawBuilding(t, sx, sy, ts, gs);
      }
    }

    ctx.globalAlpha = 1;
  }

  _drawBuilding(t, sx, sy, ts, gs) {
    const ctx = this.ctx;
    const lvl = t.building.lvl;
    const type = t.building.type;

    // building footprint
    const pad = ts * 0.12;
    const bx = sx + pad;
    const by = sy + pad;
    const bw = ts - pad*2;
    const bh = ts - pad*2;

    // height visual (vertical growth)
    const h = clamp((lvl * 0.10 + 0.06) * ts, ts*0.12, ts*0.82);

    // base color per type
    let colA = "rgba(20,28,44,.86)";
    let glow = "rgba(125,243,255,.22)";
    if (type === "industrial") { colA = "rgba(34,22,18,.88)"; glow = "rgba(255,180,84,.22)"; }
    if (type === "power") { colA = "rgba(18,34,28,.88)"; glow = "rgba(77,255,136,.22)"; }
    if (type === "civic") { colA = "rgba(28,18,34,.88)"; glow = "rgba(255,79,216,.20)"; }
    if (type === "research") { colA = "rgba(16,26,40,.88)"; glow = "rgba(125,243,255,.26)"; }
    if (type === "logistics") { colA = "rgba(26,26,18,.88)"; glow = "rgba(255,180,84,.18)"; }
    if (type === "wonder") { colA = "rgba(20,16,34,.92)"; glow = "rgba(255,79,216,.26)"; }

    // body
    ctx.globalAlpha = 1;
    ctx.fillStyle = colA;
    ctx.fillRect(bx, by + (bh - h), bw, h);

    // neon edge
    if (gs.glow) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = glow;
      ctx.lineWidth = Math.max(1.2, this.pixelRatio);
      ctx.strokeRect(bx+0.5, by + (bh - h) + 0.5, bw-1, h-1);
    }

    // windows / lights (night)
    if (gs.lighting) {
      const day = this._dayFactor(t);
      const lit = day < 0.55;
      ctx.globalAlpha = lit ? 0.95 : 0.45;

      const cols = Math.max(2, Math.floor(bw / (ts*0.18)));
      const rows = Math.max(2, Math.floor(h / (ts*0.22)));
      for (let ry = 0; ry < rows; ry++) {
        for (let cx = 0; cx < cols; cx++) {
          const wx = bx + 4 + cx * (bw / cols);
          const wy = (by + (bh - h)) + 4 + ry * (h / rows);
          const ww = Math.max(2, (bw / cols) * 0.35);
          const wh = Math.max(2, (h / rows) * 0.28);

          // flicker based on level/type
          const flick = (Math.sin((wx+wy)*0.02 + this._t*2.2 + lvl) * 0.5 + 0.5);
          const on = flick > 0.32;
          if (!on) continue;

          ctx.fillStyle =
            type === "industrial" ? "rgba(255,180,84,.40)" :
            type === "civic" ? "rgba(255,79,216,.32)" :
            type === "power" ? "rgba(77,255,136,.34)" :
            "rgba(125,243,255,.32)";
          ctx.fillRect(wx, wy, ww, wh);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Wonder progress ring
    if (type === "wonder" && t.wonder && gs.glow) {
      const p = t.wonder.prog || 0;
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = "rgba(255,79,216,.45)";
      ctx.lineWidth = Math.max(2.2, this.pixelRatio*1.8);
      ctx.beginPath();
      ctx.arc(sx + ts*0.5, sy + ts*0.5, ts*0.38, -Math.PI/2, -Math.PI/2 + Math.PI*2*p);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  _dayFactor(t) {
    // estimate day from global time via pseudo
    return 0.5; // overridden by background anyway, keep stable
  }

  _drawEffects(state, gs) {
    const ctx = this.ctx;
    const cam = this.camera;
    const w = this._w, h = this._h;
    const ts = cam.tileSize * cam.zoomLevel * this.pixelRatio;

    // particles
    if (gs.particles) {
      for (const p of this.fx.particles) {
        const s = cam.worldToScreen(p.x + 0.5, p.y + 0.5, w/this.pixelRatio, h/this.pixelRatio);
        const sx = s.x * this.pixelRatio;
        const sy = s.y * this.pixelRatio;

        ctx.globalAlpha = clamp(p.life * 1.8, 0, 1);
        ctx.fillStyle = p.type === "wonder" ? "rgba(255,79,216,.55)" :
                        p.type === "upgrade" ? "rgba(125,243,255,.55)" :
                        "rgba(255,180,84,.45)";
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1.6, ts*0.03), 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // float texts
    for (const f of this.fx.floats) {
      const s = cam.worldToScreen(f.x + 0.5, f.y + 0.2, w/this.pixelRatio, h/this.pixelRatio);
      const sx = s.x * this.pixelRatio;
      const sy = s.y * this.pixelRatio;
      ctx.globalAlpha = f.a;
      ctx.font = `${Math.max(12, ts*0.18)}px ui-monospace, monospace`;
      ctx.fillStyle =
        f.color === "pink" ? "rgba(255,79,216,.92)" :
        f.color === "amber" ? "rgba(255,180,84,.92)" :
        f.color === "ok" ? "rgba(77,255,136,.92)" :
        "rgba(125,243,255,.92)";
      ctx.fillText(f.text, sx, sy);
      ctx.globalAlpha = 1;
    }
  }

  _drawCreator(state) {
    const ctx = this.ctx;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(0,0,0,.30)";
    ctx.fillRect(12*this.pixelRatio, 12*this.pixelRatio, 320*this.pixelRatio, 120*this.pixelRatio);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(125,243,255,.9)";
    ctx.font = `${12*this.pixelRatio}px ui-monospace, monospace`;
    ctx.fillText(`FPS: ${this.perf.fps}`, 20*this.pixelRatio, 34*this.pixelRatio);
    ctx.fillText(`Zoom: ${state.s?.ui?.speed?.toFixed?.(2) ?? ""}`, 20*this.pixelRatio, 54*this.pixelRatio);
  }

  _makeNoiseCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    const img = g.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      img.data[i] = v;
      img.data[i+1] = v;
      img.data[i+2] = v;
      img.data[i+3] = 28;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
}
