const STATS_LIST = ["str", "dex", "con", "int", "wis", "cha", "luk"];
const BUFFS = [
  "shielded",
  "fortified",
  "divine_protection",
  "bloodlust",
  "empowered",
  "magic_barrier",
  "enraged",
];
const CCS = ["frozen", "paralysed", "stunned"];

function onDOMReady(fn) {
  if (document.readyState !== "loading") {
    fn();
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}

const Utils = {
  formatName(str) {
    if (!str || typeof str !== "string") return "";
    return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  },
  formatId(obj) {
    if (typeof obj === "string") return this.formatName(obj);
    if (obj && obj.type === "cell" && Array.isArray(obj.args)) {
      return `Wilderness [${obj.args.join(", ")}]`;
    }
    return JSON.stringify(obj);
  },
  escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },
  getAffBadge(tag) {
    let type = "aff-debuff";
    if (CCS.includes(tag)) type = "aff-cc";
    else if (BUFFS.includes(tag)) type = "aff-buff";
    return `<span class="aff-badge ${type}">${tag.replace(/_/g, " ")}</span>`;
  },
  renderAffs(affsDict) {
    if (!affsDict || Object.keys(affsDict).length === 0) return "";
    return Object.keys(affsDict)
      .map((tag) => this.getAffBadge(tag))
      .join(" ");
  },
};

class UIManager {
  constructor() {
    onDOMReady(() => {
      this.logContainer = document.getElementById("log-container");
      this.loginForm = document.getElementById("login-form");
      this.regForm = document.getElementById("reg-form");
      this.authOverlay = document.getElementById("auth-overlay");
      this.cmdInput = document.getElementById("cmd-input");
    });
  }

  switchAuthTab(mode) {
    const isLogin = mode === "login";
    document.getElementById("login-form").style.display = isLogin
      ? "block"
      : "none";
    document.getElementById("reg-form").style.display = isLogin
      ? "none"
      : "block";
    document.getElementById("tab-login").classList.toggle("active", isLogin);
    document.getElementById("tab-reg").classList.toggle("active", !isLogin);

    document.getElementById("login-err").style.display = "none";
    document.getElementById("reg-err-1").style.display = "none";
    document.getElementById("reg-err-2").style.display = "none";

    if (!isLogin) {
      document.getElementById("reg-step-1").style.display = "block";
      document.getElementById("reg-step-2").style.display = "none";
    }
  }

  updateKeyBadge(status) {
    const badge = document.getElementById("key-badge");
    const box = document.getElementById("admin-key-container");
    if (!badge || !box) return;

    if (status === "valid") {
      badge.innerText = "✓ Key Verified (Admin Budget Unlocked)";
      badge.style.color = "var(--success)";
      box.style.borderColor = "var(--magic)";
    } else if (status === "invalid") {
      badge.innerText = "✗ Invalid Key";
      badge.style.color = "var(--danger)";
      box.style.borderColor = "var(--danger)";
    } else {
      badge.innerText = "";
      box.style.borderColor = "var(--border-light)";
    }
  }

  updateVitals(hp, maxHp, mp, maxMp, xp = 0, reqXp = 100, affs = {}) {
    const hpPercent =
      maxHp > 0 ? Math.min(100, Math.max(0, (hp / maxHp) * 100)) : 0;
    const mpPercent =
      maxMp > 0 ? Math.min(100, Math.max(0, (mp / maxMp) * 100)) : 0;
    const xpPercent =
      reqXp > 0 ? Math.min(100, Math.max(0, (xp / reqXp) * 100)) : 0;

    document.getElementById("bar-hp").style.width = `${hpPercent}%`;
    document.getElementById("val-hp").innerText = `${hp} / ${maxHp}`;
    document.getElementById("bar-mp").style.width = `${mpPercent}%`;
    document.getElementById("val-mp").innerText = `${mp} / ${maxMp}`;
    document.getElementById("bar-xp").style.width = `${xpPercent}%`;
    document.getElementById("val-xp").innerText = `${xp} / ${reqXp}`;

    const affContainer = document.getElementById("self-affs");
    if (affContainer) affContainer.innerHTML = Utils.renderAffs(affs);
  }

  updateStats(lvl, xp, reqXp, statPts, stats, bounty) {
    const panel = document.getElementById("stats-panel");
    if (!panel) return;

    let html = `<div class="stat-box"><span>LEVEL</span><span>${lvl}</span></div><div class="stat-box"><span>PTS</span><span style="color:var(--gold);">${statPts}</span></div>`;
    for (const [stat, val] of Object.entries(stats || {})) {
      html += `<div class="stat-box"><span>${stat.toUpperCase()}</span><span>${val}</span></div>`;
    }
    panel.innerHTML = html;

    const bountyTag = document.getElementById("val-bounty");
    if (bountyTag) {
      if (bounty && bounty > 0) {
        bountyTag.innerText = `💀 ${bounty}g Bounty`;
        bountyTag.style.display = "inline-block";
      } else {
        bountyTag.style.display = "none";
      }
    }
  }

  updateInventory(inv, eq) {
    const panel = document.getElementById("inv-panel");
    if (!panel) return;
    let html = "";
    if (eq && Object.keys(eq).length > 0) {
      for (const [slot, tag] of Object.entries(eq)) {
        if (tag && tag !== "none") {
          html += `<div class="list-item equipped"><div class="list-item-header"><span class="item-name">${Utils.formatName(tag)}</span><span class="item-meta">${slot.toUpperCase()}</span></div></div>`;
        }
      }
    }
    if (inv && inv.length > 0) {
      inv.forEach((item) => {
        const tagClass = item.tag === "gold" ? "valuable" : "consumable";
        html += `<div class="list-item ${tagClass}"><div class="list-item-header"><span class="item-name">${Utils.formatName(item.tag)}</span><span class="item-meta">x${item.qty}</span></div></div>`;
      });
    }
    if (!html)
      html = `<div style="color:var(--text-muted); font-style:italic;">Inventory is empty.</div>`;
    panel.innerHTML = html;
  }

  updateRoom(id, desc, envDesc, exits) {
    document.getElementById("room-name").innerText = Utils.formatId(id);
    let fullDesc = Utils.escapeHtml(desc || "");
    if (envDesc)
      fullDesc += `<span class="env-desc">${Utils.escapeHtml(envDesc)}</span>`;
    document.getElementById("room-desc").innerHTML = fullDesc;

    const exitsContainer = document.getElementById("room-exits");
    if (exitsContainer) {
      if (exits && exits.length > 0) {
        exitsContainer.innerHTML = exits
          .map((e) => `<span class="exit-chip">${Utils.formatId(e)}</span>`)
          .join("");
      } else {
        exitsContainer.innerHTML = `<span style="color:var(--text-muted);">None</span>`;
      }
    }
  }

  updateEntities(players, mobs) {
    const panel = document.getElementById("entities-panel");
    if (!panel) return;
    let html = "";
    if (players && players.length > 0) {
      players.forEach((p) => {
        const bty =
          p.bounty > 0
            ? ` <span style="color:var(--danger); font-weight:bold;">[💀 ${p.bounty}g]</span>`
            : "";
        const affsHtml = Utils.renderAffs(p.affs);
        html += `<div class="list-item player-entity"><div class="list-item-header"><span class="item-name">${Utils.escapeHtml(p.id)}${bty}</span><span class="item-meta">${p.hp}/${p.max_hp} HP</span></div><div class="entity-affs">${affsHtml}</div></div>`;
      });
    }
    if (mobs && mobs.length > 0) {
      mobs.forEach((m) => {
        const isHostile = m.name.toLowerCase().includes("guard")
          ? "mob-neutral"
          : "mob-hostile";
        const affsHtml = Utils.renderAffs(m.affs);
        html += `<div class="list-item ${isHostile}"><div class="list-item-header"><span class="item-name">${Utils.formatName(m.name || m.tag)}</span><span class="item-meta">${m.hp}/${m.max_hp} HP</span></div><div class="entity-affs">${affsHtml}</div></div>`;
      });
    }
    if (!html)
      html = `<div style="color:var(--text-muted); font-style:italic;">No other beings present.</div>`;
    panel.innerHTML = html;
  }

  updateRoomItems(items) {
    const panel = document.getElementById("items-panel");
    if (!panel) return;
    let html = "";
    if (items && items.length > 0) {
      items.forEach((i) => {
        html += `<div class="list-item valuable"><div class="list-item-header"><span class="item-name">${Utils.formatName(i.tag)}</span><span class="item-meta">x${i.qty}</span></div></div>`;
      });
    } else {
      html = `<div style="color:var(--text-muted); font-style:italic;">Nothing on the ground.</div>`;
    }
    panel.innerHTML = html;
  }

  log(htmlContent, className = "") {
    const logBox = document.getElementById("log-container");
    if (!logBox) return;
    const entry = document.createElement("div");
    entry.className = `log-entry ${className}`.trim();
    entry.innerHTML = htmlContent;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
  }

  hideOverlay() {
    document.getElementById("auth-overlay").style.display = "none";
    const cmd = document.getElementById("cmd-input");
    cmd.disabled = false;
    cmd.focus();
  }
  showOverlay() {
    document.getElementById("auth-overlay").style.display = "flex";
    document.getElementById("cmd-input").disabled = true;
  }
}

class AuthManager {
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
            ui.updateKeyBadge("none");
            this.renderStatAlloc(false);
            return;
          }
          this.debounceTimer = setTimeout(() => {
            if (game.ws && game.ws.readyState === WebSocket.OPEN) {
              game.send({ type: "validate_key", key: keyVal });
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
    if (key && game.ws && game.ws.readyState === WebSocket.OPEN) {
      game.send({ type: "validate_key", key: key });
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
                <span class="stat-val-text">${this.allocStats[s]}</span>
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

  modStat(stat, delta) {
    const key = document.getElementById("reg-key")
      ? document.getElementById("reg-key").value.trim()
      : "";
    const isAdmin = this.isEngineVerifiedAdmin || key.length > 0;
    const maxBudget = isAdmin ? 10000 : 15;

    let spent = 0;
    STATS_LIST.forEach((s) => (spent += this.allocStats[s] - 10));
    let actualDelta = delta;
    if (delta > 0) {
      const rem = maxBudget - spent;
      if (actualDelta > rem) actualDelta = rem;
    } else {
      const aboveBase = this.allocStats[stat] - 10;
      if (-actualDelta > aboveBase) actualDelta = -aboveBase;
    }

    if (actualDelta !== 0) {
      this.allocStats[stat] += actualDelta;
      this.renderStatAlloc(isAdmin);
    }
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

    // Mode = "login"
    game.authenticate({ type: "login", actor: name, pass: pass });
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
    const key = document.getElementById("reg-key").value.trim();

    // Mode = "register"
    game.authenticate({
      type: "register",
      actor: name,
      pass: pass,
      key: key,
      race: race,
      stats: this.allocStats,
    });
  }
}

class GameEngine {
  constructor() {
    this.ws = null;
    this.currentActor = "";
    this.authPayload = null;
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    this.ws.onopen = () => {
      ui.log("Connected to Frigus Realm.", "msg-system");
      if (this.authPayload) {
        this.send(this.authPayload);
      }
    };
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.events) data.events.forEach((ev) => this.processEvent(ev));
        else if (data.status === "error")
          ui.log(`[SYSTEM ERROR] ${data.error}`, "msg-error");
      } catch (err) {
        console.error("Parse Error:", err, e.data);
      }
    };
    this.ws.onclose = () => {
      ui.log("Connection lost. Refresh to reconnect.", "msg-error");
      ui.showOverlay();
    };
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify(payload));
  }

  sendCommand(e) {
    e.preventDefault();
    const input = document.getElementById("cmd-input");
    const txt = input.value.trim();
    if (!txt) return;
    ui.log(`&gt; ${Utils.escapeHtml(txt)}`, "msg-echo");
    this.send({ type: "cmd", text: txt });
    input.value = "";
  }

  authenticate(payload) {
    this.currentActor = payload.actor;
    this.authPayload = payload;
    const identElem = document.getElementById("header-identity");
    if (identElem)
      identElem.innerText = `${payload.actor} (${Utils.formatName(payload.race || "human")})`;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.send(payload);
    else this.connect();
    ui.hideOverlay();
  }

  processEvent(ev) {
    const type = ev.type || (typeof ev === "string" ? ev : Object.keys(ev)[0]);
    const args = ev.args || ev[type] || [];

    switch (type) {
      // --- Core UI & State ---
      case "key_status":
        auth.isEngineVerifiedAdmin = args[2] === "valid";
        ui.updateKeyBadge(args[2]);
        auth.renderStatAlloc(auth.isEngineVerifiedAdmin);
        break;
      case "look":
        ui.updateRoom(args[0], args[1], args[8], args[3]);
        ui.updateEntities(args[4], args[5]);
        ui.updateRoomItems(args[6]);
        if (args[7])
          ui.updateVitals(
            args[7].hp,
            args[7].max_hp,
            args[7].mp,
            args[7].max_mp,
            0,
            100,
            args[7].affs,
          );
        break;
      case "status_info":
        ui.updateVitals(
          args[6].hp,
          args[6].max_hp,
          args[6].mp,
          args[6].max_mp,
          args[2],
          args[3],
          args[6].affs,
        );
        ui.updateStats(args[1], args[2], args[3], args[4], args[5], args[7]);
        break;
      case "inventory_info":
        ui.updateInventory(args[1], args[2]);
        break;
      case "regenerated": {
        const [id, hp, mp] = args;
        if (id === this.currentActor) {
          const hpValElem = document.getElementById("val-hp");
          const mpValElem = document.getElementById("val-mp");
          const maxHp = hpValElem
            ? hpValElem.innerText.split("/")[1] || 50
            : 50;
          const maxMp = mpValElem
            ? mpValElem.innerText.split("/")[1] || 20
            : 20;
          ui.updateVitals(hp, parseInt(maxHp), mp, parseInt(maxMp));
        }
        break;
      }

      // --- Combat & Magic ---
      case "hit":
        ui.log(
          `<strong>${Utils.escapeHtml(args[0])}</strong> struck <strong>${Utils.escapeHtml(args[1])}</strong> for <strong>${args[2]}</strong> damage! (${args[3]}/${args[4]} HP)`,
          "msg-combat",
        );
        break;
      case "crit":
        ui.log(
          `💥 <strong>CRITICAL STRIKE!</strong> <strong>${Utils.escapeHtml(args[0])}</strong> devastated <strong>${Utils.escapeHtml(args[1])}</strong> for <strong>${args[2]}</strong> damage! (${args[3]}/${args[4]} HP)`,
          "msg-combat-crit",
        );
        break;
      case "dodged":
        ui.log(
          `⚡ <strong>${Utils.escapeHtml(args[0])}</strong> nimbly DODGED <strong>${Utils.escapeHtml(args[1])}</strong>'s attack!`,
          "msg-dodge",
        );
        break;
      case "flurry":
        ui.log(
          `⚔️ <strong>FLURRY!</strong> <strong>${Utils.escapeHtml(args[0])}</strong> unleashes a rapid follow-up strike!`,
          "msg-combat",
        );
        break;
      case "cast":
        ui.log(
          `✨ <strong>${Utils.escapeHtml(args[0])}</strong> cast <strong>${Utils.formatName(args[1])}</strong> at <strong>${Utils.escapeHtml(args[2])}</strong>!`,
          "msg-magic",
        );
        break;
      case "cast_crit":
        ui.log(
          `🌟 <strong>SPELL CRITICAL!</strong> <strong>${Utils.escapeHtml(args[0])}</strong> empowered <strong>${Utils.formatName(args[1])}</strong> against <strong>${Utils.escapeHtml(args[2])}</strong>!`,
          "msg-magic",
        );
        break;
      case "healed":
        ui.log(
          `💚 <strong>${Utils.escapeHtml(args[0])}</strong> restored <strong>${args[1]}</strong> HP! (${args[2]}/${args[3]})`,
          "msg-heal",
        );
        break;

      // --- Afflictions ---
      case "aff_applied":
        ui.log(
          `❇️ <strong>${Utils.formatName(args[1])}</strong> afflicted <strong>${Utils.escapeHtml(args[0])}</strong>!`,
          "msg-system",
        );
        this.send({ type: "cmd", text: "look" });
        break;
      case "aff_tick":
        ui.log(
          `🔥 <strong>${Utils.escapeHtml(args[0])}</strong> suffers <strong>${args[2]}</strong> damage from <strong>${Utils.formatName(args[1])}</strong>!`,
          "msg-dot",
        );
        break;
      case "aff_faded":
        ui.log(
          `💨 <strong>${Utils.formatName(args[1])}</strong> faded from <strong>${Utils.escapeHtml(args[0])}</strong>.`,
          "msg-system",
        );
        this.send({ type: "cmd", text: "look" });
        break;

      // --- Movement & Entities ---
      case "moved":
        if (args[0] === this.currentActor) {
          ui.log(
            `You moved <strong>${args[1]}</strong> to <strong>${Utils.formatId(args[2])}</strong>.`,
            "msg-move",
          );
          this.send({ type: "cmd", text: "look" });
        } else {
          ui.log(
            `<strong>${Utils.escapeHtml(args[0])}</strong> moved <strong>${args[1]}</strong>.`,
            "msg-move",
          );
          this.send({ type: "cmd", text: "look" });
        }
        break;
      case "dead": {
        const deadName = Utils.formatName(args[1] || args[0]);
        ui.log(`☠️ <strong>${deadName} HAS BEEN SLAIN!</strong>`, "msg-crime");

        if (args[0] === this.currentActor) {
          document.getElementById("death-overlay").style.display = "flex";
          setTimeout(() => {
            this.send({ type: "respawn" });
          }, 3500);
        } else {
          this.send({ type: "cmd", text: "look" });
        }
        break;
      }

      case "respawned":
        if (args[0] === this.currentActor) {
          document.getElementById("death-overlay").style.display = "none";
          ui.log(
            `✨ <strong>You have been reborn in the Sanctuary.</strong>`,
            "msg-magic",
          );
          this.send({ type: "cmd", text: "look" });
          this.send({ type: "cmd", text: "status" });
        }
        break;

      // --- Items, Progression & Crime (RESTORED) ---
      case "looted":
        ui.log(
          `Picked up <strong>x${args[2]} ${Utils.formatName(args[1])}</strong>.`,
          "msg-loot",
        );
        this.send({ type: "cmd", text: "inventory" });
        this.send({ type: "cmd", text: "look" });
        break;
      case "equipped":
      case "unequipped":
        ui.log(
          `Equipment updated: <strong>${Utils.formatName(args[1])}</strong>.`,
          "msg-system",
        );
        this.send({ type: "cmd", text: "inventory" });
        break;
      case "used":
        ui.log(
          `Used <strong>${Utils.formatName(args[1])}</strong>.`,
          "msg-system",
        );
        this.send({ type: "cmd", text: "inventory" });
        this.send({ type: "cmd", text: "status" });
        break;
      case "allocated":
        ui.log(
          `Trained <strong>${args[1].toUpperCase()}</strong> to <strong>${args[2]}</strong>.`,
          "msg-system",
        );
        this.send({ type: "cmd", text: "status" });
        break;
      case "xp_gained":
        ui.log(`Gained <strong>+${args[1]} XP</strong>.`, "msg-system");
        this.send({ type: "cmd", text: "status" });
        break;
      case "lvl_up":
        ui.log(
          `🌟 <strong>LEVEL UP! You reached Level ${args[1]}!</strong>`,
          "msg-heal",
        );
        this.send({ type: "cmd", text: "status" });
        break;
      case "env_msg":
        ui.log(`🌍 ${Utils.escapeHtml(args[0])}`, "msg-env");
        break;
      case "time_report":
        ui.log(`🕒 ${Utils.escapeHtml(args[1])}`, "msg-env");
        break;
      case "bounty_gained":
        ui.log(
          `🚨 <strong>CRIME COMMITTED!</strong> Bounty increased by <strong>${args[1]} Gold</strong>!`,
          "msg-crime",
        );
        this.send({ type: "cmd", text: "status" });
        break;
      case "bounty_paid":
        ui.log(
          `⚖️ Paid <strong>${args[1]} Gold</strong> to clear your criminal bounty. Hostilities ceased.`,
          "msg-system",
        );
        this.send({ type: "cmd", text: "status" });
        this.send({ type: "cmd", text: "inventory" });
        this.send({ type: "cmd", text: "look" });
        break;
      case "bounty_claimed":
        ui.log(
          `💰 <strong>${Utils.escapeHtml(args[0])}</strong> claimed a <strong>${args[2]} Gold</strong> bounty on <strong>${Utils.escapeHtml(args[1])}</strong>!`,
          "msg-loot",
        );
        this.send({ type: "cmd", text: "status" });
        break;
      case "bounty_report":
        let btyHtml = `<div style="border:1px solid var(--gold); padding:12px; margin:8px 0; background:var(--bg-surface); border-radius:6px;">
                      <strong style="color:var(--gold);">--- MOST WANTED BOUNTIES ---</strong><br>`;
        if (args[1] && args[1].length) {
          args[1].forEach((entry, idx) => {
            btyHtml += `<div style="margin-top:6px;">${idx + 1}. <strong>${Utils.escapeHtml(entry.name || entry.id)}</strong> - <span style="color:var(--danger); font-weight:bold;">${entry.bounty} Gold</span></div>`;
          });
        } else {
          btyHtml += `<div style="margin-top:6px; color:var(--text-muted); font-style:italic;">No active bounties in the realm.</div>`;
        }
        btyHtml += `</div>`;
        ui.log(btyHtml, "msg-system");
        break;

      // --- Errors ---
      case "error":
        const errObj = args[0];
        if (errObj && errObj.type === "invalid_password") {
          alert("Invalid Password!");
          ui.showOverlay();
        } else if (errObj && errObj.type === "account_does_not_exist") {
          alert(
            `Account "${errObj.args[0]}" does not exist! Please register first.`,
          );
          ui.showOverlay();
          ui.switchAuthTab("reg");
        } else if (errObj && errObj.type === "account_already_exists") {
          alert(
            `Character name "${errObj.args[0]}" is already taken! Please choose another name.`,
          );
          ui.showOverlay();
          ui.switchAuthTab("reg");
        } else if (errObj && errObj.type === "restricted_race_denied") {
          ui.showOverlay();
          document.getElementById("reg-step-1").style.display = "block";
          document.getElementById("reg-step-2").style.display = "none";
          document.getElementById("reg-err-1").innerText =
            "Admin Key rejected for Angel/Demon lineage!";
          document.getElementById("reg-err-1").style.display = "block";
        } else if (errObj && errObj.type === "stat_allocation_invalid") {
          ui.showOverlay();
          document.getElementById("reg-err-2").innerText =
            "Invalid allocation!";
          document.getElementById("reg-err-2").style.display = "block";
        } else if (errObj && errObj.type === "cc_prevented") {
          ui.log(
            `❌ You are <strong>${Utils.formatName(errObj.args[1])}</strong> and cannot act!`,
            "msg-error",
          );
        } else if (errObj && errObj.type === "spell_affinity_denied") {
          ui.log(
            `❌ Your lineage lacks the affinity to cast <strong>${Utils.formatName(errObj.args[1])}</strong>.`,
            "msg-error",
          );
        } else {
          ui.log(
            `[ERROR] ${Utils.escapeHtml(JSON.stringify(args))}`,
            "msg-error",
          );
        }
        break;
    }
  }
}

const ui = new UIManager();
const auth = new AuthManager();
const game = new GameEngine();
onDOMReady(() => {
  game.connect();
});
