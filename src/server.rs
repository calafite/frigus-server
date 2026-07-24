use crate::client::EngineClient;
use crate::command::CommandParser;
use crate::config::Config;
use crate::format::{EventFormatter, Target};
use crate::session::SessionManager;
use colored::*;
use serde_json::json;
use std::net::SocketAddr;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tracing::{error, info};

pub struct Server {
    config: Config,
    client: EngineClient,
    sessions: SessionManager,
}

impl Server {
    pub fn new(config: Config, client: EngineClient, sessions: SessionManager) -> Self {
        Self {
            config,
            client,
            sessions,
        }
    }

    pub async fn run(&self) -> Result<(), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind(&self.config.endpoint_url).await?;
        info!("MUD TCP Server listening on {}", self.config.endpoint_url);

        loop {
            let (socket, addr) = listener.accept().await?;
            let client = self.client.clone();
            let sessions = self.sessions.clone();

            tokio::spawn(async move {
                if let Err(err) = Self::handle_session(socket, addr, client, sessions).await {
                    error!("Session error for {}: {}", addr, err);
                }
            });
        }
    }

    async fn handle_session(
        socket: TcpStream,
        addr: SocketAddr,
        client: EngineClient,
        sessions: SessionManager,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let (reader, mut writer) = socket.into_split();
        let mut lines = BufReader::new(reader);

        writer
            .write_all(EventFormatter::banner().as_bytes())
            .await?;
        writer
            .write_all(b"\nEnter your character name / Actor ID: ")
            .await?;

        let mut name_input = String::new();
        if lines.read_line(&mut name_input).await? == 0 {
            return Ok(());
        }

        let actor = name_input.trim().to_string();

        if actor.is_empty() {
            writer
                .write_all(b"Invalid character name. Disconnecting.\n")
                .await?;
            return Ok(());
        }

        name_input.clear();

        let status = client.ensure_player(&actor).await?;

        if status == "created" {
            writer
                .write_all(b"\nCharacter successfully created!\n")
                .await?;
        } else {
            let welcome = format!("\nWelcome back, {}!\n", actor.cyan().bold());
            writer.write_all(welcome.as_bytes()).await?;
        }

        let (tx, mut rx) = mpsc::unbounded_channel::<String>();
        sessions.register(&actor, tx).await;
        info!("Player '{}' connected from {}", actor, addr);

        let mut writer_task = tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if writer.write_all(msg.as_bytes()).await.is_err() {
                    break;
                }
            }
        });

        Self::execute_action(&client, sessions.clone(), &actor, json!({"type": "look"})).await;

        name_input.clear();

        loop {
            tokio::select! {
                line = lines.read_line(&mut name_input) => {
                    match line {
                        Ok(n) if n > 0 => {
                            let input = name_input.trim();
                            if input.is_empty() {
                                name_input.clear();
                                continue;
                            }

                            if input.eq_ignore_ascii_case("quit") || input.eq_ignore_ascii_case("exit") {
                                sessions.send_to(&actor, "Farewell, adventurer!\n").await;
                                break;
                            }

                            if let Some(action) = CommandParser::parse(input) {
                                if action.get("type").and_then(|t| t.as_str()) == Some("local_help") {
                                    let help_text = format!(
                                        "\n{}\n  {}\n  {}\n  {}\n  {}\n  {}\n  {}\n  {}\n  {}\n  {}\n{}\n",
                                        "--- COMMAND HELP ---".cyan().bold(),
                                        "look / l                  - Inspect current location",
                                        "n / s / e / w / u / d     - Directional movement",
                                        "go <exit>                 - Move to custom exit (e.g. go wild)",
                                        "c <spell> [target]        - Cast spell (e.g. c mend, c fireball orc)",
                                        "k <target>                - Attack target (e.g. k goblin)",
                                        "get / g <item>            - Pick up item from floor",
                                        "equip <item> / unequip    - Equip or unequip items",
                                        "use <item>                - Use an item (e.g. potion, bread)",
                                        "quit / exit               - Safely exit the game",
                                        "--------------------".cyan()
                                    );
                                    sessions.send_to(&actor, &help_text).await;
                                } else {
                                    Self::execute_action(&client, sessions.clone(), &actor, action).await;
                                }
                            } else {
                                let err_text = format!("{}\n", "Unknown command. Type 'help' for assistance.".red());
                                sessions.send_to(&actor, &err_text).await;
                            }
                            name_input.clear();
                        }
                        _ => break,
                    }
                }
                _ = &mut writer_task => break,
            }
        }

        sessions.unregister(&actor).await;
        info!("Player '{}' disconnected", actor);
        Ok(())
    }

    pub async fn handle_events(
        client: &EngineClient,
        sessions: &SessionManager,
        actor: &str,
        events: Vec<serde_json::Value>,
    ) {
        for event in events {
            if let Some(rendered) = EventFormatter::render(actor, &event) {
                match rendered.target {
                    Target::Actor(actor_id) => {
                        sessions.send_to(&actor_id, &rendered.text).await;
                    }
                    Target::Combatants(attacker, target) => {
                        sessions
                            .broadcast_combat(&attacker, &target, &rendered.text)
                            .await;
                    }
                    Target::Multi(targets) => {
                        for target in targets {
                            sessions.send_to(target.as_str(), &rendered.text).await;
                        }
                    }
                    Target::Global => {
                        sessions.broadcast(&rendered.text).await;
                    }
                }

                if rendered.trigger_look && actor != "system" {
                    let look_action = json!({"type": "look"});
                    Box::pin(Self::execute_action(
                        client,
                        sessions.clone(),
                        actor,
                        look_action,
                    ))
                    .await;
                }
            }
        }
    }

    pub async fn execute_action(
        client: &EngineClient,
        sessions: SessionManager,
        actor: &str,
        action: serde_json::Value,
    ) {
        match client.step(actor, action).await {
            Ok(events) => {
                Self::handle_events(client, &sessions, actor, events).await;
            }
            Err(err) => {
                let err_text = format!("Engine Error: {}\n", err.to_string().red());
                sessions.send_to(actor, &err_text).await;
            }
        }
    }
}
