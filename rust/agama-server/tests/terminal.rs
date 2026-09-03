// Copyright (c) [2026] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

//! Integration tests for the terminal WebSocket.
//!
//! Unlike `tests/service.rs`, these tests need a real, bound TCP server: the
//! WebSocket upgrade handshake cannot be exercised through `oneshot()`.

use agama_lib::auth::AuthToken;
use agama_server::terminal::terminal_service;
use agama_server::web::{MainServiceBuilder, ServiceConfig};
use futures_util::{SinkExt, StreamExt};
use std::{error::Error, path::PathBuf, time::Duration};
use tokio::{net::TcpListener, sync::broadcast::channel, time::timeout};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, http::Uri, ClientRequestBuilder, Message},
    MaybeTlsStream, WebSocketStream,
};

const JWT_SECRET: &str = "terminal-test-secret";
const READ_TIMEOUT: Duration = Duration::from_secs(15);

type TerminalSocket = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

fn public_dir() -> PathBuf {
    std::env::current_dir().unwrap().join("public")
}

/// Starts the web service (with the terminal route mounted) on a random,
/// local port and returns the base "ws://..." URL for the terminal endpoint.
async fn start_server() -> String {
    let config = ServiceConfig {
        jwt_secret: JWT_SECRET.to_string(),
    };
    let (events_tx, _) = channel(16);
    let router = MainServiceBuilder::new(events_tx, public_dir())
        .add_service("/terminal", terminal_service())
        .with_config(config)
        .build();
    // `axum::serve` needs a plain `axum::Router` rather than `aide`'s wrapper.
    let router: axum::Router = router.into();

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });

    format!("ws://{addr}/api/terminal/ws")
}

/// Connects to the terminal WebSocket, authenticating with the given token
/// (a bearer token, when given).
async fn connect(url: &str, token: Option<&str>) -> Result<TerminalSocket, Box<dyn Error>> {
    let uri: Uri = url.parse()?;
    let mut builder = ClientRequestBuilder::new(uri);
    if let Some(token) = token {
        builder = builder.with_header("Authorization", format!("Bearer {token}"));
    }
    let request = builder.into_client_request()?;
    let (socket, _response) = connect_async(request).await?;
    Ok(socket)
}

/// Sends a resize control message.
async fn send_resize(socket: &mut TerminalSocket, cols: u16, rows: u16) {
    let json = format!(r#"{{"cols":{cols},"rows":{rows}}}"#);
    socket.send(Message::Text(json.into())).await.unwrap();
}

/// Returns the part of `output` that comes strictly after the pty's echo of
/// `line` (or an empty string, when that echo has not been received yet).
///
/// The pty echoes back whatever is typed, so the raw command text always
/// shows up in the output stream before the command's actual output does.
/// Searching the whole accumulated output for an expected result would risk
/// matching that echo instead of the real thing (e.g., a command that prints
/// part of itself). Cutting off everything up to and including the echo
/// avoids that, regardless of what the command or its output look like.
///
/// Some interactive shell configurations redraw the command line a second
/// time (with the prompt prepended) right after it is submitted, before
/// printing the real output. To stay correct in that case too, this looks
/// for the *last* occurrence of `line`, skipping past every redraw.
///
/// `output` is expected to already have ANSI escape sequences removed (see
/// [`strip_ansi_escapes`]), since an interactive shell's prompt may otherwise
/// interleave them with the echoed characters (e.g., to color a `$` sign),
/// breaking a plain, literal search for `line`.
fn output_after_echo<'a>(output: &'a str, line: &str) -> &'a str {
    match output.rfind(line) {
        Some(position) => &output[position + line.len()..],
        None => "",
    }
}

/// Removes ANSI/VT100 escape sequences from `text`.
///
/// Interactive shells use these to color the prompt, set the terminal title,
/// save/restore the cursor position, and so on. None of that is relevant
/// when a test wants to look for plain text in what the terminal received,
/// and, depending on the shell configuration, such sequences can otherwise
/// end up interleaved with the very text being searched for.
fn strip_ansi_escapes(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();

    while let Some(c) = chars.next() {
        if c != '\u{1b}' {
            result.push(c);
            continue;
        }

        match chars.peek() {
            // OSC sequences (e.g., setting the window title): ESC ] ... BEL
            Some(']') => {
                chars.next();
                for c in chars.by_ref() {
                    if c == '\u{7}' {
                        break;
                    }
                }
            }
            // CSI sequences (e.g., colors, cursor movement):
            // ESC [ ... <final byte, a letter or `~`>
            Some('[') => {
                chars.next();
                for c in chars.by_ref() {
                    if c.is_ascii_alphabetic() || c == '~' {
                        break;
                    }
                }
            }
            // Other two-character escapes (e.g., ESC 7 / ESC 8 to save and
            // restore the cursor position).
            Some(_) => {
                chars.next();
            }
            None => {}
        }
    }

    result
}

/// Types `line` as a command (as if the user had typed it, followed by
/// Enter), then waits for the shell's real output (i.e., everything after
/// the pty's echo of `line` itself) to contain `needle`.
///
/// Returns everything read after the echo, once `needle` is found. Panics if
/// the read timeout expires first.
async fn run_command(socket: &mut TerminalSocket, line: &str, needle: &str) -> String {
    let mut data = line.as_bytes().to_vec();
    data.push(b'\n');
    socket.send(Message::Binary(data.into())).await.unwrap();

    let mut raw_output = String::new();
    let mut output = String::new();

    let result = timeout(READ_TIMEOUT, async {
        loop {
            match socket.next().await {
                Some(Ok(Message::Binary(bytes))) => {
                    raw_output.push_str(&String::from_utf8_lossy(&bytes));
                    output = strip_ansi_escapes(&raw_output);
                    if output_after_echo(&output, line).contains(needle) {
                        return;
                    }
                }
                Some(Ok(_)) => continue,
                Some(Err(error)) => panic!("websocket error while waiting for output: {error}"),
                None => panic!("the connection closed before seeing {needle:?}"),
            }
        }
    })
    .await;

    if result.is_err() {
        panic!(
            "timed out waiting for {needle:?} in the output of {line:?}; got so far: {output:?}"
        );
    }

    output_after_echo(&output, line).to_string()
}

/// Returns a valid auth token to use in the tests.
fn auth_token() -> String {
    AuthToken::generate(JWT_SECRET).unwrap().to_string()
}

#[tokio::test]
async fn test_run_command() {
    let url = start_server().await;
    let mut socket = connect(&url, Some(&auth_token())).await.unwrap();

    run_command(
        &mut socket,
        "echo agama-terminal-marker",
        "agama-terminal-marker",
    )
    .await;
}

#[tokio::test]
async fn test_create_file() {
    let url = start_server().await;
    let mut socket = connect(&url, Some(&auth_token())).await.unwrap();

    let path = std::env::temp_dir().join(format!("agama-terminal-test-{}", std::process::id()));
    let path_str = path.display().to_string();
    // Make sure a previous, failed run does not leave the file behind.
    let _ = std::fs::remove_file(&path);

    run_command(
        &mut socket,
        &format!("touch {path_str} && echo agama-file-created"),
        "agama-file-created",
    )
    .await;

    assert!(path.exists(), "the terminal did not create {path_str}");
    let _ = std::fs::remove_file(&path);
}

#[tokio::test]
async fn test_resize() {
    let url = start_server().await;
    let mut socket = connect(&url, Some(&auth_token())).await.unwrap();

    // `stty size` reports the pty's actual window size ("rows cols"),
    // independently of whether the shell has refreshed its own $COLUMNS.
    send_resize(&mut socket, 132, 43).await;
    let output = run_command(&mut socket, "stty size", "43 132").await;
    assert!(output.contains("43 132"));
}

#[tokio::test]
async fn test_connect_without_token_is_rejected() {
    let url = start_server().await;
    let result = connect(&url, None).await;
    assert!(result.is_err(), "connecting without a token should fail");
}

#[tokio::test]
async fn test_connect_with_wrong_token_is_rejected() {
    let url = start_server().await;
    let wrong_token = AuthToken::generate("a-different-secret").unwrap().to_string();
    let result = connect(&url, Some(&wrong_token)).await;
    assert!(result.is_err(), "connecting with a wrong token should fail");
}

#[tokio::test]
async fn test_shell_is_killed_when_the_socket_closes() {
    let url = start_server().await;
    let mut socket = connect(&url, Some(&auth_token())).await.unwrap();

    // The trailing "-end" marker (after the pid digits) is what `run_command`
    // waits for: waiting for the "agama-terminal-pid-" prefix alone would be
    // racy, since it appears before the (unpredictable, variable-length) pid
    // digits have necessarily all arrived.
    let output = run_command(&mut socket, "echo agama-terminal-pid-$$-end", "-end").await;

    let pid: u32 = output
        .lines()
        .find_map(|line| line.trim().strip_prefix("agama-terminal-pid-"))
        .map(|rest| rest.trim_end_matches("-end"))
        .expect("the shell did not report its pid")
        .trim()
        .parse()
        .expect("the reported pid is not a number");

    socket.close(None).await.unwrap();

    // Give the server a moment to notice the closed socket and reap the
    // child; then make sure the process is really gone.
    let proc_path = format!("/proc/{pid}");
    let gone = timeout(Duration::from_secs(5), async {
        while std::path::Path::new(&proc_path).exists() {
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    })
    .await;

    assert!(
        gone.is_ok(),
        "the shell (pid {pid}) was still running after closing the terminal"
    );
}
