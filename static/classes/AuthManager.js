import { onDOMReady } from "../utilities/utils.js";
import { STATS_LIST } from "../utilities/constants.js";

export class AuthManager {
  constructor() {
    this.allocStats = {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
      luk: 10,
    };
    this.isEngineVerifiedAdmin = false;
    this.debounceTimer = null;
    this.setupListeners();
  }

  setupListeners() {
    onDOMReady(() => {
      const keyInput = document.getElementById("reg-key");
      if (keyInput) {
        keyInput.addEventListener("input", (e) => {
          clearTimeout(this.debounceTimer);
          const keyVal = e.target.value.trim();
          if (!keyVal) {
            this.isEngineVerifiedAdmin = false;
            window.ui.updateKeyBadge("none");
            this.renderStatAlloc(false);
            return;
          }
          this.debounceTimer = setTimeout(() => {
            if (
              window.game.ws &&
              window.game.ws.readyState === WebSocket.OPEN
            ) {
              window.game.send({ type: "validate_key", key: keyVal });
            }
          }, 50);
        });
      }
      const regStep1 = document.getElementById("reg-step-1");
      if (regStep1) {
        regStep1.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.nextRegStep();
          }
        });
      }
    });
  }

  nextRegStep() {
    const name = document.getElementById("reg-name").value.trim();
    const pass = document.getElementById("reg-pass").value.trim();
    const race = document.getElementById("reg-race").value;
    const key = document.getElementById("reg-key").value.trim();
    const err1 = document.getElementById("reg-err-1");

    if (!name || !pass) {
      err1.innerText = "Character Name and Password are required.";
      err1.style.display = "block";
      return;
    }
    if ((race === "angel" || race === "demon") && !key) {
      err1.innerText = `A Master Admin Key is required to awaken as an ${race.toUpperCase()}!`;
      err1.style.display = "block";
      return;
    }

    err1.style.display = "none";
    if (key && window.game.ws && window.game.ws.readyState === WebSocket.OPEN) {
      window.game.send({ type: "validate_key", key: key });
      this.isEngineVerifiedAdmin = true;
    }
    this.renderStatAlloc(this.isEngineVerifiedAdmin || key.length > 0);
    document.getElementById("reg-step-1").style.display = "none";
    document.getElementById("reg-step-2").style.display = "block";
  }

  prevRegStep() {
    document.getElementById("reg-step-1").style.display = "block";
    document.getElementById("reg-step-2").style.display = "none";
  }

  renderStatAlloc(isAdmin) {
    const container = document.getElementById("stat-alloc-container");
    if (!container) return;
    const maxBudget = isAdmin ? 10000 : 15;
    let spent = 0;
    STATS_LIST.forEach((s) => (spent += this.allocStats[s] - 10));
    const rem = maxBudget - spent;

    const ptsElem = document.getElementById("pts-rem");
    if (ptsElem) {
      ptsElem.innerText = rem;
      ptsElem.style.color = isAdmin ? "var(--magic)" : "var(--accent)";
    }

    container.innerHTML = STATS_LIST.map(
      (s) => `
        <div class="stat-row">
            <span class="stat-name">${s.toUpperCase()}</span>
            <input type="number" id="stat-input-${s}" class="input-field stat-num-input" value="${this.allocStats[s]}" min="10" oninput="auth.setStat('${s}', this.value)" />
            <div class="stat-controls">
                <button type="button" class="stat-btn btn-minus" onclick="auth.modStat('${s}', -100)">-100</button>
                <button type="button" class="stat-btn btn-minus" onclick="auth.modStat('${s}', -10)">-10</button>
                <button type="button" class="stat-btn btn-minus" onclick="auth.modStat('${s}', -1)">-1</button>
                <button type="button" class="stat-btn btn-plus" onclick="auth.modStat('${s}', 1)">+1</button>
                <button type="button" class="stat-btn btn-plus" onclick="auth.modStat('${s}', 10)">+10</button>
                <button type="button" class="stat-btn btn-plus" onclick="auth.modStat('${s}', 100)">+100</button>
            </div>
        </div>
      `,
    ).join("");
  }

  setStat(stat, rawVal) {
    const key = document.getElementById("reg-key")
      ? document.getElementById("reg-key").value.trim()
      : "";
    const isAdmin = this.isEngineVerifiedAdmin || key.length > 0;
    const maxBudget = isAdmin ? 10000 : 15;

    let val = parseInt(rawVal, 10);
    if (isNaN(val) || val < 10) val = 10;

    let spentOthers = 0;
    STATS_LIST.forEach((s) => {
      if (s !== stat) spentOthers += this.allocStats[s] - 10;
    });

    const maxAllowed = 10 + Math.max(0, maxBudget - spentOthers);
    if (val > maxAllowed) val = maxAllowed;

    this.allocStats[stat] = val;

    const totalSpent = spentOthers + (val - 10);
    const rem = maxBudget - totalSpent;
    const ptsElem = document.getElementById("pts-rem");
    if (ptsElem) ptsElem.innerText = rem;

    const inputElem = document.getElementById(`stat-input-${stat}`);
    if (inputElem && parseInt(inputElem.value, 10) !== val && rawVal !== "") {
      inputElem.value = val;
    }
  }

  modStat(stat, delta) {
    const curVal = this.allocStats[stat];
    this.setStat(stat, curVal + delta);
    const inputElem = document.getElementById(`stat-input-${stat}`);
    if (inputElem) inputElem.value = this.allocStats[stat];
  }

  handleLogin(e) {
    e.preventDefault();
    const name = document.getElementById("login-name").value.trim();
    const pass = document.getElementById("login-pass").value.trim();
    const err = document.getElementById("login-err");
    if (!name || !pass) {
      err.innerText = "Name and Password are required.";
      err.style.display = "block";
      return;
    }
    err.style.display = "none";
    window.game.authenticate({ type: "login", actor: name, pass: pass });
  }

  handleRegister(e) {
    e.preventDefault();
    const step2 = document.getElementById("reg-step-2");
    if (step2 && step2.style.display === "none") {
      this.nextRegStep();
      return;
    }

    const name = document.getElementById("reg-name").value.trim();
    const pass = document.getElementById("reg-pass").value.trim();
    const race = document.getElementById("reg-race").value;
    const charClass = document.getElementById("reg-class").value;
    const key = document.getElementById("reg-key").value.trim();

    window.game.authenticate({
      type: "register",
      actor: name,
      pass: pass,
      key: key,
      race: race,
      class: charClass,
      stats: this.allocStats,
    });
  }
}
