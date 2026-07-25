use futures::StreamExt;
use futures::stream::{SplitSink, SplitStream};
use serde_json::Value;
use tokio::net::TcpStream;
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async, tungstenite::protocol::Message as WsMsg,
};

pub type EngineSock = WebSocketStream<MaybeTlsStream<TcpStream>>;
pub type EngineTx = SplitSink<EngineSock, WsMsg>;
pub type EngineRx = SplitStream<EngineSock>;

pub struct EngineNode;

impl EngineNode {
    pub async fn dial(base: &str) -> Result<(EngineTx, EngineRx), String> {
        let url = Self::fmt_url(base);
        let attempt = connect_async(&url).await;

        let (sock, _resp) = attempt.map_err(|err| err.to_string())?;
        Ok(sock.split())
    }

    pub fn encode(val: &Value) -> WsMsg {
        let raw = val.to_string();
        WsMsg::Text(raw.into())
    }

    fn fmt_url(base: &str) -> String {
        let ws_http = base.replace("http://", "ws://");
        let ws_base = ws_http.replace("https://", "wss://");

        let ends_ws = ws_base.ends_with("/ws");

        if ends_ws { ws_base.clone() } else { format!("{}/ws", ws_base) }
    }
}
