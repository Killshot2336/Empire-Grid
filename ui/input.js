export class Input {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;

    this.onTap = null;
    this.onDrag = null;
    this.onZoom = null;

    this._down = false;
    this._last = null;
    this._dragging = false;

    this._pinch = null;

    canvas.addEventListener("pointerdown", (e) => this._pd(e));
    canvas.addEventListener("pointermove", (e) => this._pm(e));
    canvas.addEventListener("pointerup", (e) => this._pu(e));
    canvas.addEventListener("pointercancel", (e) => this._pu(e));

    // wheel zoom desktop
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = (e.deltaY > 0 ? -0.08 : 0.08);
      this.onZoom?.(delta, e.clientX, e.clientY);
    }, { passive:false });
  }

  _pd(e) {
    this._down = true;
    this._dragging = false;
    this._last = { x:e.clientX, y:e.clientY, id:e.pointerId, t:performance.now() };

    // pinch support
    this.canvas.setPointerCapture(e.pointerId);
    if (!this._pinch) this._pinch = new Map();
    this._pinch.set(e.pointerId, { x:e.clientX, y:e.clientY });
  }

  _pm(e) {
    if (!this._down) return;

    // update pinch
    if (this._pinch?.has(e.pointerId)) {
      this._pinch.set(e.pointerId, { x:e.clientX, y:e.clientY });
    }

    // pinch zoom if 2 pointers
    if (this._pinch && this._pinch.size === 2) {
      const pts = Array.from(this._pinch.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (!this._pinch._d0) this._pinch._d0 = d;
      const delta = (d - this._pinch._d0) / 420;
      this._pinch._d0 = d;
      const cx = (pts[0].x + pts[1].x) * 0.5;
      const cy = (pts[0].y + pts[1].y) * 0.5;
      this.onZoom?.(delta, cx, cy);
      this._dragging = true;
      return;
    }

    const dx = e.clientX - this._last.x;
    const dy = e.clientY - this._last.y;
    const dist = Math.hypot(dx,dy);

    if (dist > 3) this._dragging = true;
    if (this._dragging) this.onDrag?.(dx, dy);

    this._last.x = e.clientX;
    this._last.y = e.clientY;
  }

  _pu(e) {
    if (this._pinch?.has(e.pointerId)) {
      this._pinch.delete(e.pointerId);
      if (this._pinch.size < 2) this._pinch._d0 = null;
    }

    const wasDrag = this._dragging;
    this._down = false;

    if (!wasDrag && this._last) {
      // tap
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = this.camera.screenToWorld(this._last.x, this._last.y, vw, vh);
      this.onTap?.(w.x, w.y);
    }
    this._last = null;
  }
}
