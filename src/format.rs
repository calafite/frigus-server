use colored::*;
use serde_json::Value;

pub enum Target {
    Actor(String),
    Combatants(String, String),
    Multi(Vec<String>),
    Global,
}

pub struct RenderedEvent {
    pub target: Target,
    pub text: String,
    pub trigger_look: bool,
}

pub struct EventFormatter;

impl EventFormatter {
    pub fn render(current_actor: &str, event: &Value) -> Option<RenderedEvent> {
        let (name, args) = Self::parse_term(event);

        match name.as_str() {
            "look" => Self::render_look(current_actor, &args),
            "safe_zone" => Self::render_safe_zone(current_actor, &args),
            "moved" => Self::render_moved(current_actor, &args),
            "hit" | "crit" | "double_hit" | "backstab" => Self::render_combat_hit(&name, &args),
            "cast" | "cast_crit" => Self::render_cast_hit(&name, &args),
            "cast_miss" | "miss" => Self::render_miss(&args),
            "healed" => Self::render_healed(&args),
            "summoned" => Self::render_summoned(current_actor, &args),
            "unknown_spell" => Self::render_unknown_spell(current_actor, &args),
            "insufficient_mp" => Self::render_insufficient_mp(current_actor, &args),
            "spell_cooldown" => Self::render_spell_cooldown(current_actor, &args),
            "target_not_found" => Self::render_target_not_found(current_actor, &args),
            "item_not_found" => Self::render_item_not_found(current_actor, &args),
            "item_not_in_inv" => Self::render_item_not_in_inv(current_actor, &args),
            "no_exit" => Self::render_no_exit(current_actor, &args),
            "dodged" => Self::render_dodged(&args),
            "dead" => Self::render_dead(&args),
            "say" => Self::render_say(current_actor, &args),
            "chat" => Self::render_chat(&args),
            "looted" => Self::render_looted(current_actor, &args),
            "equipped" => Self::render_equipped(current_actor, &args),
            "unequipped" => Self::render_unequipped(current_actor, &args),
            "used" => Self::render_used(current_actor, &args),
            "lvl_up" => Self::render_lvl_up(current_actor, &args),
            _ => Self::render_generic(current_actor, &name, &args),
        }
    }

    pub fn banner() -> String {
        let divider = "==================================================================".cyan();
        let title = "             WELCOME TO THE FRIGUS MULTI-USER DUNGEON            "
            .bold()
            .yellow();
        format!("{}\n{}\n{}\n", divider, title, divider)
    }

    fn parse_term(value: &Value) -> (String, Vec<Value>) {
        if let Some(obj) = value.as_object() {
            if let Some(functor) = obj.get("functor").and_then(|f| f.as_str()) {
                let args = obj
                    .get("args")
                    .and_then(|a| a.as_array())
                    .cloned()
                    .unwrap_or_default();
                return (functor.to_string(), args);
            }
            if obj.len() == 1 {
                let (key, val) = obj.iter().next().unwrap();
                if let Some(arr) = val.as_array() {
                    return (key.clone(), arr.clone());
                }
            }
        } else if let Some(string) = value.as_str() {
            return (string.to_string(), vec![]);
        }
        ("unknown".to_string(), vec![])
    }

    fn format_id(value: &Value) -> String {
        if let Some(s) = value.as_str() {
            return s.to_string();
        }
        if let Some(obj) = value.as_object() {
            if obj.get("functor").and_then(|f| f.as_str()) == Some("cell") {
                if let Some(args) = obj.get("args").and_then(|a| a.as_array()) {
                    if args.len() >= 3 {
                        let x = args[0].as_i64().unwrap_or(0);
                        let y = args[1].as_i64().unwrap_or(0);
                        let z = args[2].as_i64().unwrap_or(0);
                        return format!("cell({}, {}, {})", x, y, z);
                    }
                }
            }
        }
        value.to_string()
    }

    fn format_list(value: &Value) -> String {
        if let Some(arr) = value.as_array() {
            if arr.is_empty() {
                return "none".to_string();
            }
            let elements: Vec<String> = arr.iter().map(|item| Self::format_id(item)).collect();
            return elements.join(", ");
        }
        Self::format_id(value)
    }

    fn format_items(value: &Value) -> String {
        if let Some(arr) = value.as_array() {
            if arr.is_empty() {
                return "none".to_string();
            }
            let item_strings: Vec<String> = arr
                .iter()
                .map(|item| {
                    let tag = item.get("tag").and_then(|t| t.as_str()).unwrap_or("item");
                    let qty = item.get("qty").and_then(|q| q.as_i64()).unwrap_or(1);
                    format!("{} ({}x)", tag, qty)
                })
                .collect();
            return item_strings.join(", ");
        }
        "none".to_string()
    }

    fn render_look(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 7 {
            return None;
        }

        let room_id = Self::format_id(&args[0]);
        let desc = args[1].as_str().unwrap_or("");
        let props = Self::format_list(&args[2]);
        let exits = Self::format_list(&args[3]);
        let players = Self::format_list(&args[4]);
        let mobs = Self::format_list(&args[5]);
        let items = Self::format_items(&args[6]);

        let divider =
            "======================================================================".cyan();
        let sub_divider =
            "----------------------------------------------------------------------".dimmed();
        let location_hdr = format!("LOCATION: [{}]", room_id).yellow().bold();
        let props_fmt = props.dimmed();
        let desc_fmt = desc.white();
        let exits_fmt = format!("Exits: {}", exits).green().bold();

        let mut output = String::new();
        output.push_str(&format!("\n{}\n", divider));
        output.push_str(&format!("  {} {}\n", location_hdr, props_fmt));
        output.push_str(&format!("{}\n", sub_divider));
        output.push_str(&format!("  {}\n\n", desc_fmt));
        output.push_str(&format!("  {}\n", exits_fmt));

        if !players.is_empty() && players != "none" {
            let label = "Players:".blue().bold();
            output.push_str(&format!("  {} {}\n", label, players.blue()));
        }
        if !mobs.is_empty() && mobs != "none" {
            let label = "Monsters:".red().bold();
            output.push_str(&format!("  {} {}\n", label, mobs.red()));
        }
        if !items.is_empty() && items != "none" {
            let label = "Items:".magenta().bold();
            output.push_str(&format!("  {} {}\n", label, items.magenta()));
        }
        output.push_str(&format!("{}\n\n", divider));

        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text: output,
            trigger_look: false,
        })
    }

    fn render_moved(current_actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 3 {
            return None;
        }

        let actor = args[0].as_str().unwrap_or("");
        let dir = args[1].as_str().unwrap_or("");
        let room = Self::format_id(&args[2]);

        if actor == current_actor {
            let dir_fmt = dir.yellow();
            let room_fmt = room.yellow();
            let text = format!("You head {} to {}.\n", dir_fmt, room_fmt);

            Some(RenderedEvent {
                target: Target::Actor(actor.to_string()),
                text,
                trigger_look: true,
            })
        } else {
            let actor_fmt = actor.cyan();
            let text = format!("{} moves {}.\n", actor_fmt, dir);

            Some(RenderedEvent {
                target: Target::Actor(actor.to_string()),
                text,
                trigger_look: false,
            })
        }
    }

    fn render_combat_hit(hit_type_name: &str, args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 3 {
            return None;
        }

        let attacker = args[0].as_str().unwrap_or("");
        let target = args[1].as_str().unwrap_or("");
        let dmg = args[2].as_i64().unwrap_or(0);

        let hit_label = match hit_type_name {
            "crit" => "CRITICAL HIT!".red().bold(),
            "double_hit" => "DOUBLE HIT!".yellow().bold(),
            "backstab" => "BACKSTAB!".magenta().bold(),
            _ => "hit".normal(),
        };

        let dmg_fmt = dmg.to_string().red().bold();
        let text = format!(
            "[COMBAT] {} {} {} for {} damage!\n",
            attacker.bold(),
            hit_label,
            target.bold(),
            dmg_fmt
        );

        Some(RenderedEvent {
            target: Target::Combatants(attacker.to_string(), target.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_cast_hit(hit_type_name: &str, args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 4 {
            return None;
        }

        let caster = args[0].as_str().unwrap_or("");
        let spell = args[1].as_str().unwrap_or("");
        let target = args[2].as_str().unwrap_or("");
        let dmg = args[3].as_i64().unwrap_or(0);

        let spell_fmt = spell.magenta().bold();
        let dmg_fmt = dmg.to_string().red().bold();

        let hit_label = if hit_type_name == "cast_crit" {
            "CRITICAL HIT!".red().bold()
        } else {
            "hit".normal()
        };

        let text = format!(
            "[MAGIC] {} cast {} at {} {} for {} damage!\n",
            caster.bold(),
            spell_fmt,
            target.bold(),
            hit_label,
            dmg_fmt
        );

        Some(RenderedEvent {
            target: Target::Combatants(caster.to_string(), target.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_healed(args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 3 {
            return None;
        }

        let caster = args[0].as_str().unwrap_or("");
        let target = args[1].as_str().unwrap_or("");
        let amt = args[2].as_i64().unwrap_or(0);

        let text = format!(
            "[MAGIC] {} healed {} for {} HP!\n",
            caster.bold(),
            target.bold(),
            amt.to_string().green().bold()
        );

        Some(RenderedEvent {
            target: Target::Combatants(caster.to_string(), target.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_summoned(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        let spell = args.get(1)?.as_str()?;
        let mob = args.get(2)?.as_str()?;

        let text = format!(
            "[MAGIC] You cast {} and summoned {}!\n",
            spell.magenta().bold(),
            mob.cyan().bold()
        );

        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_unknown_spell(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        let spell = args.get(1).and_then(|s| s.as_str()).unwrap_or("");
        let text = format!(
            "Unknown spell '{}'. Type 'help' for assistance.\n",
            spell.yellow()
        );
        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_insufficient_mp(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        let cost = args.get(1).and_then(|c| c.as_i64()).unwrap_or(0);
        let text = format!(
            "Not enough mana to cast spell! (Requires {} MP).\n",
            cost.to_string().cyan()
        );
        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_spell_cooldown(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        let spell = args.get(1).and_then(|s| s.as_str()).unwrap_or("");
        let rem = args.get(2).and_then(|r| r.as_i64()).unwrap_or(0);
        let text = format!(
            "Spell '{}' is on cooldown ({} turn(s) remaining).\n",
            spell.magenta(),
            rem
        );
        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_target_not_found(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        let target = args.get(1).and_then(|t| t.as_str()).unwrap_or("");
        let text = format!("Target '{}' not found here.\n", target.yellow());
        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_item_not_found(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        let item = args.get(1).and_then(|t| t.as_str()).unwrap_or("");
        let text = format!("Item '{}' not found here.\n", item.yellow());
        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_item_not_in_inv(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        let item = args.get(1).and_then(|t| t.as_str()).unwrap_or("");
        let text = format!("You do not have '{}' in your inventory.\n", item.yellow());
        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_no_exit(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        let dir = args.get(1).and_then(|d| d.as_str()).unwrap_or("");
        let text = format!("There is no exit in direction '{}'.\n", dir.yellow());
        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_miss(args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 2 {
            return None;
        }

        let attacker = args[0].as_str().unwrap_or("");
        let target = args[1].as_str().unwrap_or("");
        let text = format!("[COMBAT] {} swung at {} and MISSED!\n", attacker, target);

        Some(RenderedEvent {
            target: Target::Combatants(attacker.to_string(), target.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_dodged(args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 2 {
            return None;
        }

        let target = args[0].as_str().unwrap_or("");
        let attacker = args[1].as_str().unwrap_or("");
        let target_fmt = target.green();

        let text = format!(
            "[COMBAT] {} nimbly DODGED {}'s attack!\n",
            target_fmt, attacker
        );

        Some(RenderedEvent {
            target: Target::Combatants(attacker.to_string(), target.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_dead(args: &[Value]) -> Option<RenderedEvent> {
        let target = args.get(0)?.as_str()?;
        let alert = format!("*** {} HAS BEEN SLAIN! ***", target).red().bold();
        let text = format!("{}\n", alert);

        Some(RenderedEvent {
            target: Target::Global,
            text,
            trigger_look: false,
        })
    }

    fn render_say(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 2 {
            return None;
        }

        let speaker = args[0].as_str().unwrap_or("");
        let speech = args[1].as_str().unwrap_or("");
        let speaker_fmt = speaker.yellow().bold();
        let text = format!("{} says: \"{}\"\n", speaker_fmt, speech);

        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_chat(args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 4 {
            return None;
        }

        let channel = args[0].as_str().unwrap_or("global");
        let sender = args[1].as_str().unwrap_or("");
        let message = args[2].as_str().unwrap_or("");
        let raw_targets = args[3].as_array()?;

        let targets: Vec<String> = raw_targets
            .iter()
            .filter_map(|item| item.as_str().map(|s| s.to_string()))
            .collect();

        let chan_fmt = channel.to_uppercase().cyan();
        let sender_fmt = sender.bold();
        let text = format!("[{}] {}: {}\n", chan_fmt, sender_fmt, message);

        Some(RenderedEvent {
            target: Target::Multi(targets),
            text,
            trigger_look: false,
        })
    }

    fn render_looted(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 3 {
            return None;
        }

        let item = args[1].as_str().unwrap_or("");
        let qty = args[2].as_i64().unwrap_or(1);
        let item_fmt = item.magenta();
        let text = format!("You picked up {}x {}.\n", qty, item_fmt);

        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_equipped(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 3 {
            return None;
        }

        let item = args[1].as_str().unwrap_or("");
        let slot = args[2].as_str().unwrap_or("");
        let item_fmt = item.green();
        let slot_fmt = slot.yellow();
        let text = format!("You equipped {} in slot [{}].\n", item_fmt, slot_fmt);

        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_unequipped(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        if args.len() < 3 {
            return None;
        }

        let item = args[1].as_str().unwrap_or("");
        let slot = args[2].as_str().unwrap_or("");
        let item_fmt = item.green();
        let slot_fmt = slot.yellow();
        let text = format!("You unequipped {} from slot [{}].\n", item_fmt, slot_fmt);

        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_used(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        let item = args.get(1)?.as_str()?;
        let item_fmt = item.cyan();
        let text = format!("You used {}.\n", item_fmt);

        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_lvl_up(actor: &str, args: &[Value]) -> Option<RenderedEvent> {
        let level = args.get(1)?.as_i64()?;
        let banner = format!("★ CONGRATULATIONS! You reached Level {}! ★", level)
            .yellow()
            .bold();
        let text = format!("{}\n", banner);

        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_generic(actor: &str, name: &str, args: &[Value]) -> Option<RenderedEvent> {
        let arg_strings: Vec<String> = args.iter().map(|item| Self::format_id(item)).collect();
        let joined_args = arg_strings.join(", ");
        let name_fmt = name.dimmed();
        let args_fmt = joined_args.dimmed();
        let text = format!("Event [{}]: {}\n", name_fmt, args_fmt);

        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }

    fn render_safe_zone(actor: &str, _args: &[Value]) -> Option<RenderedEvent> {
        let text = format!(
            "{}\n",
            "Combat is strictly forbidden in this safe sanctuary zone!"
                .yellow()
                .bold()
        );
        Some(RenderedEvent {
            target: Target::Actor(actor.to_string()),
            text,
            trigger_look: false,
        })
    }
}
