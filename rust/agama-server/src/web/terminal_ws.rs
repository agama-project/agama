use axum::{extract::{ws::{Message, WebSocket}, WebSocketUpgrade}, response::IntoResponse};
use log::info;
use pty_process::{OwnedReadPty, OwnedWritePty};
use tokio::io::AsyncWriteExt;
use tokio_stream::StreamExt;

pub(crate) async fn handler(
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket))
}

fn start_shell() -> Result<(OwnedReadPty, OwnedWritePty), pty_process::Error> {
    let mut pty = pty_process::Pty::new()?;
    pty.resize(pty_process::Size::new(24, 80))?;
    let mut cmd = pty_process::Command::new("bash");
    let child = cmd.spawn(&pty.pts()?)?;
    let (pty_out, pty_in) = pty.into_split();
    Ok((pty_out, pty_in))
}

async fn handle_socket(mut socket: WebSocket) {
    info!("Terminal connected");

    // TODO: handle failed start of shell
    let (pty_out, mut pty_in) = start_shell().unwrap();
    let mut reader_stream = tokio_util::io::ReaderStream::new(pty_out);

    loop {
        tokio::select! {
            message = socket.recv() => {
                match message {
                    Some(Ok(Message::Text(s))) => {
                        println!("websocket text {:?}", s);
                        pty_in.write(s.as_bytes());
                        continue;
                    },
                    Some(Ok(Message::Close(_))) => {
                        println!("websocket close {:?}", message);
                        break;  
                    },
                    _ => {
                        println!("websocket other {:?}", message);
                        continue
                    },
                }
            },
            shell_output = reader_stream.next() => {
                if let Some(some_output) = shell_output {
                    match some_output {
                        Ok(output_bytes) => socket.send(Message::Binary(output_bytes.into())).await.unwrap(),
                        Err(e) => log::warn!("Shell error {}", e),
                    }
                    
                }
            }      
        }
    }

    info!("Terminal disconnected.");
}