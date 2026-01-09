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
use agama_utils::api::users::UserSettings;
use std::time::Duration;

/// Abstract the users-related configuration from the underlying system.
pub trait ModelAdapter: Send + 'static {
    /// Apply the changes to target system. It is expected to be called almost
    /// at the end of the installation.
    fn install(&self) -> Result<(), service::Error> {
        Ok(())
    }
}

/// [ModelAdapter] implementation for systemd-based systems.
pub struct Model {
    pub users: UserSettings,
}

impl Model {
    /// Initializes the struct with the information from the underlying system.
    /// Currently we do not care about default users on live media so
    /// basically does nothing.
    pub fn from_system() -> Result<Self, service::Error> {
        let model = { Model { users: UserSettings { first_user: None, root: None }}};

        Ok(model)
    }
}

impl ModelAdapter for Model {
    fn install(&self) -> Result<(), service::Error> {
        Ok(())
    }
}
