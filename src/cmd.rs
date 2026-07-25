use serde_json::{Value, json};

pub struct CmdParser;

impl CmdParser {
    pub fn parse(text: &str) -> Option<Value> {
        let mut iter = text.split_whitespace();
        let verb = iter.next()?.to_lowercase();

        let arg1 = iter.next().unwrap_or("");
        let arg2 = iter.next().unwrap_or("none");

        match verb.as_str() {
            "look" | "l" => Self::base("look"),
            "status" | "stat" | "hp" | "info" => Self::base("status"),
            "inventory" | "inv" | "i" => Self::base("inventory"),
            "bounty" | "bounties" | "leaderboard" => Self::base("bounty"),
            "pay" | "pay_bounty" | "pardon" => Self::base("pay_bounty"),
            "time" | "weather" | "env" => Self::base("time"),
            "respawn" => Self::base("respawn"),
            "help" | "h" | "?" => Self::base("local_help"),
            "search" | "scan" | "find" => Self::base("search"),
            "north" | "n" => Self::dir("north"),
            "south" | "s" => Self::dir("south"),
            "east" | "e" => Self::dir("east"),
            "west" | "w" => Self::dir("west"),
            "up" | "u" => Self::dir("up"),
            "down" | "d" => Self::dir("down"),
            "go" | "move" => Self::dir(arg1),
            "walk" => {
                let x = if arg1.is_empty() { "0" } else { arg1 };
                let y = if arg2 == "none" { "0" } else { arg2 };
                let z = iter.next().unwrap_or("0");
                Some(json!({ "type": "walk", "target": format!("cell_{}_{}_{}", x, y, z) }))
            }
            "cancel_walk" | "stop" => Self::base("cancel_walk"),
            "kill" | "k" => Self::target("kill", arg1),
            "loot" | "get" | "take" | "g" => Self::target("loot", arg1),
            "train" | "allocate" => Self::target("allocate", arg1),
            "equip" => Self::item("equip", arg1),
            "use" => Self::item("use", arg1),
            "unequip" => Self::slot("unequip", arg1),
            "cast" | "c" => Some(json!({"type": "cast", "spell": arg1, "target": arg2})),
            "browse" | "shop" => Self::target("browse", arg1),
            "buy" => Some(json!({"type": "buy", "npc": arg1, "item": arg2})),
            "sell" => Some(json!({"type": "sell", "npc": arg1, "item": arg2})),
            "say" => {
                let msg = text
                    .splitn(2, char::is_whitespace)
                    .nth(1)
                    .unwrap_or("")
                    .trim();
                Some(json!({ "type": "say", "text": msg }))
            }
            "p" | "party_say" => {
                let msg = text
                    .splitn(2, char::is_whitespace)
                    .nth(1)
                    .unwrap_or("")
                    .trim();
                Some(json!({ "type": "party_say", "text": msg }))
            }
            "party" => {
                let sub = arg1;
                let target = text
                    .splitn(3, char::is_whitespace)
                    .nth(2)
                    .unwrap_or("")
                    .trim();
                Some(json!({ "type": "party", "action": sub, "target": target }))
            }
            _ => Self::json(text),
        }
    }

    fn base(act: &str) -> Option<Value> {
        Some(json!({ "type": act }))
    }

    fn dir(val: &str) -> Option<Value> {
        Some(json!({ "type": "move", "dir": val }))
    }

    fn target(act: &str, tgt: &str) -> Option<Value> {
        Some(json!({ "type": act, "target": tgt }))
    }

    fn item(act: &str, obj: &str) -> Option<Value> {
        Some(json!({ "type": act, "item": obj }))
    }

    fn slot(act: &str, obj: &str) -> Option<Value> {
        Some(json!({ "type": act, "slot": obj }))
    }

    fn json(raw: &str) -> Option<Value> {
        let is_json = raw.starts_with('{');
        is_json.then(|| serde_json::from_str(raw).ok()).flatten()
    }
}
