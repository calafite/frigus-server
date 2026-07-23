use serde_json::{Value, json};

pub struct CommandParser;

impl CommandParser {
    pub fn parse(input: &str) -> Option<Value> {
        let tokens: Vec<&str> = input.split_whitespace().collect();
        if tokens.is_empty() {
            return None;
        }

        let verb = tokens[0].to_lowercase();
        match verb.as_str() {
            "look" | "l" => Some(json!({"type": "look"})),
            "north" | "n" => Some(json!({"type": "move", "dir": "north"})),
            "south" | "s" => Some(json!({"type": "move", "dir": "south"})),
            "east" | "e" => Some(json!({"type": "move", "dir": "east"})),
            "west" | "w" => Some(json!({"type": "move", "dir": "west"})),
            "up" | "u" => Some(json!({"type": "move", "dir": "up"})),
            "down" | "d" => Some(json!({"type": "move", "dir": "down"})),
            "help" | "h" | "?" => Some(json!({"type": "local_help"})),

            "go" | "move" => {
                let direction = tokens.get(1).copied().unwrap_or("");
                Some(json!({"type": "move", "dir": direction}))
            }

            "kill" | "k" => {
                let target = tokens.get(1).copied().unwrap_or("");
                Some(json!({"type": "kill", "target": target}))
            }

            "cast" | "c" => {
                let spell = tokens.get(1).copied().unwrap_or("");
                let target = tokens.get(2).copied().unwrap_or("self");
                Some(json!({"type": "cast", "spell": spell, "target": target}))
            }

            "loot" | "get" | "take" | "g" => {
                let target = tokens.get(1).copied().unwrap_or("");
                Some(json!({"type": "loot", "target": target}))
            }

            "equip" => {
                let item = tokens.get(1).copied().unwrap_or("");
                Some(json!({"type": "equip", "item": item}))
            }

            "unequip" => {
                let slot = tokens.get(1).copied().unwrap_or("");
                Some(json!({"type": "unequip", "slot": slot}))
            }

            "use" => {
                let item = tokens.get(1).copied().unwrap_or("");
                Some(json!({"type": "use", "item": item}))
            }

            "talk" => {
                let target = tokens.get(1).copied().unwrap_or("");
                Some(json!({"type": "talk", "target": target}))
            }

            "stance" => {
                let stance = tokens.get(1).copied().unwrap_or("walk");
                Some(json!({"type": "stance", "stance": stance}))
            }

            "fly" => {
                let altitude = tokens.get(1).copied().unwrap_or("air");
                Some(json!({"type": "fly", "altitude": altitude}))
            }

            "jump" => {
                let dir = tokens.get(1).copied().unwrap_or("forward");
                Some(json!({"type": "jump", "dir": dir}))
            }

            "hide" => Some(json!({"type": "hide"})),
            "rest" => Some(json!({"type": "rest"})),
            "sleep" => Some(json!({"type": "sleep"})),
            "wake" => Some(json!({"type": "wake"})),
            "pray" => Some(json!({"type": "pray"})),
            "search" => Some(json!({"type": "search"})),
            "till" => Some(json!({"type": "till"})),
            "harvest" => Some(json!({"type": "harvest"})),
            "disarm" => Some(json!({"type": "disarm"})),
            "ignite" => Some(json!({"type": "ignite"})),

            "train" if tokens.len() > 1 => {
                let stat = tokens[1];
                Some(json!({"type": "train", "stat": stat}))
            }

            "craft" if tokens.len() > 1 => {
                let item = tokens[1];
                Some(json!({"type": "craft", "item": item}))
            }

            "say" if tokens.len() > 1 => {
                let message = tokens[1..].join(" ");
                Some(json!({"type": "chat", "chan": "local", "msg": message}))
            }

            "gossip" | "chat" if tokens.len() > 1 => {
                let message = tokens[1..].join(" ");
                Some(json!({"type": "chat", "chan": "global", "msg": message}))
            }

            "tell" | "whisper" if tokens.len() > 2 => {
                let recipient = tokens[1];
                let message = tokens[2..].join(" ");
                Some(json!({"type": "whisper", "target": recipient, "msg": message}))
            }

            "buy" if tokens.len() >= 3 => {
                let target = tokens[1];
                let item = tokens[2];
                let qty = tokens
                    .get(3)
                    .and_then(|q| q.parse::<i64>().ok())
                    .unwrap_or(1);
                Some(json!({"type": "buy", "target": target, "item": item, "qty": qty}))
            }

            "sell" if tokens.len() >= 3 => {
                let target = tokens[1];
                let item = tokens[2];
                let qty = tokens
                    .get(3)
                    .and_then(|q| q.parse::<i64>().ok())
                    .unwrap_or(1);
                Some(json!({"type": "sell", "target": target, "item": item, "qty": qty}))
            }

            _ => {
                if input.starts_with('{') {
                    serde_json::from_str::<Value>(input).ok()
                } else {
                    None
                }
            }
        }
    }
}
