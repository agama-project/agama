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

use crate::service;
use agama_utils::api::users::{SystemInfo, UserInfo};

/// Abstract the users-related configuration from the underlying system.
pub trait ModelAdapter: Send + 'static {
    /// Reads the system info.
    fn read_system_info(&self) -> SystemInfo {
        SystemInfo {
            users: self.users_list().to_vec(),
        }
    }

    fn users_list(&self) -> &Vec<UserInfo>;

    /// Apply the changes to target system. It is expected to be called almost
    /// at the end of the installation.
    fn install(&self) -> Result<(), service::Error> {
        Ok(())
    }
}

/// [ModelAdapter] implementation for systemd-based systems.
pub struct Model {
    pub users: Vec<UserInfo>,
}

impl Default for Model {
    fn default() -> Self {
        Self { users: [].to_vec() }
    }
}

impl Model {
    /// Initializes the struct with the information from the underlying system.
    pub fn from_system() -> Result<Self, service::Error> {
        let mut model = Self::default();
        model.read()?;

        Ok(model)
    }

    fn read(&mut self) -> Result<(), service::Error> {
        // FIXME: just a mock up
        self.users = [UserInfo {
            name: String::from("root"),
        }]
        .to_vec();

        Ok(())
    }
}

impl ModelAdapter for Model {
    fn users_list(&self) -> &Vec<UserInfo> {
        &self.users
    }

    fn install(&self) -> Result<(), service::Error> {
        Ok(())
    }
}
