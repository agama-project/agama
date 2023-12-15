use super::{Connection, DeviceType};
use uuid::Uuid;

#[derive(Debug, Default)]
pub struct ConnectionBuilder {
    id: String,
    interface: Option<String>,
    controller: Option<Uuid>,
    type_: Option<DeviceType>,
}

impl ConnectionBuilder {
    pub fn new(id: &str) -> Self {
        Self {
            id: id.to_string(),
            ..Default::default()
        }
    }

    pub fn with_interface(mut self, interface: &str) -> Self {
        self.interface = Some(interface.to_string());
        self
    }

    pub fn with_controller(mut self, controller: Uuid) -> Self {
        self.controller = Some(controller);
        self
    }

    pub fn with_type(mut self, type_: DeviceType) -> Self {
        self.type_ = Some(type_);
        self
    }

    pub fn build(self) -> Connection {
        let mut conn = Connection::new(self.id, self.type_.unwrap_or(DeviceType::Ethernet));

        if let Some(interface) = self.interface {
            conn.set_interface(&interface);
        }

        if let Some(controller) = self.controller {
            conn.set_controller(controller);
        }

        conn
    }
}
