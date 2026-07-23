use reqwest::Client;
use serde_json::{Value, json};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ClientError {
    #[error("Network failure: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Engine error: {0}")]
    Engine(String),
}

#[derive(Clone)]
pub struct EngineClient {
    http: Client,
    url: String,
}

impl EngineClient {
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            http: Client::new(),
            url: url.into(),
        }
    }

    pub async fn step(&self, actor: &str, action: Value) -> Result<Vec<Value>, ClientError> {
        let payload = json!({
            "actor": actor,
            "action": action
        });

        let response = self.http.post(&self.url).json(&payload).send().await?;
        let body: Value = response.json().await?;

        if let Some(err_msg) = body.get("error").and_then(|element| element.as_str()) {
            return Err(ClientError::Engine(err_msg.to_string()));
        }

        let events = body
            .get("events")
            .and_then(|element| element.as_array())
            .cloned()
            .unwrap_or_default();

        Ok(events)
    }

    pub async fn check_player_exists(&self, actor: &str) -> Result<bool, ClientError> {
        let events = self.step(actor, json!({"type": "player_exists"})).await?;
        for ev in events {
            if let Some(obj) = ev.as_object() {
                if obj.get("functor").and_then(|f| f.as_str()) == Some("player_status") {
                    if let Some(args) = obj.get("args").and_then(|a| a.as_array()) {
                        if args.len() >= 2 {
                            let status = args[1]
                                .get("args")
                                .and_then(|a| a.as_array())
                                .and_then(|a| a.first())
                                .and_then(|s| s.as_str());
                            return Ok(status == Some("exists"));
                        }
                    }
                }
            }
        }
        Ok(false)
    }
}
