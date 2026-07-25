use axum::extract::ws::{Message as WebMsg, WebSocket};
use futures::stream::{SplitSink, SplitStream};
use futures::{SinkExt, StreamExt};
use serde_json::{Value, json};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::protocol::Message as TungMsg;

use crate::cmd::CmdParser;
use crate::config::AppConfig;
use crate::engine::{EngineNode, EngineRx, EngineTx};

pub struct UserCreds {
    pub mode: String,
    pub user: String,
    pub pass: String,
    pub key: String,
    pub race: String,
    pub class: String,
    pub stats: Value,
}

pub struct WsProxy;

impl WsProxy {
    pub async fn bind(mut sock: WebSocket, cfg: AppConfig) {
        let creds = match Self::auth(&mut sock, &cfg).await {
            Some(c) => c,
            None => return,
        };

        let eng_url = cfg.engine;
        let (mut eng_tx, eng_rx) = match EngineNode::dial(&eng_url).await {
            Ok(pair) => pair,
            Err(_) => {
                Self::fail_msg(&mut sock, "Engine unreachable!").await;
                return;
            }
        };

        Self::init_user(&creds, &mut eng_tx).await;

        let (web_tx, web_rx) = sock.split();
        let (msg_tx, msg_rx) = mpsc::unbounded_channel::<WebMsg>();

        let user = creds.user;
        let fwd_job = tokio::spawn(Self::pipe_fwd(user, web_rx, eng_tx, msg_tx.clone()));
        let eng_job = tokio::spawn(Self::pipe_eng(eng_rx, msg_tx));
        let bwd_job = tokio::spawn(Self::pipe_bwd(web_tx, msg_rx));

        tokio::select! {
            _ = fwd_job => {},
            _ = eng_job => {},
            _ = bwd_job => {},
        }
    }

    async fn auth(sock: &mut WebSocket, cfg: &AppConfig) -> Option<UserCreds> {
        while let Some(Ok(msg)) = sock.next().await {
            let txt = match msg {
                WebMsg::Text(t) => t.to_string(),
                _ => continue,
            };

            let parsed: Value = match serde_json::from_str(&txt) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let kind = parsed.get("type").and_then(|t| t.as_str());

            if kind == Some("validate_key") {
                let key = parsed.get("key").and_then(|k| k.as_str()).unwrap_or("");
                let req = json!({
                    "actor": "system",
                    "action": {
                        "type": "validate_key",
                        "key": key
                    }
                });

                if let Ok((mut eng_tx, mut eng_rx)) = EngineNode::dial(&cfg.engine).await {
                    let msg = EngineNode::encode(&req);
                    let _ = eng_tx.send(msg).await;
                    if let Some(Ok(resp)) = eng_rx.next().await {
                        let text = resp.into_text().unwrap_or_default();
                        let _ = sock.send(WebMsg::Text(text.as_str().into())).await;
                    }
                }
                continue;
            }

            if kind == Some("login") || kind == Some("register") {
                let mode = kind.unwrap().to_string();
                let user = parsed.get("actor").and_then(|a| a.as_str())?.to_string();
                let pass = parsed
                    .get("pass")
                    .and_then(|p| p.as_str())
                    .unwrap_or("")
                    .to_string();
                let key = parsed
                    .get("key")
                    .and_then(|k| k.as_str())
                    .unwrap_or("")
                    .to_string();
                let race = parsed
                    .get("race")
                    .and_then(|r| r.as_str())
                    .unwrap_or("human")
                    .to_string();
                let class = parsed
                    .get("class")
                    .and_then(|c| c.as_str())
                    .unwrap_or("fighter")
                    .to_string();
                let stats = parsed.get("stats").cloned().unwrap_or_else(|| json!({}));

                return Some(UserCreds {
                    mode,
                    user,
                    pass,
                    key,
                    race,
                    class,
                    stats,
                });
            }
        }
        None
    }

    async fn fail_msg(sock: &mut WebSocket, err: &str) {
        let payload = json!({"events": [{"type": "error", "args": [err]}]});
        let raw = payload.to_string();
        let msg = WebMsg::Text(raw.into());
        let _ = sock.send(msg).await;
    }

    async fn init_user(creds: &UserCreds, tx: &mut EngineTx) {
        let user = &creds.user;
        let auth_act = if creds.mode == "register" {
            json!({
                "type": "register",
                "pass": creds.pass,
                "key": creds.key,
                "race": creds.race,
                "class": creds.class,
                "stats": creds.stats
            })
        } else {
            json!({
                "type": "login",
                "pass": creds.pass
            })
        };

        let init_cmds = vec![
            json!({ "actor": user, "action": auth_act }),
            json!({ "actor": user, "action": { "type": "look" } }),
            json!({ "actor": user, "action": { "type": "status" } }),
            json!({ "actor": user, "action": { "type": "inventory" } }),
        ];

        for payload in init_cmds {
            let msg = EngineNode::encode(&payload);
            let _ = tx.send(msg).await;
        }
    }

    async fn pipe_fwd(
        user: String,
        mut web_rx: SplitStream<WebSocket>,
        mut eng_tx: EngineTx,
        msg_tx: mpsc::UnboundedSender<WebMsg>,
    ) {
        while let Some(Ok(msg)) = web_rx.next().await {
            let txt = match msg {
                WebMsg::Text(t) => t.to_string(),
                _ => continue,
            };

            let parsed: Value = match serde_json::from_str(&txt) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let kind = parsed.get("type").and_then(|t| t.as_str());

            let action = if kind == Some("cmd") {
                let raw_cmd = match parsed.get("text").and_then(|t| t.as_str()) {
                    Some(c) => c,
                    None => continue,
                };
                match CmdParser::parse(raw_cmd) {
                    Some(a) => a,
                    None => {
                        Self::send_err(&msg_tx, "Unknown command.");
                        continue;
                    }
                }
            } else if kind.is_some() {
                parsed.clone()
            } else {
                continue;
            };

            let payload = json!({ "actor": user, "action": action });
            let eng_msg = EngineNode::encode(&payload);

            if eng_tx.send(eng_msg).await.is_err() {
                break;
            }
        }
    }

    async fn pipe_eng(mut eng_rx: EngineRx, msg_tx: mpsc::UnboundedSender<WebMsg>) {
        while let Some(Ok(msg)) = eng_rx.next().await {
            let txt = match msg {
                TungMsg::Text(t) => t.to_string(),
                _ => continue,
            };

            let web_msg = WebMsg::Text(txt.into());
            if msg_tx.send(web_msg).is_err() {
                break;
            }
        }
    }

    async fn pipe_bwd(
        mut web_tx: SplitSink<WebSocket, WebMsg>,
        mut msg_rx: mpsc::UnboundedReceiver<WebMsg>,
    ) {
        while let Some(msg) = msg_rx.recv().await {
            if web_tx.send(msg).await.is_err() {
                break;
            }
        }
    }

    fn send_err(tx: &mpsc::UnboundedSender<WebMsg>, text: &str) {
        let payload = json!({"events": [{"type": "error", "args": [text]}]});
        let raw = payload.to_string();
        let msg = WebMsg::Text(raw.into());
        let _ = tx.send(msg);
    }
}
