import { Utils } from "../utilities/utils.js";
import { ErrorHandler } from "../classes/ErrorHandler.js";

export class EventDispatcher {
  /**
   * @param {Object} engine = Instance of GameEngine
   * @param {Object} ui = Instance of UI Manager (defaults to window.ui)
   * @param {Object} auth = Instance of Auth Manager (defaults to window.auth)
   */
  constructor(engine, ui = window.ui, auth = window.auth) {
    this.engine = engine;
    this.ui = ui;
    this.auth = auth;

    this.handlers = this.createRegistry();
  }

  /**
   * Dispatches incoming event objects to their respective handlers.
   * @param {Object|string} ev = The event object or string key from the server payload
   */
  dispatch(ev) {
    const type = ev.type || (typeof ev === "string" ? ev : Object.keys(ev)[0]);
    const args = ev.args || ev[type] || [];

    const handler = this.handlers[type];
    if (handler) {
      handler(args);
    } else {
      console.warn(`[EventDispatcher] Unhandled event type: "${type}"`, ev);
    }
  }

  /**
   * Constructs the complete map of event handlers.
   */
  createRegistry() {
    return {
      // SYSTEM & AUTH
      key_status: (args) => {
        this.auth.isEngineVerifiedAdmin = args[2] === "valid";
        this.ui.updateKeyBadge(args[2]);
        this.auth.renderStatAlloc(this.auth.isEngineVerifiedAdmin);

        // Auto-request fresh character status and room view once auth is verified
        this.engine.sendCommand("status");
        this.engine.sendCommand("look");
      },

      error: (args) => {
        ErrorHandler.handle(args[0], args, this.ui);
      },

      help_info: (args) => {
        this.ui.log(args[1], "msg-system");
      },

      // WORLD & NAVIGATION
      look: (args) => {
        this.ui.updateRoom(args[0], args[1], args[8], args[3], args[2]);
        this.ui.updateEntities(args[4], args[5]);
        this.ui.updateRoomItems(args[6]);
        if (args[7]) {
          this.ui.updateVitals(
            args[7].hp,
            args[7].max_hp,
            args[7].mp,
            args[7].max_mp,
            0,
            100,
            args[7].affs,
          );
        }
      },

      status_info: (args) => {
        // 1. Update Identity Header FIRST with defensive race/subrace formatting
        const identElem = document.getElementById("header-identity");
        if (identElem) {
          const charName = Utils.escapeHtml(args[0] || this.engine.currentActor);
          const race = args[8] ? Utils.formatName(args[8]) : "";
          const subrace = args[9] ? Utils.formatName(args[9]) : "";
          const raceStr = [race, subrace].filter(Boolean).join(" ");

          identElem.innerText = raceStr ? `${charName} (${raceStr})` : charName;
        }

        // 2. Safely update Stats
        this.ui.updateStats(
          args[1],
          args[2],
          args[3],
          args[4],
          args[5],
          args[7]
        );

        // 3. Safely update Vitals (guards against undefined vitals object)
        if (args[6]) {
          this.ui.updateVitals(
            args[6].hp,
            args[6].max_hp,
            args[6].mp,
            args[6].max_mp,
            args[2],
            args[3],
            args[6].affs || []
          );
        }
      },

      inventory_info: (args) => {
        this.ui.updateInventory(args[1], args[2]);
      },

      moved: (args) => {
        const moverId = args[0];
        const dir = args[1];
        const dest = args[2];
        const displayName = args[3] || moverId;

        if (moverId === this.engine.currentActor) {
          this.ui.log(
            `You moved <strong>${dir}</strong> to <strong>${Utils.formatId(dest)}</strong>.`,
            "msg-move",
          );
        } else {
          this.ui.log(
            `<strong>${Utils.escapeHtml(Utils.formatName(displayName))}</strong> moved <strong>${dir}</strong>.`,
            "msg-move",
          );
        }
        this.engine.sendCommand("look");
      },

      walk_started: (args) => {
        this.ui.log(
          `🚶 Auto-walk started towards <strong>${Utils.formatId(args[1])}</strong>.`,
          "msg-system",
        );
      },

      walk_cancelled: () => {
        this.ui.log(`🛑 Auto-walk cancelled.`, "msg-system");
      },

      walk_completed: (args) => {
        this.ui.log(
          `✅ Arrived at destination: <strong>${Utils.formatId(args[1])}</strong>.`,
          "msg-system",
        );
        this.engine.sendCommand("look");
      },

      env_msg: (args) => {
        this.ui.log(`🌍 ${Utils.escapeHtml(args[0])}`, "msg-env");
        this.engine.sendCommand("look");
      },

      ambient_msg: (args) => {
        this.ui.log(
          `🍃 <span style="color: #94a3b8; font-style: italic;">${Utils.escapeHtml(args[0])}</span>`,
          "",
        );
      },

      time_report: (args) => {
        this.ui.log(`🕒 ${Utils.escapeHtml(args[1])}`, "msg-env");
      },

      anomaly_located: (args) => {
        this.ui.log(args[0], "msg-magic");
      },

      // COMBAT & SPELLS
      hit: (args) => {
        this.ui.log(
          `<strong>${Utils.escapeHtml(args[0])}</strong> struck <strong>${Utils.escapeHtml(args[1])}</strong> for <strong>${args[2]}</strong> damage! (${args[3]}/${args[4]} HP)`,
          "msg-combat",
        );
      },

      crit: (args) => {
        this.ui.log(
          `💥 <strong>CRITICAL STRIKE!</strong> <strong>${Utils.escapeHtml(args[0])}</strong> devastated <strong>${Utils.escapeHtml(args[1])}</strong> for <strong>${args[2]}</strong> damage! (${args[3]}/${args[4]} HP)`,
          "msg-combat-crit",
        );
      },

      spell_crit: (args) => {
        this.ui.log(
          `🌟 <strong>SPELL CRITICAL!</strong> <strong>${Utils.escapeHtml(args[0])}</strong> blasted <strong>${Utils.escapeHtml(args[2])}</strong> with <strong>${Utils.formatName(args[1])}</strong> for <strong>${args[3]}</strong> damage! (${args[4]}/${args[5]} HP)`,
          "msg-combat-crit",
        );
      },

      spell_missed: (args) => {
        this.ui.log(
          `🌫️ The dense mist causes <strong>${Utils.escapeHtml(args[0])}</strong>'s <strong>${Utils.formatName(args[1])}</strong> to fizzle and miss!`,
          "msg-dodge",
        );
      },

      dodged: (args) => {
        this.ui.log(
          `⚡ <strong>${Utils.escapeHtml(args[0])}</strong> nimbly DODGED <strong>${Utils.escapeHtml(args[1])}</strong>'s attack!`,
          "msg-dodge",
        );
      },

      cast: (args) => {
        this.ui.log(
          `✨ <strong>${Utils.escapeHtml(args[0])}</strong> cast <strong>${Utils.formatName(args[1])}</strong> at <strong>${Utils.escapeHtml(args[2])}</strong>!<br><span style="color:var(--text-muted); font-style:italic;">${Utils.escapeHtml(args[3])}</span>`,
          "msg-magic",
        );
      },

      cast_area: (args) => {
        this.ui.log(
          `🌩️ <strong>${Utils.escapeHtml(args[0])}</strong> conjured <strong>${Utils.formatName(args[1])}</strong>, engulfing the entire area!<br><span style="color:var(--text-muted); font-style:italic;">${Utils.escapeHtml(args[2])}</span>`,
          "msg-magic",
        );
      },

      cast_group: (args) => {
        this.ui.log(
          `✨ <strong>${Utils.escapeHtml(args[0])}</strong> unleashed <strong>${Utils.formatName(args[1])}</strong> across the group!<br><span style="color:var(--text-muted); font-style:italic;">${Utils.escapeHtml(args[2])}</span>`,
          "msg-magic",
        );
      },

      cast_crit: (args) => {
        this.ui.log(
          `🌟 <strong>SPELL CRITICAL!</strong> <strong>${Utils.escapeHtml(args[0])}</strong> empowered <strong>${Utils.formatName(args[1])}</strong>!`,
          "msg-magic",
        );
      },

      summoned: (args) => {
        this.ui.log(
          `🌀 <strong>${Utils.escapeHtml(args[0])}</strong> cast <strong>${Utils.formatName(args[1])}</strong> and summoned a <strong>${Utils.formatName(args[2])}</strong>!<br><span style="color:var(--text-muted); font-style:italic;">${Utils.escapeHtml(args[3])}</span>`,
          "msg-magic",
        );
        this.engine.sendCommand("look");
      },

      summon_failed: (args) => {
        this.ui.log(
          `❌ <strong>${Utils.escapeHtml(args[0])}</strong> attempted to cast <strong>${Utils.formatName(args[1])}</strong>, but lacked the magical proficiency to manifest it!`,
          "msg-error",
        );
      },

      summon_expired: (args) => {
        this.ui.log(
          `💨 The summoned <strong>${Utils.formatName(args[0])}</strong> dissipates into mist.`,
          "msg-system",
        );
        this.engine.sendCommand("look");
      },

      healed: (args) => {
        this.ui.log(
          `💚 <strong>${Utils.escapeHtml(args[0])}</strong> restored <strong>${args[1]}</strong> HP! (${args[2]}/${args[3]})`,
          "msg-heal",
        );
      },

      aff_applied: (args) => {
        if (args[1] === "asleep") {
          this.ui.log(
            `💤 <strong>${Utils.escapeHtml(args[0])}</strong> falls fast asleep.`,
            "msg-system",
          );
        } else {
          this.ui.log(
            `❇️ <strong>${Utils.formatName(args[1])}</strong> afflicted <strong>${Utils.escapeHtml(args[0])}</strong>!`,
            "msg-system",
          );
        }
        this.engine.sendCommand("look");
      },

      aff_tick: (args) => {
        this.ui.log(
          `🔥 <strong>${Utils.escapeHtml(args[0])}</strong> suffers <strong>${args[2]}</strong> damage from <strong>${Utils.formatName(args[1])}</strong>!`,
          "msg-dot",
        );
      },

      aff_faded: (args) => {
        if (args[1] === "asleep") {
          this.ui.log(
            `☀️ <strong>${Utils.escapeHtml(args[0])}</strong> wakes up!`,
            "msg-system",
          );
        } else {
          this.ui.log(
            `💨 <strong>${Utils.formatName(args[1])}</strong> faded from <strong>${Utils.escapeHtml(args[0])}</strong>.`,
            "msg-system",
          );
        }
        this.engine.sendCommand("look");
      },

      dead: (args) => {
        const deadName = Utils.formatName(args[1] || args[0]);
        this.ui.log(
          `☠️ <strong>${deadName} HAS BEEN SLAIN!</strong>`,
          "msg-crime",
        );
        if (
          args[0] === this.engine.currentActor ||
          args[1] === this.engine.currentActor
        ) {
          const overlay = document.getElementById("death-overlay");
          if (overlay) overlay.style.display = "flex";

          if (!this.engine.respawnTimer) {
            this.engine.respawnTimer = setTimeout(() => {
              this.engine.respawnTimer = null;
              this.engine.sendPayload({ type: "respawn" });
            }, 3500);
          }
        } else {
          this.engine.sendCommand("look");
        }
      },

      respawned: () => {
        const overlay = document.getElementById("death-overlay");
        if (overlay) overlay.style.display = "none";

        this.ui.log(
          `✨ <strong>You have been reborn in the Sanctuary.</strong>`,
          "msg-magic",
        );
        this.engine.sendCommand("look");
        this.engine.sendCommand("status");
      },

      // CHARACTER PROGRESSION
      allocated: (args) => {
        this.ui.log(
          `Trained <strong>${args[1].toUpperCase()}</strong> to <strong>${args[2]}</strong>.`,
          "msg-system",
        );
        this.engine.sendCommand("status");
      },

      xp_gained: (args) => {
        this.ui.log(`Gained <strong>+${args[1]} XP</strong>.`, "msg-system");
        this.engine.sendCommand("status");
      },

      lvl_up: (args) => {
        this.ui.log(
          `🌟 <strong>LEVEL UP! You reached Level ${args[1]}!</strong>`,
          "msg-heal",
        );
        this.engine.sendCommand("status");
      },

      // ITEMS & COMMERCE
      insufficient_gold: (args) => {
        this.ui.log(
          `❌ You do not have enough gold! You need <strong style="color:var(--gold);">${args[1]}g</strong>.`,
          "msg-error"
        );
      },

      looted: (args) => {
        this.ui.log(
          `Picked up <strong>x${args[2]} ${Utils.formatName(args[1])}</strong>.`,
          "msg-loot",
        );
        this.engine.sendCommand("inventory");
        this.engine.sendCommand("look");
      },

      equipped: (args) => this.handleEquipChange(args[1]),
      unequipped: (args) => this.handleEquipChange(args[1]),

      used: (args) => {
        this.ui.log(
          `Used <strong>${Utils.formatName(args[1])}</strong>.`,
          "msg-system",
        );
        this.engine.sendCommand("inventory");
        this.engine.sendCommand("status");
      },

      browse_report: (args) => {
        const npcName = args[1];
        const items = args[2];
        let browseHtml = `<div style="border: 1px solid var(--magic); padding: 12px; border-radius: 6px; background: var(--bg-surface); margin: 6px 0;">
              <strong style="color: var(--magic);"> ${Utils.escapeHtml(npcName)}'s Wares </strong><br>
              <div style="margin-top: 8px; line-height: 1.6;">`;
        if (items && items.length > 0) {
          items.forEach((item) => {
            browseHtml += `&bull; <strong>${Utils.formatName(item.tag)}</strong> - <span style="color: var(--gold);">${item.price}g</span> <i>(Stock: ${item.qty})</i><br>`;
          });
        } else {
          browseHtml += `<span style="color: var(--text-muted); font-style: italic;">Sold out.</span>`;
        }
        browseHtml += `</div></div>`;
        this.ui.log(browseHtml, "msg-system");
      },

      bought: (args) => {
        this.ui.log(
          `🛒 You bought <strong>${Utils.formatName(args[2])}</strong> from <strong>${Utils.escapeHtml(args[1])}</strong> for <strong style="color: var(--gold);">${args[3]}g</strong>.`,
          "msg-system",
        );
        this.engine.sendCommand("inventory");
      },

      sold: (args) => {
        this.ui.log(
          `🪙 You sold <strong>${Utils.formatName(args[2])}</strong> to <strong>${Utils.escapeHtml(args[1])}</strong> for <strong style="color: var(--gold);">${args[3]}g</strong>.`,
          "msg-system",
        );
        this.engine.sendCommand("inventory");
      },

      // CHAT & SOCIAL
      say: (args) => {
        this.ui.log(
          `💬 <strong>${Utils.escapeHtml(args[0])}</strong> says: "${Utils.escapeHtml(args[1])}"`,
          "msg-chat",
        );
      },

      party_chat: (args) => {
        this.ui.log(
          `🟢 <strong style="color:var(--success);">[Party] ${Utils.escapeHtml(args[0])}</strong>: <span style="color:var(--success);">${Utils.escapeHtml(args[1])}</span>`,
          "msg-chat",
        );
      },

      // PARTY SYSTEM
      party_created: (args) => {
        this.ui.log(
          `🎉 <strong>${Utils.escapeHtml(args[0])}</strong> formed the party <strong>${Utils.escapeHtml(args[1])}</strong>!`,
          "msg-system",
        );
      },

      party_info: (args) => {
        let pInfo = `<div style="border:1px solid var(--accent); padding:12px; margin:8px 0; background:var(--bg-surface); border-radius:6px;">
              <strong style="color:var(--accent);"> PARTY: ${Utils.escapeHtml(args[0])} </strong><br>`;
        pInfo += `<div style="margin-top:6px;"><strong>Leader:</strong> ${Utils.escapeHtml(args[1])}</div>`;
        pInfo += `<div style="margin-top:6px;"><strong>Members:</strong> ${args[2].map((m) => Utils.escapeHtml(m)).join(", ")}</div></div>`;
        this.ui.log(pInfo, "msg-system");
      },

      party_invite_sent: (args) => {
        this.ui.log(
          `✉️ <strong>${Utils.escapeHtml(args[0])}</strong> invited <strong>${Utils.escapeHtml(args[1])}</strong> to join <strong>${Utils.escapeHtml(args[2])}</strong>. Type <i>party accept</i> to join!`,
          "msg-system",
        );
      },

      party_joined: (args) => {
        this.ui.log(
          `🤝 <strong>${Utils.escapeHtml(args[0])}</strong> joined the party <strong>${Utils.escapeHtml(args[1])}</strong>!`,
          "msg-system",
        );
      },

      party_left: (args) => {
        this.ui.log(
          `👋 <strong>${Utils.escapeHtml(args[0])}</strong> left the party <strong>${Utils.escapeHtml(args[1])}</strong>.`,
          "msg-system",
        );
      },

      party_kicked: (args) => {
        this.ui.log(
          `👢 <strong>${Utils.escapeHtml(args[0])}</strong> was kicked from <strong>${Utils.escapeHtml(args[1])}</strong>.`,
          "msg-system",
        );
      },

      party_disbanded: (args) => {
        this.ui.log(
          `💔 The party <strong>${Utils.escapeHtml(args[0])}</strong> has been disbanded.`,
          "msg-system",
        );
      },

      // QUEST SYSTEM
      quest_report: (args) => {
        this.ui.log(args[1], "msg-system");
      },

      // BOUNTY SYSTEM
      bounty_gained: (args) => {
        this.ui.log(
          `🚨 <strong>CRIME COMMITTED!</strong> Bounty increased by <strong>${args[1]} Gold</strong>!`,
          "msg-crime",
        );
        this.engine.sendCommand("status");
      },

      bounty_paid: (args) => {
        this.ui.log(
          `⚖️ Paid <strong>${args[1]} Gold</strong> to clear your criminal bounty. Hostilities ceased.`,
          "msg-system",
        );
        this.engine.sendCommand("status");
        this.engine.sendCommand("inventory");
        this.engine.sendCommand("look");
      },

      bounty_claimed: (args) => {
        this.ui.log(
          `💰 <strong>${Utils.escapeHtml(args[0])}</strong> claimed a <strong>${args[2]} Gold</strong> bounty on <strong>${Utils.escapeHtml(args[1])}</strong>!`,
          "msg-loot",
        );
        this.engine.sendCommand("status");
      },

      bounty_report: (args) => {
        let btyHtml = `<div style="border:1px solid var(--gold); padding:12px; margin:8px 0; background:var(--bg-surface); border-radius:6px;">
                      <strong style="color:var(--gold);"> MOST WANTED BOUNTIES </strong><br>`;
        if (args[1] && args[1].length) {
          args[1].forEach((entry, idx) => {
            btyHtml += `<div style="margin-top:6px;">${idx + 1}. <strong>${Utils.escapeHtml(entry.name || entry.id)}</strong> - <span style="color:var(--danger); font-weight:bold;">${entry.bounty} Gold</span></div>`;
          });
        } else {
          btyHtml += `<div style="margin-top:6px; color:var(--text-muted); font-style:italic;">No active bounties in the realm.</div>`;
        }
        btyHtml += `</div>`;
        this.ui.log(btyHtml, "msg-system");
      },

      // STEALTH & SEARCH
      stealth_success: (args) => {
        this.ui.log(
          `🥷 <strong>${Utils.escapeHtml(args[0])}</strong> slipped into the area unnoticed...`,
          "msg-system",
        );
      },

      stealth_spotted: (args) => {
        this.ui.log(
          `⚠️ <strong>${Utils.escapeHtml(args[0])}</strong> was spotted!`,
          "msg-error",
        );
      },

      stealth_revealed: (args) => {
        this.ui.log(
          `🔎 <strong>${Utils.escapeHtml(args[0])}</strong> searched the area and REVEALED <strong>${Utils.escapeHtml(args[1])}</strong> from hiding!`,
          "msg-crime",
        );
        this.engine.sendCommand("look");
      },

      search_nothing: (args) => {
        this.ui.log(
          `🔍 <strong>${Utils.escapeHtml(args[0])}</strong> searched the area thoroughly, but found nothing hidden.`,
          "msg-system",
        );
      },
    };
  }

  // HELPER METHODS FOR REPETITIVE LOGIC
  handleEquipChange(itemName) {
    this.ui.log(
      `Equipment updated: <strong>${Utils.formatName(itemName)}</strong>.`,
      "msg-system",
    );
    this.engine.sendCommand("inventory");
  }
}
