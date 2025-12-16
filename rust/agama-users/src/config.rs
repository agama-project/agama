// Copyright (c) [2025] SUSE LLC
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
use agama_utils::api::{self, users::SystemInfo, users::user_info::UserInfo};
use itertools::Itertools;

#[derive(Clone, PartialEq)]
pub struct Config {
    pub users: Vec<UserInfo>,
}

impl Config {
    pub fn new_from(system: &SystemInfo) -> Self {
        Self {
            users: system.users.clone(),
        }
    }

    pub fn merge(&self, config: &api::users::Config) -> Result<Self, service::Error> {
        let mut merged = self.clone();

        // there is always at least one user defined in the system
        let users = [merged.users, config.users.clone()].concat();
        // deduplicate, we don't need e.g. two root users
        merged.users = users.into_iter().unique().collect();

        Ok(merged)
    }
}
