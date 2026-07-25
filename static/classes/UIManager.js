import { onDOMReady, Utils } from "../utilities/utils.js";

export class UIManager {
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

  updateClockFromMinutes(totalMinutes, seasonStr) {
    const clockElem = document.getElementById("header-clock");
    if (!clockElem) return;
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const m = String(totalMinutes % 60).padStart(2, "0");
    const season = seasonStr ? ` (${Utils.formatName(seasonStr)})` : "";
    clockElem.innerText = `🕒 ${h}:${m}${season}`;
  }

  getZoneFromRoom(roomId) {
    if (!roomId || typeof roomId !== "string") return "SH";
    if (roomId.startsWith("cell_")) return "WILD";
    if (roomId.startsWith("room_")) return "DUNGEON";

    const zones = {
      FR: [
        "frosthold_square",
        "frosthold_keep",
        "ice_cavern_entrance",
        "frozen_path",
      ],
      SY: ["sylvandell_square", "sylvandell_temple", "deep_woods_entrance"],
      CR: [
        "crossroads",
        "south_road",
        "far_south_road",
        "east_road",
        "west_road",
        "outpost_path",
      ],
      HF: ["outpost_square", "smithy", "high_inn", "deep_cavern_entrance"],
      PH: [
        "port_square",
        "port_tavern",
        "docks",
        "fishery",
        "sunken_cove_entrance",
        "abandoned_keep_gate",
      ],
      SU: [
        "sunfang_square",
        "sunfang_bazaar",
        "sunfang_tents",
        "pyramid_entrance",
        "ruined_path",
      ],
      SH: [
        "square",
        "tavern",
        "tavern_loft",
        "temple",
        "barracks",
        "watchtower",
        "prison",
        "farm_field",
        "orchard",
        "windmill",
        "north_road",
        "mine_entrance",
        "forest_trail",
        "graveyard",
        "mountain_trail",
      ],
    };

    for (const [zone, rooms] of Object.entries(zones)) {
      if (rooms.includes(roomId)) return zone;
    }

    return null; // Unknown or dynamic fallback
  }

  updateRoom(id, desc, envDesc, exits, props = []) {
    document.getElementById("room-name").innerText = Utils.formatId(id);
    document.getElementById("room-desc").innerText = desc || "";

    const envTagsContainer = document.getElementById("room-env-tags");
    if (envTagsContainer && envDesc) {
      const parts = envDesc.split(" | ");
      envTagsContainer.innerHTML = parts
        .map(
          (part) => `<span class="env-chip">${Utils.escapeHtml(part)}</span>`,
        )
        .join("");

      const timeMatch = envDesc.match(/(\d{2}:\d{2})/);
      const season = parts[0] ? parts[0].trim() : "Spring";
      if (timeMatch && timeMatch[1]) {
        window.game.syncClock(timeMatch[1], season);
      }
    } else if (envTagsContainer) {
      envTagsContainer.innerHTML = "";
    }

    const safeBadge = document.getElementById("room-safe-badge");
    if (safeBadge) {
      const isSafe = Array.isArray(props) && props.includes("safe");
      safeBadge.style.display = isSafe ? "inline-flex" : "none";
    }

    const questBadge = document.getElementById("room-quest-badge");
    if (questBadge) {
      const hasQuest = Array.isArray(props) && props.includes("quest_board");
      questBadge.style.display = hasQuest ? "inline-flex" : "none";
    }

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

    // Update Map Highlighting
    const currentZone = this.getZoneFromRoom(id);
    if (currentZone) {
      const allNodes = ["FR", "SY", "SH", "CR", "HF", "PH", "SU"];
      allNodes.forEach((node) => {
        const circle = document.getElementById(`map-${node}`);
        const text = document.getElementById(`map-text-${node}`);
        if (circle) {
          circle.setAttribute("fill", "var(--bg-surface)");
          circle.setAttribute("stroke", "var(--text-muted)");
          circle.setAttribute("r", "6");
        }
        if (text) {
          text.setAttribute("fill", "var(--text-muted)");
          text.setAttribute("font-weight", "600");
        }
      });

      const wildInd = document.getElementById("wild-indicator");
      if (wildInd) {
        if (currentZone === "WILD") {
          wildInd.innerText = "Exploring Wilderness...";
          wildInd.style.display = "block";
        } else if (currentZone === "DUNGEON") {
          wildInd.innerText = "Exploring Dungeon...";
          wildInd.style.display = "block";
        } else {
          wildInd.style.display = "none";
          const activeCircle = document.getElementById(`map-${currentZone}`);
          const activeText = document.getElementById(`map-text-${currentZone}`);
          if (activeCircle) {
            activeCircle.setAttribute("fill", "var(--accent)");
            activeCircle.setAttribute("stroke", "#ffffff");
            activeCircle.setAttribute("r", "8");
          }
          if (activeText) {
            activeText.setAttribute("fill", "var(--text-main)");
            activeText.setAttribute("font-weight", "700");
          }
        }
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
      const nonHostileTags = [
        "guard",
        "peasant",
        "merchant",
        "priest",
        "miner",
        "citizen",
      ];
      mobs.forEach((m) => {
        const isHostile =
          m.hostile !== undefined
            ? m.hostile
            : !nonHostileTags.includes((m.tag || "").toLowerCase());

        let mobClass = isHostile ? "mob-hostile" : "mob-neutral";

        // Render owned/friendly summons with the player-entity class (blue)
        if (m.owner !== "none" && m.owner !== undefined) {
          if (!isHostile) {
            mobClass = "player-entity";
          }
        }

        const affsHtml = Utils.renderAffs(m.affs);
        html += `<div class="list-item ${mobClass}"><div class="list-item-header"><span class="item-name">${Utils.formatName(m.name || m.tag)}</span><span class="item-meta">${m.hp}/${m.max_hp} HP</span></div><div class="entity-affs">${affsHtml}</div></div>`;
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
