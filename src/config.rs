#[derive(Clone, Debug)]
pub struct Config {
    pub engine_url: String,
    pub endpoint_url: String,
    pub tick_interval_ms: u64,
}

impl Config {
    const FALLBACK_URL: &str = "http://127.0.0.1:8080/step";
    const FALLBACK_LISTEN: &str = "0.0.0.0:4000";

    pub fn from_env() -> Self {
        let resolve = |name: &str, default: &str| -> String {
            let value = std::env::var(name);
            let url = value.unwrap_or_else(|_| default.to_string());
            url
        };

        let engine_url = resolve("PROLOG_URL", Self::FALLBACK_URL);
        let endpoint_url = resolve("LISTEN_ADDRESS", Self::FALLBACK_LISTEN);

        Self {
            engine_url,
            endpoint_url,
            tick_interval_ms: 2000,
        }
    }
}
