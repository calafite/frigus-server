mod cmd;
mod config;
mod engine;
mod http;
mod ws;

use config::EnvLoader;
use http::WebServer;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), String> {
    tracing_subscriber::fmt::init();

    let cfg = EnvLoader::load();

    info!("Starting Frigus Gateway");
    info!("Target Engine: {}", cfg.engine);

    WebServer::start(cfg).await
}
