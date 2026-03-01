export class Tutorial {
  constructor() {
    this.active = false;
    this.step = 0;
    this._locked = false;
    this._done = false;

    this._spot = document.getElementById("spotlight");
    this._mask = document.getElementById("spotMask");
    this._box = document.getElementById("spotBox");
    this._title = document.getElementById("spotTitle");
    this._text = document.getElementById("spotText");
    this._next = document.getElementById("spotNext");
    this._skip = document.getElementById("spotSkip");

    this._onSave = null;
    this._onSignal = null;

    this._targets = []; // {sx,sy,sr,bx,by}
    this._waitFor = null;

    this._next.onclick = () => this.advance();
    this._skip.onclick = () => this.end(true);
  }

  start(state, render, onSave, onSignal) {
    this.active = true;
    this.step = 0;
    this._done = false;
    this._onSave = onSave;
    this._onSignal = onSignal;

    this._spot.classList.remove("hidden");
    this.advance();
  }

  locked() { return this.active && this._locked; }
  done() { return this._done; }

  end(skipped = false) {
    this.active = false;
    this._locked = false;
    this._done = true;
    this._spot.classList.add("hidden");
    this._waitFor = null;
    if (!skipped) this._onSave?.();
  }

  signal(sig, state) {
    if (!this.active) return false;
    if (this._waitFor && this._waitFor === sig) {
      this._waitFor = null;
      this.advance();
      return true;
    }
    return false;
  }

  tick(dt, state, render) {
    if (!this.active) return;
    // keep spotlight stable; nothing heavy needed
  }

  advance() {
    this.step++;

    // Steps: forced actions minimal and clear
    if (this.step === 1) {
      this._locked = true;
      this._title.textContent = "WAKE THE GRID";
      this._text.textContent = "Tap a discovered tile to place your first RESIDENTIAL block. This creates population and credits.";
      this._waitFor = "buildPlaced";
      this._setSpot(0.18, 0.18, 90, 0.55, 0.74);
      return;
    }
    if (this.step === 2) {
      this._locked = false;
      this._title.textContent = "POWER OR DIE";
      this._text.textContent = "Now place POWER. If power goes negative, blackouts cascade.";
      this._waitFor = "buildPlaced";
      this._setSpot(0.50, 0.18, 90, 0.55, 0.74);
      return;
    }
    if (this.step === 3) {
      this._locked = false;
      this._title.textContent = "STABILITY";
      this._text.textContent = "Place CIVIC to raise stability. Low stability triggers riots and district lock-downs.";
      this._waitFor = "buildPlaced";
      this._setSpot(0.76, 0.18, 90, 0.55, 0.74);
      return;
    }
    if (this.step === 4) {
      this._locked = false;
      this._title.textContent = "BUILD IDENTITY";
      this._text.textContent = "Your city is a machine. Different builds exist. Experiment: Industry + Logistics creates explosive growth.";
      this._setSpot(0.84, 0.28, 90, 0.55, 0.74);
      return;
    }
    if (this.step === 5) {
      this._locked = false;
      this._title.textContent = "YOU’RE FREE";
      this._text.textContent = "Tutorial complete. Overlays + settings exist for performance. Find relics. Build wonders. Survive the chaos.";
      this._next.textContent = "Finish";
      this._setSpot(0.50, 0.50, 160, 0.50, 0.70);
      return;
    }
    this.end(false);
  }

  _setSpot(sx, sy, sr, bx, by) {
    // sx,sy,bx,by are relative screen percents
    const px = `${sx * 100}%`;
    const py = `${sy * 100}%`;
    const pr = `${sr}px`;
    const pbx = `${bx * 100}%`;
    const pby = `${by * 100}%`;

    this._mask.style.setProperty("--sx", px);
    this._mask.style.setProperty("--sy", py);
    this._mask.style.setProperty("--sr", pr);
    this._box.style.setProperty("--bx", pbx);
    this._box.style.setProperty("--by", pby);
  }
}
