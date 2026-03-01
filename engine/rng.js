import { hashStr } from "./util.js";

export class RNG {
  constructor(seed) {
    this.seed = (typeof seed === "string") ? RNG.seedFromString(seed) : (seed ?? RNG.makeSeed());
    this._s = this.seed >>> 0;
  }
  static makeSeed() {
    return (Math.random() * 0xffffffff) >>> 0;
  }
  static seedFromString(str) {
    return hashStr(str) ^ 0x9e3779b9;
  }
  nextU32() {
    // xorshift32
    let x = this._s >>> 0;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5; x >>>= 0;
    this._s = x >>> 0;
    return this._s;
  }
  f() { return (this.nextU32() / 0xffffffff); }
  range(a, b) { return a + (b - a) * this.f(); }
  irange(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[this.irange(0, arr.length - 1)]; }
  chance(p) { return this.f() < p; }
  state() { return { s: this._s >>> 0 }; }
  loadState(st) { if (st?.s != null) this._s = st.s >>> 0; }
}
