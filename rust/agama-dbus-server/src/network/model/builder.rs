use super::{Connection, DeviceType};

// TODO: improve the implementation to allow calling methods only where it makes sense
// depending on the type of the connection.

#[derive(Debug, Default)]
pub struct ConnectionBuilder {
    id: String,
    interface: Option<String>,
    controller: Option<String>,
    type_: Option<DeviceType>,
    ports: Vec<String>,
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

    pub fn with_controller(mut self, controller: &str) -> Self {
        self.controller = Some(controller.to_string());
        self
    }

    pub fn with_type(mut self, type_: DeviceType) -> Self {
        self.type_ = Some(type_);
        self
    }

    pub fn with_ports(mut self, ports: Vec<String>) -> Self {
        self.ports = ports;
        self
    }

    pub fn build(self) -> Connection {
        let mut conn = Connection::new(self.id, self.type_.unwrap_or(DeviceType::Ethernet));

        if let Some(interface) = self.interface {
            conn.set_interface(&interface);
        }

        if let Some(controller) = self.controller {
            conn.set_controller(&controller);
        }

        match &mut conn {
            Connection::Bond(bond) => {
                bond.set_ports(self.ports);
            }
            _ => {}
        }

        conn
    }
}
