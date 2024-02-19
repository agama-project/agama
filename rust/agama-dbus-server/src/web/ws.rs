//! Implements the websocket handling.

use super::service::ServiceState;
use agama_lib::progress::{Progress, ProgressMonitor, ProgressPresenter};
use async_trait::async_trait;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
};

pub async fn ws_handler(
    State(state): State<ServiceState>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state.dbus_connection))
}

async fn handle_socket(socket: WebSocket, connection: zbus::Connection) {
    let presenter = WebSocketProgressPresenter::new(socket);
    let mut monitor = ProgressMonitor::new(connection).await.unwrap();
    _ = monitor.run(presenter).await;
}

/// Experimental ProgressPresenter to emit progress events over a WebSocket.
struct WebSocketProgressPresenter(WebSocket);

impl WebSocketProgressPresenter {
    pub fn new(socket: WebSocket) -> Self {
        Self(socket)
    }

    pub async fn report_progress(&mut self, progress: &Progress) {
        let payload = serde_json::to_string(&progress).unwrap();
        _ = self.0.send(Message::Text(payload)).await;
    }
}

#[async_trait]
impl ProgressPresenter for WebSocketProgressPresenter {
    async fn start(&mut self, progress: &Progress) {
        self.report_progress(progress).await;
    }

    async fn update_main(&mut self, progress: &Progress) {
        self.report_progress(progress).await;
    }

    async fn update_detail(&mut self, progress: &Progress) {
        self.report_progress(progress).await;
    }

    async fn finish(&mut self) {}
}
