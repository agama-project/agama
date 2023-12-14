use agama_lib::error::ServiceError;
use std::{
    error::Error,
    future::Future,
    process::{Child, Command},
    time::Duration,
};

use tokio_stream::StreamExt;
use uuid::Uuid;
use zbus::{MatchRule, MessageStream, MessageType};

const DBUS_SERVICE: &str = "org.opensuse.Agama1";

/// D-Bus server to be used on tests.
///
/// Takes care of starting and stopping a dbus-daemon to be used on integration tests. Each server
/// uses a different socket, so they do not collide.
///
/// NOTE: this struct implements the [typestate pattern](http://cliffle.com/blog/rust-typestate/).
pub struct DBusServer<S: ServerState> {
    address: String,
    extra: S,
}

pub struct Started {
    connection: zbus::Connection,
    child: Child,
}

impl Drop for Started {
    fn drop(&mut self) {
        self.child.kill().unwrap();
    }
}

pub struct Stopped;

pub trait ServerState {}
impl ServerState for Started {}
impl ServerState for Stopped {}

impl DBusServer<Stopped> {
    pub fn new() -> Self {
        let uuid = Uuid::new_v4();
        DBusServer {
            address: format!("unix:path=/tmp/agama-tests-{uuid}"),
            extra: Stopped,
        }
    }

    pub async fn start(self) -> Result<DBusServer<Started>, ServiceError> {
        let child = Command::new("/usr/bin/dbus-daemon")
            .args([
                "--config-file",
                "../share/dbus-test.conf",
                "--address",
                &self.address,
            ])
            .spawn()
            .expect("to start the testing D-Bus daemon");

        let connection = async_retry(|| agama_lib::connection_to(&self.address)).await?;

        Ok(DBusServer {
            address: self.address,
            extra: Started { child, connection },
        })
    }
}

impl DBusServer<Started> {
    pub fn connection(&self) -> zbus::Connection {
        self.extra.connection.clone()
    }

    pub async fn request_name(&mut self) -> Result<(), Box<dyn Error>> {
        let connection = self.connection();

        let mut stream = NameOwnerChangedStream::for_connection(&connection).await?;
        let cloned = connection.clone();
        tokio::spawn(async move {
            cloned
                .request_name(DBUS_SERVICE)
                .await
                .expect("Request the D-Bus service name");
        });

        stream.wait_for("org.opensuse.Agama1").await;
        Ok(())
    }
}

// FIXME: check whether zbus has an API for this use case.
struct NameOwnerChangedStream(MessageStream);

impl NameOwnerChangedStream {
    pub async fn for_connection(connection: &zbus::Connection) -> Result<Self, Box<dyn Error>> {
        let rule = MatchRule::builder()
            .msg_type(MessageType::Signal)
            .sender("org.freedesktop.DBus")?
            .member("NameOwnerChanged")?
            .build();
        let stream = MessageStream::for_match_rule(rule, connection, None).await?;
        Ok(Self(stream))
    }

    pub async fn wait_for(&mut self, name: &str) {
        loop {
            let signal = self.0.next().await.unwrap().unwrap();
            let (sname, _, _): (String, String, String) = signal.body().unwrap();
            if &sname == name {
                return;
            }
        }
    }
}

/// Run and retry an async function.
///
/// Beware that, if the function is failing for a legit reason, you will
/// introduce a delay in your code.
///
/// * `func`: async function to run.
pub async fn async_retry<O, F, T, E>(func: F) -> Result<T, E>
where
    F: Fn() -> O,
    O: Future<Output = Result<T, E>>,
{
    const RETRIES: u8 = 10;
    const INTERVAL: u64 = 500;
    let mut retry = 0;
    loop {
        match func().await {
            Ok(result) => return Ok(result),
            Err(error) => {
                if retry > RETRIES {
                    return Err(error);
                }
                retry += 1;
                let wait_time = Duration::from_millis(INTERVAL);
                tokio::time::sleep(wait_time).await;
            }
        }
    }
}
