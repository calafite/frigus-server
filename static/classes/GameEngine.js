import { Utils } from '../utilities/utils.js';

export class GameEngine {
  constructor() {
    this.ws = null;
    this.currentActor = "";
    this.authPayload = null;
    this.respawnTimer = null;
    this.currentMinutes = 480;
    this.currentSeason = "Spring";
    this.clockInterval = null;
    this.startClockTimer();
  }

  startClockTimer() {
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.clockInterval = setInterval(() => {
      this.currentMinutes = (this.currentMinutes + 1) % 1440;
      window.ui.updateClockFromMinutes(this.currentMinutes, this.currentSeason);
    }, 1000);
  }

  syncClock(timeStr, seasonStr) {
    if (timeStr) {
      const parts = timeStr.split(":");
      if (parts.length === 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m)) {
          this.currentMinutes = h * 60 + m;
        }
      }
    }
    if (seasonStr) this.currentSeason = seasonStr;
    window.ui.updateClockFromMinutes(this.currentMinutes, this.currentSeason);
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    this.ws.onopen = () => {
      window.ui.log("Connected to Frigus Realm.", "msg-system");
      if (this.authPayload) {
        this.send(this.authPayload);
      }
    };
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.events) data.events.forEach((ev) => this.processEvent(ev));
        else if (data.status === "error" || data.status === "exception")
          window.ui.log(`[SYSTEM EXCEPTION] ${data.error}`, "msg-error");
      } catch (err) {
        console.error("Parse Error:", err, e.data);
      }
    };
    this.ws.onclose = () => {
      window.ui.log("Connection lost. Refresh to reconnect.", "msg-error");
      window.ui.showOverlay();
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
    window.ui.log(`&gt; ${Utils.escapeHtml(txt)}`, "msg-echo");
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
    window.ui.hideOverlay();
  }

  processEvent(ev) {
    const type = ev.type || (typeof ev === "string" ? ev : Object.keys(ev)[0]);
    const args = ev.args || ev[type] || [];

    switch (type) {
      case "key_status":
        window.auth.isEngineVerifiedAdmin = args[2] === "valid";
        window.ui.updateKeyBadge(args[2]);
        window.auth.renderStatAlloc(window.auth.isEngineVerifiedAdmin);
        break;
      case "look":
        window.ui.updateRoom(args[0], args[1], args[8], args[3], args[2]);
        window.ui.updateEntities(args[4], args[5]);
        window.ui.updateRoomItems(args[6]);
        if (args[7]) window.ui.updateVitals(args[7].hp, args[7].max_hp, args[7].mp, args[7].max_mp, 0, 100, args[7].affs);
        break;
      case "status_info":
        window.ui.updateVitals(args[6].hp, args[6].max_hp, args[6].mp, args[6].max_mp, args[2], args[3], args[6].affs);
        window.ui.updateStats(args[1], args[2], args[3], args[4], args[5], args[7]);
        break;
      case "inventory_info":
        window.ui.updateInventory(args[1], args[2]);
        break;
      case "hit":
        window.ui.log(`<strong>${Utils.escapeHtml(args[0])}</strong> struck <strong>${Utils.escapeHtml(args[1])}</strong> for <strong>${args[2]}</strong> damage! (${args[3]}/${args[4]} HP)`, "msg-combat");
        break;
      case "crit":
        window.ui.log(`💥 <strong>CRITICAL STRIKE!</strong> <strong>${Utils.escapeHtml(args[0])}</strong> devastated <strong>${Utils.escapeHtml(args[1])}</strong> for <strong>${args[2]}</strong> damage! (${args[3]}/${args[4]} HP)`, "msg-combat-crit");
        break;
      case "spell_crit":
        window.ui.log(`🌟 <strong>SPELL CRITICAL!</strong> <strong>${Utils.escapeHtml(args[0])}</strong> blasted <strong>${Utils.escapeHtml(args[2])}</strong> with <strong>${Utils.formatName(args[1])}</strong> for <strong>${args[3]}</strong> damage! (${args[4]}/${args[5]} HP)`, "msg-combat-crit");
        break;
      case "spell_missed":
        window.ui.log(`🌫️ The dense mist causes <strong>${Utils.escapeHtml(args[0])}</strong>'s <strong>${Utils.formatName(args[1])}</strong> to fizzle and miss!`, "msg-dodge");
        break;
      case "dodged":
        window.ui.log(`⚡ <strong>${Utils.escapeHtml(args[0])}</strong> nimbly DODGED <strong>${Utils.escapeHtml(args[1])}</strong>'s attack!`, "msg-dodge");
        break;
      case "cast":
        window.ui.log(`✨ <strong>${Utils.escapeHtml(args[0])}</strong> cast <strong>${Utils.formatName(args[1])}</strong> at <strong>${Utils.escapeHtml(args[2])}</strong>!`, "msg-magic");
        break;
      case "cast_area":
        window.ui.log(`🌩️ <strong>${Utils.escapeHtml(args[0])}</strong> conjured <strong>${Utils.formatName(args[1])}</strong>, engulfing the entire area!`, "msg-magic");
        break;
      case "cast_group":
        window.ui.log(`✨ <strong>${Utils.escapeHtml(args[0])}</strong> unleashed <strong>${Utils.formatName(args[1])}</strong> across the group!`, "msg-magic");
        break;
      case "cast_crit":
        window.ui.log(`🌟 <strong>SPELL CRITICAL!</strong> <strong>${Utils.escapeHtml(args[0])}</strong> empowered <strong>${Utils.formatName(args[1])}</strong>!`, "msg-magic");
        break;
      case "healed":
        window.ui.log(`💚 <strong>${Utils.escapeHtml(args[0])}</strong> restored <strong>${args[1]}</strong> HP! (${args[2]}/${args[3]})`, "msg-heal");
        break;
      case "aff_applied":
        window.ui.log(`❇️ <strong>${Utils.formatName(args[1])}</strong> afflicted <strong>${Utils.escapeHtml(args[0])}</strong>!`, "msg-system");
        this.send({ type: "cmd", text: "look" });
        break;
      case "aff_tick":
        window.ui.log(`🔥 <strong>${Utils.escapeHtml(args[0])}</strong> suffers <strong>${args[2]}</strong> damage from <strong>${Utils.formatName(args[1])}</strong>!`, "msg-dot");
        break;
      case "aff_faded":
        window.ui.log(`💨 <strong>${Utils.formatName(args[1])}</strong> faded from <strong>${Utils.escapeHtml(args[0])}</strong>.`, "msg-system");
        this.send({ type: "cmd", text: "look" });
        break;
      case "moved": {
        const moverId = args[0];
        const dir = args[1];
        const dest = args[2];
        const displayName = args[3] || moverId;
        if (moverId === this.currentActor) {
          window.ui.log(`You moved <strong>${dir}</strong> to <strong>${Utils.formatId(dest)}</strong>.`, "msg-move");
          this.send({ type: "cmd", text: "look" });
        } else {
          window.ui.log(`<strong>${Utils.escapeHtml(Utils.formatName(displayName))}</strong> moved <strong>${dir}</strong>.`, "msg-move");
          this.send({ type: "cmd", text: "look" });
        }
        break;
      }
      case "dead": {
        const deadName = Utils.formatName(args[1] || args[0]);
        window.ui.log(`☠️ <strong>${deadName} HAS BEEN SLAIN!</strong>`, "msg-crime");
        if (args[0] === this.currentActor || args[1] === this.currentActor) {
          document.getElementById("death-overlay").style.display = "flex";
          if (!this.respawnTimer) {
            this.respawnTimer = setTimeout(() => {
              this.respawnTimer = null;
              this.send({ type: "respawn" });
            }, 3500);
          }
        } else {
          this.send({ type: "cmd", text: "look" });
        }
        break;
      }
      case "respawned":
        document.getElementById("death-overlay").style.display = "none";
        window.ui.log(`✨ <strong>You have been reborn in the Sanctuary.</strong>`, "msg-magic");
        this.send({ type: "cmd", text: "look" });
        this.send({ type: "cmd", text: "status" });
        break;
      case "looted":
        window.ui.log(`Picked up <strong>x${args[2]} ${Utils.formatName(args[1])}</strong>.`, "msg-loot");
        this.send({ type: "cmd", text: "inventory" });
        this.send({ type: "cmd", text: "look" });
        break;
      case "equipped":
      case "unequipped":
        window.ui.log(`Equipment updated: <strong>${Utils.formatName(args[1])}</strong>.`, "msg-system");
        this.send({ type: "cmd", text: "inventory" });
        break;
      case "used":
        window.ui.log(`Used <strong>${Utils.formatName(args[1])}</strong>.`, "msg-system");
        this.send({ type: "cmd", text: "inventory" });
        this.send({ type: "cmd", text: "status" });
        break;
      case "anomaly_located":
        window.ui.log(args[0], "msg-magic");
        break;
      case "allocated":
        window.ui.log(`Trained <strong>${args[1].toUpperCase()}</strong> to <strong>${args[2]}</strong>.`, "msg-system");
        this.send({ type: "cmd", text: "status" });
        break;
      case "xp_gained":
        window.ui.log(`Gained <strong>+${args[1]} XP</strong>.`, "msg-system");
        this.send({ type: "cmd", text: "status" });
        break;
      case "lvl_up":
        window.ui.log(`🌟 <strong>LEVEL UP! You reached Level ${args[1]}!</strong>`, "msg-heal");
        this.send({ type: "cmd", text: "status" });
        break;
      case "env_msg":
        window.ui.log(`🌍 ${Utils.escapeHtml(args[0])}`, "msg-env");
        this.send({ type: "cmd", text: "look" });
        break;
      case "time_report":
        window.ui.log(`🕒 ${Utils.escapeHtml(args[1])}`, "msg-env");
        break;
      case "help_info":
        window.ui.log(args[1], "msg-system");
        break;
      case "bounty_gained":
        window.ui.log(`🚨 <strong>CRIME COMMITTED!</strong> Bounty increased by <strong>${args[1]} Gold</strong>!`, "msg-crime");
        this.send({ type: "cmd", text: "status" });
        break;
      case "bounty_paid":
        window.ui.log(`⚖️ Paid <strong>${args[1]} Gold</strong> to clear your criminal bounty. Hostilities ceased.`, "msg-system");
        this.send({ type: "cmd", text: "status" });
        this.send({ type: "cmd", text: "inventory" });
        this.send({ type: "cmd", text: "look" });
        break;
      case "bounty_claimed":
        window.ui.log(`💰 <strong>${Utils.escapeHtml(args[0])}</strong> claimed a <strong>${args[2]} Gold</strong> bounty on <strong>${Utils.escapeHtml(args[1])}</strong>!`, "msg-loot");
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
        window.ui.log(btyHtml, "msg-system");
        break;
      case "error":
        const errObj = args[0];
        if (errObj && errObj.type === "item_not_found") {
          window.ui.log(`❌ You do not have '${Utils.formatName(errObj.args[1])}' in your inventory!`, "msg-error");
        } else if (errObj && errObj.type === "cannot_use") {
          window.ui.log(`❌ You cannot use '${Utils.formatName(errObj.args[1])}'!`, "msg-error");
        } else if (errObj && errObj.type === "cannot_equip") {
          window.ui.log(`❌ You cannot equip '${Utils.formatName(errObj.args[1])}'!`, "msg-error");
        } else if (errObj && errObj.type === "invalid_password") {
          alert("Invalid Password!");
          window.ui.showOverlay();
        } else if (errObj && errObj.type === "safe_zone") {
          window.ui.log(`🕊️ Violence is forbidden in this sanctuary.`, "msg-system");
        } else if (errObj && errObj.type === "account_does_not_exist") {
          alert(`Account "${errObj.args[0]}" does not exist! Please register first.`);
          window.ui.showOverlay();
          window.ui.switchAuthTab("reg");
        } else if (errObj && errObj.type === "account_already_exists") {
          alert(`Character name "${errObj.args[0]}" is already taken! Please choose another name.`);
          window.ui.showOverlay();
          window.ui.switchAuthTab("reg");
        } else if (errObj && errObj.type === "restricted_race_denied") {
          window.ui.showOverlay();
          document.getElementById("reg-step-1").style.display = "block";
          document.getElementById("reg-step-2").style.display = "none";
          document.getElementById("reg-err-1").innerText = "Admin Key rejected for Angel/Demon lineage!";
          document.getElementById("reg-err-1").style.display = "block";
        } else if (errObj && errObj.type === "stat_allocation_invalid") {
          window.ui.showOverlay();
          document.getElementById("reg-err-2").innerText = "Invalid allocation!";
          document.getElementById("reg-err-2").style.display = "block";
        } else if (errObj && errObj.type === "cc_prevented") {
          window.ui.log(`❌ You are <strong>${Utils.formatName(errObj.args[1])}</strong> and cannot act!`, "msg-error");
        } else if (errObj && errObj.type === "spell_affinity_denied") {
          window.ui.log(`❌ Your lineage lacks the affinity to cast <strong>${Utils.formatName(errObj.args[1])}</strong>.`, "msg-error");
        } else if (errObj && errObj.type === "no_valid_targets") {
          window.ui.log(`❌ No valid targets found for <strong>${Utils.formatName(errObj.args[1])}</strong>!`, "msg-error");
        } else {
          window.ui.log(`[ERROR] ${Utils.escapeHtml(JSON.stringify(args))}`, "msg-error");
        }
        break;
    }
  }
}
