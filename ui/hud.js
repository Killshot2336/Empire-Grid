export class HUD {
  constructor(root) {
    this.root = root;
    this.el = null;
  }

  mount() {
    const hud = document.createElement("div");
    hud.className = "hud";
    hud.innerHTML = `
      <div class="bar">
        <div class="barTop">
          <div>
            <div class="title">EMPIRE GRID</div>
            <div class="subline" id="subline"></div>
          </div>
          <div class="pillRow">
            <div class="pill hot" id="pillMode"></div>
            <div class="pill" id="pillSeed"></div>
            <div class="pill" id="pillEra"></div>
          </div>
        </div>

        <div class="statRow">
          <div class="stat"><div class="k">CREDITS</div><div class="v" id="vCredits"></div></div>
          <div class="stat"><div class="k">POWER</div><div class="v" id="vPower"></div></div>
          <div class="stat"><div class="k">POPULATION</div><div class="v" id="vPop"></div></div>
          <div class="stat"><div class="k">STABILITY</div><div class="v" id="vStab"></div></div>
          <div class="stat"><div class="k">RESEARCH</div><div class="v" id="vRp"></div></div>
        </div>

        <div class="pillRow">
          <div class="pill" id="pillCrisis"></div>
          <div class="pill" id="pillWeather"></div>
        </div>
      </div>
    `;
    this.root.appendChild(hud);
    this.el = hud;
  }

  render(state, fmt) {
    if (!this.el) return;
    const g = state.sim.g;
    const crisis = state.crisis;
    const cs = crisis.status();

    this.el.querySelector("#subline").textContent =
      `${state.progression.doctrine() ? "Doctrine: " + state.progression.doctrine().toUpperCase() : "Choose your doctrine soon."}`;

    this.el.querySelector("#pillMode").textContent = state.s.meta.mode.toUpperCase();
    this.el.querySelector("#pillSeed").textContent = `SEED ${state.s.meta.seed}`;
    this.el.querySelector("#pillEra").textContent = `ERA ${state.progression.era()}`;

    this.el.querySelector("#vCredits").textContent = fmt(g.credits);
    this.el.querySelector("#vPower").textContent = `${fmt(g.power)} / ${fmt(g.powerCap)}`;
    this.el.querySelector("#vPop").textContent = fmt(g.pop);
    this.el.querySelector("#vStab").textContent = fmt(g.stability);
    this.el.querySelector("#vRp").textContent = fmt(state.progression.state().rp);

    const crisisPill = this.el.querySelector("#pillCrisis");
    crisisPill.className = `pill ${cs.cls}`;
    crisisPill.textContent = `CRISIS: ${cs.k}${crisis.state().msg ? " • " + crisis.state().msg : ""}`;

    const storm = state.sim.isStorming();
    const w = this.el.querySelector("#pillWeather");
    w.className = `pill ${storm ? "warn" : ""}`;
    w.textContent = `WEATHER: ${storm ? "STORM" : "CLEAR"}`;
  }
}
