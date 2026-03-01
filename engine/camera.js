import { clamp, lerp } from "./util.js";

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoomLevel = 1.0;
    this.minZoom = 0.45;
    this.maxZoom = 2.6;
    this.tileSize = 34;
    this._worldW = 100;
    this._worldH = 60;
    this._pxW = 1920;
    this._pxH = 1080;
  }

  resetForWorld(world, pixelRatio = 1) {
    this._worldW = world.w;
    this._worldH = world.h;
    this.zoomLevel = 1.0;
    this.minZoom = 0.38;
    this.maxZoom = 2.9;
    this.centerOn(world.start.x, world.start.y);
  }

  centerOn(tx, ty) {
    this.x = tx;
    this.y = ty;
  }

  pan(dx, dy) {
    const s = (1 / this.zoomLevel) / this.tileSize;
    this.x -= dx * s;
    this.y -= dy * s;
    this._clamp();
  }

  zoom(delta, cx, cy) {
    const z0 = this.zoomLevel;
    const z1 = clamp(z0 * (1 + delta), this.minZoom, this.maxZoom);

    // zoom around cursor (world position stays stable)
    const before = this.screenToWorld(cx, cy);
    this.zoomLevel = z1;
    const after = this.screenToWorld(cx, cy);
    this.x += (before.x - after.x);
    this.y += (before.y - after.y);
    this._clamp();
  }

  _clamp() {
    const pad = 3;
    this.x = clamp(this.x, -pad, this._worldW - 1 + pad);
    this.y = clamp(this.y, -pad, this._worldH - 1 + pad);
  }

  worldToScreen(wx, wy, vw, vh) {
    const ts = this.tileSize * this.zoomLevel;
    const sx = (wx - this.x) * ts + vw * 0.5;
    const sy = (wy - this.y) * ts + vh * 0.5;
    return { x: sx, y: sy };
  }

  screenToWorld(sx, sy, vw = window.innerWidth, vh = window.innerHeight) {
    const ts = this.tileSize * this.zoomLevel;
    const wx = (sx - vw * 0.5) / ts + this.x;
    const wy = (sy - vh * 0.5) / ts + this.y;
    return { x: wx, y: wy };
  }

  save() {
    return { x: this.x, y: this.y, z: this.zoomLevel };
  }

  load(st) {
    if (!st) return;
    if (typeof st.x === "number") this.x = st.x;
    if (typeof st.y === "number") this.y = st.y;
    if (typeof st.z === "number") this.zoomLevel = st.z;
  }
}

