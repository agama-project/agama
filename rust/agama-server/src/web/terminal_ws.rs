use std::borrow::Cow;
use axum::{extract::{ws::{close_code, CloseFrame, Message, WebSocket}, WebSocketUpgrade}, response::IntoResponse};
use pty_process::{OwnedReadPty, OwnedWritePty};
use tokio::io::AsyncWriteExt;
use tokio_stream::StreamExt;

pub(crate) async fn handler(
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket))
}

fn start_shell() -> Result<(OwnedReadPty, OwnedWritePty, tokio::process::Child), pty_process::Error> {
    let pty = pty_process::Pty::new()?;
    pty.resize(pty_process::Size::new(24, 80))?;
    let mut cmd = pty_process::Command::new("bash");
    // TODO: check if children exit
    let child = cmd.spawn(&pty.pts()?)?;
    let (pty_out, pty_in) = pty.into_split();
    Ok((pty_out, pty_in, child))
}

async fn handle_socket(mut socket: WebSocket) {
    log::info!("Terminal connected");

    // TODO: handle failed start of shell
    let (pty_out, mut pty_in, mut child) = start_shell().unwrap();
    let mut reader_stream = tokio_util::io::ReaderStream::new(pty_out);

    loop {
        tokio::select! {
            message = socket.recv() => {
                match message {
                    Some(Ok(Message::Text(s))) => {
                        let res = pty_in.write_all(s.as_bytes()).await;
                        if res.is_err() {
                            log::warn!("Failed to write to pty: {:?}", res);
                        }

                        continue;
                    },
                    Some(Ok(Message::Close(_))) => {
                        log::info!("websocket close {:?}", message);
                        break;  
                    },
                    None => {
                        log::info!("Socket closed");
                        break;
                    }
                    _ => {
                        log::info!("websocket other {:?}", message);
                        continue
                    },
                }
            },
            shell_output = reader_stream.next() => {
                println!("shell output {:?}", shell_output);
                if let Some(some_output) = shell_output {
                    match some_output {
                        Ok(output_bytes) => socket.send(Message::Binary(output_bytes.into())).await.unwrap(),
                        Err(e) => log::warn!("Shell error {}", e),
                    }
                    
                }
            },
            status = child.wait() => {
                match status {
                    Err(err) => log::warn!("Child status error: {}", err),
                    Ok(status) => {
                        let code = status.code().unwrap_or(0);
                        let msg = format!("Bash exited with code: {code}");
                        let res = socket.send(Message::Close(Some(CloseFrame {
                            code: close_code::NORMAL,
                            reason: Cow::from(msg),
                        }))).await;
                        if res.is_err() {
                            log::warn!("Failed to send close message: {:?}", res);
                        }
                        break;
                    }
                }
            }      
        }
    }

    log::info!("Terminal disconnected.");
}