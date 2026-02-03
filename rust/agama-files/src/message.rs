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

use agama_utils::{
    actor::Message,
    api::files::{scripts::ScriptsGroup, Config},
};

#[derive(Clone)]
pub struct SetConfig {
    pub config: Option<Config>,
}

impl Message for SetConfig {
    type Reply = ();
}

impl SetConfig {
    pub fn new(config: Option<Config>) -> Self {
        Self { config }
    }

    pub fn with(config: Config) -> Self {
        Self {
            config: Some(config),
        }
    }
}

#[derive(Clone)]
pub struct RunScripts {
    pub group: ScriptsGroup,
}

impl RunScripts {
    pub fn new(group: ScriptsGroup) -> Self {
        RunScripts { group }
    }
}

impl Message for RunScripts {
    type Reply = bool;
}

#[derive(Clone)]
pub struct WriteFiles;

impl Message for WriteFiles {
    type Reply = ();
}
