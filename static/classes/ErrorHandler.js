import { Utils } from "../utilities/utils.js";

/**
 * Registry of all error handlers mapped by error type.
 * Each entry returns either a log definition `{ msg, level }` or performs custom UI actions.
 */
const ERROR_REGISTRY = {
  // QUEST ERRORS
  no_quest_board: () => ({
    msg: "❌ There is no quest board here.",
  }),
  quest_not_found: () => ({
    msg: "❌ Could not find a quest with that ID.",
  }),
  quest_already_accepted: () => ({
    msg: "❌ You have already accepted that quest.",
  }),
  quest_already_completed: () => ({
    msg: "❌ You have already completed that quest.",
  }),
  quest_not_accepted: () => ({
    msg: "❌ You haven't accepted that quest yet.",
  }),
  quest_objectives_incomplete: () => ({
    msg: "❌ You haven't completed all objectives for this quest.",
  }),
  invalid_quest_command: () => ({
    msg: "❌ Invalid quest command. Use: list, read <id>, accept <id>, finish <id>, progress [id]",
  }),

  // PARTY ERRORS
  already_in_party: () => ({
    msg: "❌ You are already in a party!",
  }),
  party_name_required: () => ({
    msg: "❌ You must specify a name for the party.",
  }),
  not_in_party: () => ({
    msg: "❌ You are not currently in a party.",
  }),
  party_not_found: () => ({
    msg: "❌ Party not found. It may have been disbanded.",
  }),
  target_already_in_party: (args) => ({
    msg: `❌ ${Utils.escapeHtml(args[0])} is already in a party.`,
  }),
  player_not_found: (args) => ({
    msg: `❌ Could not find player '${Utils.escapeHtml(args[0])}' in this room.`,
  }),
  not_party_leader: () => ({
    msg: "❌ Only the party leader can do that.",
  }),
  no_pending_invite: () => ({
    msg: "❌ You have no pending party invitations.",
  }),
  cannot_kick_self: () => ({
    msg: "❌ You cannot kick yourself. Use 'party leave' instead.",
  }),
  member_not_found: (args) => ({
    msg: `❌ Could not find party member '${Utils.escapeHtml(args[0])}'.`,
  }),
  invalid_party_command: () => ({
    msg: "❌ Invalid party command. Use new, list, invite, accept, leave, or kick.",
  }),

  // ITEM / ECONOMY ERRORS
  item_not_found: (args) => ({
    msg: `❌ You do not have '${Utils.formatName(args[1])}' in your inventory!`,
  }),
  cannot_use: (args) => ({
    msg: `❌ You cannot use '${Utils.formatName(args[1])}'!`,
  }),
  cannot_equip: (args) => ({
    msg: `❌ You cannot equip '${Utils.formatName(args[1])}'!`,
  }),
  cannot_trade_currency: () => ({
    msg: "❌ You cannot trade currency directly!",
  }),
  merchant_not_found: (args) => ({
    msg: `❌ Could not find merchant '${Utils.escapeHtml(args[0])}' here.`,
  }),
  merchant_out_of_stock: (args) => ({
    msg: `❌ The merchant doesn't have '${Utils.formatName(args[1])}' in stock.`,
  }),
  merchant_out_of_gold: () => ({
    msg: "❌ The merchant cannot afford this item.",
  }),
  no_bounty_to_pay: () => ({
    msg: `❌ You do not have a bounty to pay off.`,
  }),

  // COMBAT / MAGIC ERRORS
  already_have_summon: () => ({
    msg: "❌ You already command an active summon!",
  }),
  safe_zone: () => ({
    msg: "🕊️ Violence is forbidden in this sanctuary.",
    level: "msg-system", // Preserves system message styling for safe zone
  }),
  cc_prevented: (args) => ({
    msg: `❌ You are <strong>${Utils.formatName(args[1])}</strong> and cannot act!`,
  }),
  spell_affinity_denied: (args) => ({
    msg: `❌ Your lineage lacks the affinity to cast <strong>${Utils.formatName(args[1])}</strong>.`,
  }),
  no_valid_targets: (args) => ({
    msg: `❌ No valid targets found for <strong>${Utils.formatName(args[1])}</strong>!`,
  }),

  // MOVEMENT ERRORS
  not_in_wild: () => ({
    msg: "❌ You can only auto-walk in the wilderness.",
  }),
  already_at_destination: () => ({
    msg: "❌ You are already at that location!",
  }),
  invalid_walk_target: () => ({
    msg: "❌ That destination is not valid wilderness coordinates.",
  }),
  not_walking: () => ({
    msg: "❌ You are not currently auto-walking.",
  }),

  // CHAT / MISC ERRORS
  empty_message: () => ({
    msg: "❌ You open your mouth, but no words come out.",
  }),

  //  AUTH / ACCOUNT ERRORS
  invalid_password: (args, ui) => {
    alert("Invalid Password!");
    ui.showOverlay();
  },
  account_does_not_exist: (args, ui) => {
    alert(`Account "${args[0]}" does not exist! Please register first.`);
    ui.showOverlay();
    ui.switchAuthTab("reg");
  },
  account_already_exists: (args, ui) => {
    alert(
      `Character name "${args[0]}" is already taken! Please choose another name.`,
    );
    ui.showOverlay();
    ui.switchAuthTab("reg");
  },
  restricted_race_denied: (args, ui) => {
    ui.showOverlay();
    const step1 = document.getElementById("reg-step-1");
    const step2 = document.getElementById("reg-step-2");
    const errElem = document.getElementById("reg-err-1");

    if (step1) step1.style.display = "block";
    if (step2) step2.style.display = "none";
    if (errElem) {
      errElem.innerText = "Admin Key rejected for Angel/Demon lineage!";
      errElem.style.display = "block";
    }
  },
  stat_allocation_invalid: (args, ui) => {
    ui.showOverlay();
    const errElem = document.getElementById("reg-err-2");
    if (errElem) {
      errElem.innerText = "Invalid allocation!";
      errElem.style.display = "block";
    }
  },
};

export class ErrorHandler {
  /**
   * Processes incoming error objects and routes them to the appropriate handler.
   * @param {Object} errObj = The error object received from the socket payload
   * @param {Object} rawArgs = The raw event arguments (used for fallback logging)
   * @param {Object} ui = Reference to the UI controller instance
   */
  static handle(errObj, rawArgs, ui = window.ui) {
    if (!errObj) return;

    const errorType = errObj.type;
    const args = errObj.args || [];
    const handler = ERROR_REGISTRY[errorType];

    if (handler) {
      const result = handler(args, ui);

      // If handler returned a log definition, process it
      if (result && result.msg) {
        ui.log(result.msg, result.level || "msg-error");
      }
    } else {
      // Fallback for unhandled/unknown errors
      ui.log(
        `[ERROR] ${Utils.escapeHtml(JSON.stringify(rawArgs))}`,
        "msg-error",
      );
    }
  }
}
