use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};

pub type MessageTx = mpsc::UnboundedSender<String>;

#[derive(Clone, Default)]
pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<String, MessageTx>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn register(&self, actor: &str, tx: MessageTx) {
        let mut map = self.sessions.lock().await;
        map.insert(actor.to_string(), tx);
    }

    pub async fn unregister(&self, actor: &str) {
        let mut map = self.sessions.lock().await;
        map.remove(actor);
    }

    pub async fn send_to(&self, actor: &str, message: &str) {
        let map = self.sessions.lock().await;
        if let Some(tx) = map.get(actor) {
            let _ = tx.send(message.to_string());
        }
    }

    pub async fn broadcast(&self, message: &str) {
        let map = self.sessions.lock().await;
        for tx in map.values() {
            let _ = tx.send(message.to_string());
        }
    }

    pub async fn broadcast_combat(&self, attacker: &str, target: &str, message: &str) {
        self.send_to(attacker, message).await;
        self.send_to(target, message).await;
    }
}
