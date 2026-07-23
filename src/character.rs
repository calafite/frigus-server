use colored::*;
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};

pub struct CharacterWizard;

impl CharacterWizard {
    pub async fn run<R, W>(
        lines: &mut R,
        writer: &mut W,
        actor: &str,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>>
    where
        R: AsyncBufReadExt + Unpin,
        W: AsyncWriteExt + Unpin,
    {
        let banner = format!(
            "\n{}\n  {} [{}]\n{}\n",
            "==================================================================".cyan(),
            "CHARACTER CREATION WIZARD: Creating adventurer"
                .yellow()
                .bold(),
            actor.cyan().bold(),
            "==================================================================".cyan()
        );
        writer.write_all(banner.as_bytes()).await?;

        let gender_options = vec!["male", "female", "nonbinary"];
        let gender_idx = Self::select_menu(
            writer,
            lines,
            "Select Your Character Gender:",
            &gender_options,
        )
        .await?;
        let gender = gender_options[gender_idx].to_string();

        let race_options = vec![
            "human",
            "elf",
            "dwarf",
            "orc",
            "goblin",
            "halfling",
            "draconian",
            "beastkin",
            "merfolk",
            "golem",
            "undead",
            "troll",
            "gnome",
            "tiefling",
            "giant",
            "demigod [RESTRICTED]",
            "angel [RESTRICTED]",
            "demon [RESTRICTED]",
        ];

        let race_idx =
            Self::select_menu(writer, lines, "Choose Your Lineage / Race:", &race_options).await?;
        let raw_race = race_options[race_idx].split_whitespace().next().unwrap();
        let race = raw_race.to_string();

        let is_restricted = matches!(race.as_str(), "demigod" | "angel" | "demon");
        let mut secret_password = String::new();

        if is_restricted {
            let prompt_text = format!(
                "\n{} Race '{}' requires a secret master key: ",
                "RESTRICTED GATEWAY:".red().bold(),
                race.yellow().bold()
            );
            writer.write_all(prompt_text.as_bytes()).await?;
            secret_password = Self::read_line(lines).await?;
        }

        let class_options = vec!["fighter", "wizard", "rogue", "cleric"];
        let class_idx = Self::select_menu(
            writer,
            lines,
            "Select Your Class Specialization:",
            &class_options,
        )
        .await?;
        let class = class_options[class_idx].to_string();

        let (str_val, dex_val, con_val, int_val, wis_val, cha_val, luk_val) =
            Self::allocate_stats(writer, lines, is_restricted).await?;

        let weapon_options = vec![
            "sword",
            "dagger",
            "staff",
            "shortbow",
            "wooden_club",
            "bronze_sword",
            "bronze_dagger",
            "fists",
        ];
        let wpn_idx = Self::select_menu(
            writer,
            lines,
            "Choose Your Starting Weapon:",
            &weapon_options,
        )
        .await?;
        let starting_weapon = weapon_options[wpn_idx].to_string();

        let summary = format!(
            "\n{}\n  {} {}\n  Gender: {}\n  Race:   {}\n  Class:  {}\n  Weapon: {}\n  Stats:  STR:{} DEX:{} CON:{} INT:{} WIS:{} CHA:{} LUK:{}\n{}\nIs this character ready? (y/n): ",
            "------------------- CHARACTER SUMMARY -------------------".cyan(),
            "Name:  ".yellow().bold(),
            actor.bold(),
            gender.cyan(),
            race.yellow(),
            class.green(),
            starting_weapon.magenta(),
            str_val,
            dex_val,
            con_val,
            int_val,
            wis_val,
            cha_val,
            luk_val,
            "---------------------------------------------------------".cyan()
        );
        writer.write_all(summary.as_bytes()).await?;

        let confirm = Self::read_line(lines).await?;
        if !confirm.eq_ignore_ascii_case("y") && !confirm.eq_ignore_ascii_case("yes") {
            writer.write_all(b"Restarting wizard...\n").await?;
            return Box::pin(Self::run(lines, writer, actor)).await;
        }

        Ok(json!({
            "type": "create_player",
            "race": race,
            "class": class,
            "gender": gender,
            "str": str_val,
            "dex": dex_val,
            "con": con_val,
            "int": int_val,
            "wis": wis_val,
            "cha": cha_val,
            "luk": luk_val,
            "starting_weapon": starting_weapon,
            "secret_password": secret_password
        }))
    }

    async fn allocate_stats<R, W>(
        writer: &mut W,
        lines: &mut R,
        is_restricted: bool,
    ) -> Result<(i64, i64, i64, i64, i64, i64, i64), Box<dyn std::error::Error + Send + Sync>>
    where
        R: AsyncBufReadExt + Unpin,
        W: AsyncWriteExt + Unpin,
    {
        let initial_points: i64 = if is_restricted { 300 } else { 15 };
        let mut points_left = initial_points;
        let mut stats = [10i64; 7];
        let stat_names = ["STR", "DEX", "CON", "INT", "WIS", "CHA", "LUK"];
        let inc_amount = if is_restricted { 10 } else { 1 };

        loop {
            let mut prompt = format!(
                "\n{}\nBonus Points Remaining: [{}]\n",
                "--- ATTRIBUTE POINT DISTRIBUTION ---".yellow().bold(),
                points_left.to_string().cyan().bold()
            );

            for (i, name) in stat_names.iter().enumerate() {
                prompt.push_str(&format!("  {}) {}: {}\n", i + 1, name.bold(), stats[i]));
            }
            prompt.push_str("  8) Reset All Points\n");
            prompt.push_str("  9) Confirm Attributes\n");
            prompt.push_str(&format!(
                "Select attribute to add {} point(s) (1-9): ",
                inc_amount
            ));

            writer.write_all(prompt.as_bytes()).await?;
            let choice_str = Self::read_line(lines).await?;

            match choice_str.trim() {
                "1" | "2" | "3" | "4" | "5" | "6" | "7" => {
                    let idx: usize = choice_str.trim().parse::<usize>()? - 1;
                    let add_amt = std::cmp::min(points_left, inc_amount);
                    if add_amt > 0 {
                        stats[idx] += add_amt;
                        points_left -= add_amt;
                    } else {
                        writer.write_all(b"No remaining bonus points!\n").await?;
                    }
                }
                "8" => {
                    stats = [10i64; 7];
                    points_left = initial_points;
                }
                "9" => {
                    if points_left > 0 {
                        writer
                            .write_all(
                                format!(
                                    "You still have {} unspent points. Proceed anyway? (y/n): ",
                                    points_left
                                )
                                .as_bytes(),
                            )
                            .await?;
                        let ans = Self::read_line(lines).await?;
                        if ans.eq_ignore_ascii_case("y") || ans.eq_ignore_ascii_case("yes") {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                _ => {
                    writer.write_all(b"Invalid choice.\n").await?;
                }
            }
        }

        Ok((
            stats[0], stats[1], stats[2], stats[3], stats[4], stats[5], stats[6],
        ))
    }

    async fn select_menu<R, W>(
        writer: &mut W,
        lines: &mut R,
        title: &str,
        options: &[&str],
    ) -> Result<usize, Box<dyn std::error::Error + Send + Sync>>
    where
        R: AsyncBufReadExt + Unpin,
        W: AsyncWriteExt + Unpin,
    {
        loop {
            let mut prompt = format!("\n{}\n", title.yellow().bold());
            for (idx, opt) in options.iter().enumerate() {
                prompt.push_str(&format!("  {}) {}\n", idx + 1, opt));
            }
            prompt.push_str(&format!("Select (1-{}): ", options.len()));

            writer.write_all(prompt.as_bytes()).await?;
            let input = Self::read_line(lines).await?;

            if let Ok(num) = input.trim().parse::<usize>() {
                if num >= 1 && num <= options.len() {
                    return Ok(num - 1);
                }
            }
            writer
                .write_all(b"Invalid choice. Please try again.\n")
                .await?;
        }
    }

    async fn read_line<R>(lines: &mut R) -> Result<String, Box<dyn std::error::Error + Send + Sync>>
    where
        R: AsyncBufReadExt + Unpin,
    {
        let mut buf = String::new();
        let bytes_read = lines.read_line(&mut buf).await?;
        if bytes_read == 0 {
            return Err("Client disconnected".into());
        }
        Ok(buf.trim().to_string())
    }
}
