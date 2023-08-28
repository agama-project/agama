use agama_lib::{connection_to, error::ServiceError};
use async_std::stream::StreamExt;
use std::process::{Child, Command};
use uuid::Uuid;
use zbus::{MatchRule, MessageStream, MessageType};

/// D-Bus server to be used on tests.
///
/// This struct takes care of starting, stopping and monitoring dbus-daemon to be used on
/// integration tests. Each server uses a different socket, so they do not collide.
pub struct DBusServer {
    child: Option<Child>,
    messages: Option<MessageStream>,
    pub address: String,
}

impl DBusServer {
    /// Builds and starts a server.
    pub async fn start_server() -> Result<Self, ServiceError> {
        let mut server = Self::new();
        server.start().await?;
        println!("Starting the server at {}", &server.address);
        Ok(server)
    }

    /// Builds a new server.
    ///
    /// To start the server, check the `start` function.
    pub fn new() -> Self {
        let uuid = Uuid::new_v4();
        Self {
            address: format!("unix:path=/tmp/agama-tests-{uuid}"),
            child: None,
            messages: None,
        }
    }

    /// Starts the server.
    pub async fn start(&mut self) -> Result<(), ServiceError> {
        let child = Command::new("/usr/bin/dbus-daemon")
            .args([
                "--config-file",
                "../share/dbus-test.conf",
                "--address",
                &self.address,
            ])
            .spawn()
            .expect("to start the testing D-Bus daemon");
        self.child = Some(child);
        self.wait();
        self.messages = Some(self.build_message_stream().await?);
        Ok(())
    }

    /// Stops the server.
    pub fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            child.kill().unwrap();
        }
        self.messages = None;
    }

    /// Waits for a server to be available.
    ///
    /// * `name`: service name (e.g., "org.opensuse.Agama.Network1").
    pub async fn wait_for_service(&mut self, name: &str) {
        let Some(ref mut messages) = self.messages else {
            return;
        };

        loop {
            let signal = messages.next().await.unwrap().unwrap();
            let (sname, _, _): (String, String, String) = signal.body().unwrap();
            if &sname == name {
                return;
            }
        }
    }

    /// Waits until the D-Bus daemon is ready.
    // TODO: implement proper waiting instead of just using a sleep
    fn wait(&self) {
        let wait_time = std::time::Duration::from_millis(500);
        std::thread::sleep(wait_time);
    }

    /// Builds a message stream.
    async fn build_message_stream(&self) -> Result<MessageStream, ServiceError> {
        let conn = connection_to(&self.address).await?;
        let rule = MatchRule::builder()
            .msg_type(MessageType::Signal)
            .sender("org.freedesktop.DBus")?
            .member("NameOwnerChanged")?
            .build();
        Ok(MessageStream::for_match_rule(rule, &conn, None).await?)
    }
}

impl Drop for DBusServer {
    fn drop(&mut self) {
        self.stop();
    }
}
