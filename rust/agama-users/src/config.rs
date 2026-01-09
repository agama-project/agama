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

use agama_utils::api::{self, users::settings::UserSettings};

// For now it is just a copy of what is in agama_utils::users::Config
// Two reasons for separation:
// - impl part bellow which need not to be shared across rest of the Agama
// - one day it might be useful to separate implementation e.g. by changing to
// property: Option<holding a Type> in agama_utils vs property: Type here
#[derive(Clone, Debug, PartialEq)]
pub struct Config {
    pub settings: UserSettings,
}

impl Config {
    pub fn new() -> Self {
        Self {
            settings: {
                UserSettings {
                    first_user: None,
                    root: None,
                }
            },
        }
    }

    pub fn to_api(&self) -> Option<api::users::Config> {
        if self.settings.root.is_none() && self.settings.first_user.is_none() {
            return None;
        }

        Some(api::users::Config {
            users: self.settings.clone(),
        })
    }
}
