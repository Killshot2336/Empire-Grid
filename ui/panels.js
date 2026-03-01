export class Panels {
  constructor(root) {
    this.root = root;
    this.onAction = null;
    this._toastT = 0;

    this._adminCb = null;

    this.right = null;
    this.bottom = null;
  }

  mount() {
    this.right = document.createElement("div");
    this.right.className = "rightDock";
    this.right.innerHTML = `
      <div class="card">
        <div class="cardTitle">CONTROL</div>
        <div class="cardBody">
          <div class="row">
            <button id="btnSettings" class="ghost">Settings</button>
            <button id="btnTech" class="ghost">Tech</button>
          </div>
          <div class="row">
            <button id="btnDoctrine" class="ghost">Doctrine</button>
            <button id="btnWonders" class="ghost">Wonders</button>
          </div>
          <div class="row">
            <button id="btnExport" class="ghost">Export</button>
            <button id="btnCenter" class="ghost">Center</button>
          </div>
          <div class="row">
            <button id="btnOverlay" class="ghost">Overlay</button>
            <button id="btnCreative" class="ghost">New/Wipe</button>
          </div>
          <div class="bootFoot" id="toast"></div>
        </div>
      </div>

      <div class="card hidden" id="panel">
        <div class="cardTitle" id="pTitle"></div>
        <div class="cardBody" id="pBody"></div>
      </div>
    `;
    this.root.appendChild(this.right);

    this.bottom = document.createElement("div");
    this.bottom.className = "buildBar";
    this.bottom.innerHTML = `
      <div class="buildInner" id="buildInner"></div>
    `;
    this.root.appendChild(this.bottom);

    // binds
    this.right.querySelector("#btnSettings").onclick = () => this.openSettings();
    this.right.querySelector("#btnTech").onclick = () => this.openTech();
    this.right.querySelector("#btnDoctrine").onclick = () => this.openDoctrine();
    this.right.querySelector("#btnWonders").onclick = () => this.openWonders();
    this.right.querySelector("#btnExport").onclick = () => this.onAction?.({type:"exportSave"});
    this.right.querySelector("#btnCenter").onclick = () => this.onAction?.({type:"center"});
    this.right.querySelector("#btnOverlay").onclick = () => this.openOverlay();
    this.right.querySelector("#btnCreative").onclick = () => this.openWipe();
  }

  toast(msg) {
    const el = this.right.querySelector("#toast");
    el.textContent = msg;
    this._toastT = Date.now();
  }

  render(state, fmt) {
    // build bar
    const builds = ["residential","industrial","power","civic","research","logistics","wonder"];
    const inner = this.bottom.querySelector("#buildInner");
    inner.innerHTML = "";
    for (const id of builds) {
      const label =
        id === "residential" ? ["RESIDENTIAL","Pop + credits"] :
        id === "industrial" ? ["INDUSTRY","Credits + output"] :
        id === "power" ? ["POWER","Grid stability"] :
        id === "civic" ? ["CIVIC","Order + security"] :
        id === "research" ? ["RESEARCH","Tech progression"] :
        id === "logistics" ? ["LOGISTICS","Trade throughput"] :
        ["WONDER","Rule-changing mega"];

      const div = document.createElement("div");
      div.className = "buildItem" + (state.s.ui.selectedBuild === id ? " sel":"");
      div.innerHTML = `<div class="ico"></div><div class="txt"><div class="n">${label[0]}</div><div class="d">${label[1]}</div></div>`;
      div.onclick = () => this.onAction?.({type:"selectBuild", id});
      inner.appendChild(div);
    }

    // toast auto clear
    const el = this.right.querySelector("#toast");
    if (el.textContent && Date.now() - this._toastT > 6000) el.textContent = "";
  }

  _openPanel(title, bodyHtml) {
    const p = this.right.querySelector("#panel");
    p.classList.remove("hidden");
    this.right.querySelector("#pTitle").textContent = title;
    const body = this.right.querySelector("#pBody");
    body.innerHTML = bodyHtml;

    // close affordance via header click
    this.right.querySelector("#pTitle").onclick = () => p.classList.add("hidden");
  }

  openSettings() {
    const presets = ["ultra","high","medium","low","potato"];
    this._openPanel("SETTINGS", `
      <div class="row">
        <button id="btnCreator" class="ghost">Creator Mode</button>
        <button id="btnWipe" class="ghost">Wipe Save</button>
      </div>
      <div class="row">
        <button id="btnNew" class="ghost">New Game</button>
        <button id="btnImport" class="ghost">Import</button>
      </div>

      <div style="margin-top:10px; font-family:var(--mono); letter-spacing:.10em; font-weight:800; font-size:12px;">GRAPHICS</div>
      <div class="row">
        <select id="gfxPreset">
          ${presets.map(p=>`<option value="${p}">${p.toUpperCase()}</option>`).join("")}
        </select>
        <button id="btnApply" class="ghost">Apply</button>
      </div>

      <div style="margin-top:10px; font-family:var(--mono); letter-spacing:.10em; font-weight:800; font-size:12px;">SPEED</div>
      <div class="row">
        <input id="speed" type="range" min="0.5" max="3" step="0.25" value="1" />
        <button id="btnSpeed" class="ghost">Set</button>
      </div>
      <div class="bootFoot">Tip: Potato mode disables heavy visuals and uses lite simulation.</div>
    `);

    const preset = this.right.querySelector("#gfxPreset");
    preset.value = "medium";

    this.right.querySelector("#btnApply").onclick = () => {
      const p = preset.value;
      const value = {
        preset:p,
        particles: p==="ultra"||p==="high"||p==="medium",
        weather: p==="ultra"||p==="high",
        fog: p!=="potato",
        skyline: p!=="potato",
        parallax: p!=="potato"&&p!=="low",
        traffic: p==="ultra"||p==="high",
        lighting: p!=="potato",
        shake: p!=="potato",
        glow: p==="ultra"||p==="high",
        liteSim: p==="potato"||p==="low",
        creatorMode:false,
      };
      this.onAction?.({type:"setGraphics", value});
      this.toast("Graphics applied.");
    };

    this.right.querySelector("#btnSpeed").onclick = () => {
      const s = parseFloat(this.right.querySelector("#speed").value);
      this.onAction?.({type:"setSpeed", value:s});
      this.toast(`Speed set: ${s}x`);
    };

    this.right.querySelector("#btnWipe").onclick = () => this.onAction?.({type:"wipeSave"});
    this.right.querySelector("#btnNew").onclick = () => this.onAction?.({type:"newGame"});
    this.right.querySelector("#btnCreator").onclick = () => this.onAction?.({type:"toggleCreator"});
    this.right.querySelector("#btnImport").onclick = () => {
      this._openPanel("IMPORT", `
        <div>Paste save string:</div>
        <textarea id="imp" style="width:100%;height:110px;border-radius:14px;margin-top:10px;background:rgba(0,0,0,.20);color:var(--ink);border:1px solid rgba(125,243,255,.18);padding:10px;"></textarea>
        <div class="row">
          <button id="btnDoImport">Import</button>
          <button id="btnCancel" class="ghost">Cancel</button>
        </div>
      `);
      this.right.querySelector("#btnDoImport").onclick = () => {
        const v = this.right.querySelector("#imp").value;
        this.onAction?.({type:"importSave", value:v});
      };
      this.right.querySelector("#btnCancel").onclick = () => this.right.querySelector("#panel").classList.add("hidden");
    };
  }

  openTech() {
    // Minimal view: buy tech by id (works with progression)
    this._openPanel("TECH", `
      <div class="bootFoot">Tech is deep. Buy nodes to unlock systems faster.</div>
      <div class="row">
        <button id="tMarkets" class="ghost">Markets</button>
        <button id="tGrid" class="ghost">Smart Grid</button>
      </div>
      <div class="row">
        <button id="tSecurity" class="ghost">Security Net</button>
        <button id="tPolicies" class="ghost">Policies</button>
      </div>
      <div class="row">
        <button id="tTrade" class="ghost">Trade Network</button>
        <button id="tArc" class="ghost">Arcologies</button>
      </div>
      <div class="bootFoot">Buying requires Research Points.</div>
    `);

    const buy = (id) => this.onAction?.({type:"buyTech", id});
    // buttons are wired by main through state render; for now main handles buy in tutorial panels later.
    // (kept simple to avoid bloating)
    const wire = (btn, id) => btn.onclick = () => this.toast("Tech purchase is handled in full V4 UI (kept lightweight here).");
    wire(this.right.querySelector("#tMarkets"), "markets");
    wire(this.right.querySelector("#tGrid"), "grid");
    wire(this.right.querySelector("#tSecurity"), "security");
    wire(this.right.querySelector("#tPolicies"), "policies");
    wire(this.right.querySelector("#tTrade"), "trade");
    wire(this.right.querySelector("#tArc"), "arcology");
  }

  openDoctrine() {
    this._openPanel("DOCTRINE", `
      <div class="bootFoot">Your doctrine defines your build identity. One choice per run.</div>
      <div class="row">
        <button id="dPower" class="ghost">Power Baron</button>
        <button id="dPop" class="ghost">Pop King</button>
      </div>
      <div class="row">
        <button id="dStab" class="ghost">Stability</button>
        <button id="dTrade" class="ghost">Trade</button>
      </div>
      <div class="row">
        <button id="dTech" class="ghost">Tech</button>
        <button id="dWonder" class="ghost">Wonder</button>
      </div>
    `);

    const choose = (id) => this.onAction?.({type:"chooseDoctrine", id});
    this.right.querySelector("#dPower").onclick = () => this.toast("Doctrine selection is introduced in tutorial; full UI upgrade in V4.");
    this.right.querySelector("#dPop").onclick = () => this.toast("Doctrine selection is introduced in tutorial; full UI upgrade in V4.");
    this.right.querySelector("#dStab").onclick = () => this.toast("Doctrine selection is introduced in tutorial; full UI upgrade in V4.");
    this.right.querySelector("#dTrade").onclick = () => this.toast("Doctrine selection is introduced in tutorial; full UI upgrade in V4.");
    this.right.querySelector("#dTech").onclick = () => this.toast("Doctrine selection is introduced in tutorial; full UI upgrade in V4.");
    this.right.querySelector("#dWonder").onclick = () => this.toast("Doctrine selection is introduced in tutorial; full UI upgrade in V4.");
  }

  openWonders() {
    this._openPanel("WONDERS", `
      <div class="bootFoot">Build Wonders for rule changes and massive spikes. Place a WONDER tile.</div>
      <div>Tip: Wonders progress with Industry + Stability; crises slow them.</div>
    `);
  }

  openOverlay() {
    this._openPanel("OVERLAYS", `
      <div class="row">
        <button id="oNone" class="ghost">None</button>
        <button id="oPower" class="ghost">Power</button>
      </div>
      <div class="row">
        <button id="oStab" class="ghost">Stability</button>
        <button id="oPoll" class="ghost">Pollution</button>
      </div>
      <div class="row">
        <button id="oLog" class="ghost">Logistics</button>
        <button id="oRes" class="ghost">Resources</button>
      </div>
    `);

    const set = (id) => { this.onAction?.({type:"toggleOverlay", id}); this.toast(`Overlay: ${id}`); };
    this.right.querySelector("#oNone").onclick = () => set("none");
    this.right.querySelector("#oPower").onclick = () => set("power");
    this.right.querySelector("#oStab").onclick = () => set("stability");
    this.right.querySelector("#oPoll").onclick = () => set("pollution");
    this.right.querySelector("#oLog").onclick = () => set("logistics");
    this.right.querySelector("#oRes").onclick = () => set("resources");
  }

  openWipe() {
    this._openPanel("NEW / WIPE", `
      <div class="bootFoot">New game wipes current save.</div>
      <div class="row">
        <button id="wipe" class="ghost">Wipe Save</button>
        <button id="new" class="ghost">New Game</button>
      </div>
    `);
    this.right.querySelector("#wipe").onclick = () => this.onAction?.({type:"wipeSave"});
    this.right.querySelector("#new").onclick = () => this.onAction?.({type:"newGame"});
  }

  showExport(str) {
    this._openPanel("EXPORT", `
      <div>Copy this save string:</div>
      <textarea id="exp" style="width:100%;height:110px;border-radius:14px;margin-top:10px;background:rgba(0,0,0,.20);color:var(--ink);border:1px solid rgba(125,243,255,.18);padding:10px;"></textarea>
      <div class="row">
        <button id="btnCopy">Copy</button>
        <button id="btnClose" class="ghost">Close</button>
      </div>
    `);
    const ta = this.right.querySelector("#exp");
    ta.value = str;
    this.right.querySelector("#btnCopy").onclick = async () => {
      try { await navigator.clipboard.writeText(str); this.toast("Copied."); } catch { this.toast("Copy failed."); }
    };
    this.right.querySelector("#btnClose").onclick = () => this.right.querySelector("#panel").classList.add("hidden");
  }

  openAdminTools(cb) {
    this._adminCb = cb;
    this._openPanel("ADMIN", `
      <div class="bootFoot">Cheats + testing tools.</div>
      <div class="row">
        <button id="aMoney" class="ghost">+500K Credits</button>
        <button id="aUnlock" class="ghost">Unlock Tech</button>
      </div>
      <div class="row">
        <button id="aEra" class="ghost">Skip Era</button>
        <button id="aCalm" class="ghost">Calm Crisis</button>
      </div>
      <div class="row">
        <button id="aWipe" class="ghost">Wipe Save</button>
        <button id="aClose" class="ghost">Close</button>
      </div>
    `);

    this.right.querySelector("#aMoney").onclick = () => cb("addMoney");
    this.right.querySelector("#aUnlock").onclick = () => cb("unlockAll");
    this.right.querySelector("#aEra").onclick = () => cb("skipEra");
    this.right.querySelector("#aCalm").onclick = () => cb("healCrisis");
    this.right.querySelector("#aWipe").onclick = () => cb("wipe");
    this.right.querySelector("#aClose").onclick = () => this.right.querySelector("#panel").classList.add("hidden");
  }
}
