mod character;
mod client;
mod command;
mod config;
mod format;
mod heartbeat;
mod server;
mod session;

use client::EngineClient;
use config::Config;
use heartbeat::Heartbeat;
use server::Server;
use session::SessionManager;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let config = Config::from_env();
    let client = EngineClient::new(&config.engine_url);
    let sessions = SessionManager::new();

    info!("Starting Frigus MUD Gateway");
    info!("Prolog Engine URL: {}", config.engine_url);

    let heartbeat = Heartbeat::new(config.clone(), client.clone());
    tokio::spawn(async move {
        heartbeat.run().await;
    });

    let server = Server::new(config, client, sessions);
    server.run().await?;

    Ok(())
}
