export class SaveSystem {
  constructor(key) {
    this.key = key;
    this.lastWrite = 0;
    this.autoEveryMs = 8000;
  }
  has() {
    return !!localStorage.getItem(this.key);
  }
  read() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  write(blob, force = false) {
    const t = Date.now();
    if (!force && t - this.lastWrite < 1000) return;
    this.lastWrite = t;
    localStorage.setItem(this.key, JSON.stringify(blob));
  }
  maybeAuto(blob) {
    const t = Date.now();
    if (t - this.lastWrite >= this.autoEveryMs) {
      this.write(blob, true);
    }
  }
  clear() {
    localStorage.removeItem(this.key);
  }
  exportString(blob) {
    const raw = JSON.stringify(blob);
    return btoa(unescape(encodeURIComponent(raw)));
  }
  importString(str) {
    try {
      const raw = decodeURIComponent(escape(atob(str.trim())));
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
