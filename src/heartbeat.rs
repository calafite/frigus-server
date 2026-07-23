use crate::client::EngineClient;
use crate::config::Config;
use serde_json::json;
use tokio::time::{Duration, sleep};

pub struct Heartbeat {
    config: Config,
    client: EngineClient,
}

impl Heartbeat {
    pub fn new(config: Config, client: EngineClient) -> Self {
        Self { config, client }
    }

    pub async fn run(&self) {
        let mut tick_counter: u64 = 0;
        let interval = Duration::from_millis(self.config.tick_interval_ms);

        loop {
            sleep(interval).await;
            tick_counter += 1;

            let system_tick = json!({"type": "tick"});
            let _ = self.client.step("system", system_tick).await;

            if tick_counter % 2 == 0 {
                let ai_tick = json!({"type": "ai_tick"});
                let _ = self.client.step("system", ai_tick).await;
            }
        }
    }
}
