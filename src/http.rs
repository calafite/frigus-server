use axum::Router;
use axum::extract::State;
use axum::extract::ws::WebSocketUpgrade;
use axum::response::{Html, IntoResponse};
use axum::routing::get;
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::info;

use crate::config::AppConfig;
use crate::ws::WsProxy;

pub struct AppState {
    pub cfg: AppConfig,
}

pub struct WebServer;

impl WebServer {
    pub async fn start(cfg: AppConfig) -> Result<(), String> {
        let bind_addr = cfg.bind.clone();
        let state = Arc::new(AppState { cfg });

        let router = Router::new()
            .route("/", get(Self::get_html))
            .route("/styles.css", get(Self::get_css))
            .route("/app.js", get(Self::get_js))
            .route("/ws", get(Self::get_ws))
            .with_state(state);

        let sock = TcpListener::bind(&bind_addr)
            .await
            .map_err(|err| err.to_string())?;

        info!("Web UI listening on http://{}", bind_addr);

        axum::serve(sock, router)
            .await
            .map_err(|err| err.to_string())
    }

    async fn get_html() -> Html<&'static str> {
        let html_str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/static/index.html"));
        Html(html_str)
    }

    async fn get_css() -> impl IntoResponse {
        let css_str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/static/styles.css"));
        ([(axum::http::header::CONTENT_TYPE, "text/css")], css_str)
    }

    async fn get_js() -> impl IntoResponse {
        let js_str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/static/app.js"));
        (
            [(axum::http::header::CONTENT_TYPE, "application/javascript")],
            js_str,
        )
    }

    async fn get_ws(
        upg: WebSocketUpgrade,
        State(state): State<Arc<AppState>>,
    ) -> impl IntoResponse {
        upg.on_upgrade(move |sock| WsProxy::bind(sock, state.cfg.clone()))
    }
}
