use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub engine: String,
    pub bind: String,
}

pub struct EnvLoader;

impl EnvLoader {
    const DEF_ENGINE: &'static str = "http://127.0.0.1:8080";
    const DEF_BIND: &'static str = "0.0.0.0:4000";

    pub fn load() -> AppConfig {
        AppConfig {
            engine: Self::read("PROLOG_URL", Self::DEF_ENGINE),
            bind: Self::read("LISTEN_ADDRESS", Self::DEF_BIND),
        }
    }

    fn read(key: &str, def: &str) -> String {
        env::var(key).unwrap_or_else(|_| def.to_string())
    }
}
