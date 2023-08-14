use std::process::{Child, Command};
use uuid::Uuid;

pub struct DBusServer {
    child: Option<Child>,
    pub address: String,
}

impl DBusServer {
    pub fn start_server() -> Self {
        let mut server = Self::new();
        server.start();
        println!("Starting the server at {}", &server.address);
        server
    }

    pub fn new() -> Self {
        let uuid = Uuid::new_v4();
        Self {
            address: format!("unix:path=/tmp/agama-tests-{uuid}"),
            child: None,
        }
    }

    pub fn start(&mut self) {
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
    }

    pub fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            child.kill().unwrap();
        }
    }
}

impl Drop for DBusServer {
    fn drop(&mut self) {
        self.stop();
    }
}
