import { BUFFS, CCS } from './constants.js';

export function onDOMReady(fn) {
  if (document.readyState !== "loading") {
    fn();
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}

export const Utils = {
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
    if (tag === "marked") type = "aff-marked";
    else if (tag === "panicked") type = "aff-panicked";
    else if (tag === "thornskin") type = "aff-thornskin";
    else if (tag === "silenced") type = "aff-silenced";
    else if (tag === "rooted") type = "aff-rooted";
    else if (CCS.includes(tag)) type = "aff-cc";
    else if (BUFFS.includes(tag)) type = "aff-buff";
    return `<span class="aff-badge ${type}">${tag.replace(/_/g, " ")}</span>`;
  },
  renderAffs(affsDict) {
    if (!affsDict || Object.keys(affsDict).length === 0) return "";
    return Object.keys(affsDict)
      .map((tag) => this.getAffBadge(tag))
      .join(" ");
  }
};
