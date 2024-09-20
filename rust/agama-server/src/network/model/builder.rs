// Copyright (c) [2024] SUSE LLC
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
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

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
            conn.controller = Some(controller)
        }

        conn
    }
}
