use std::process::{Child, Command};
use std::time::Duration;
use uuid::Uuid;

/// D-Bus server to be used on tests.
///
/// Takes care of starting and stopping a dbus-daemon to be used on integration tests. Each server
/// uses a different socket, so they do not collide.
///
/// FIXME: this struct implements the typestate pattern. As it is not possible to implement Drop
/// for an specialized type, you need to manually call 'stop' at the end of the test. We will work
/// on that in the future.
pub struct DBusServer<S: ServerState> {
    address: String,
    extra: S,
}

pub struct Started {
    connection: zbus::Connection,
    child: Child,
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

    pub async fn start(self) -> DBusServer<Started> {
        let child = Command::new("/usr/bin/dbus-daemon")
            .args([
                "--config-file",
                "../share/dbus-test.conf",
                "--address",
                &self.address,
            ])
            .spawn()
            .expect("to start the testing D-Bus daemon");
        self.wait();
        let connection = agama_lib::connection_to(&self.address).await.unwrap();

        DBusServer {
            address: self.address,
            extra: Started { child, connection },
        }
    }

    /// Waits until the D-Bus daemon is ready.
    // TODO: implement proper waiting instead of just using a sleep
    fn wait(&self) {
        const WAIT_TIME: Duration = Duration::from_millis(500);
        std::thread::sleep(WAIT_TIME);
    }
}

impl DBusServer<Started> {
    pub fn connection(&self) -> zbus::Connection {
        self.extra.connection.clone()
    }

    pub fn stop(mut self) -> DBusServer<Stopped> {
        self.extra.child.kill().unwrap();
        DBusServer {
            address: self.address,
            extra: Stopped {},
        }
    }

    pub async fn request_name(&self) {
        let connection = self.connection();
        connection
            .request_name("org.opensuse.Agama1")
            .await
            .expect("Request the D-Bus service name");
    }
}
