// Copyright (c) [2026] SUSE LLC
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
    api::s390::{Config, SystemInfo},
};

pub struct ProbeDASD;

impl Message for ProbeDASD {
    type Reply = ();
}

pub struct GetSystem;

impl Message for GetSystem {
    type Reply = SystemInfo;
}

pub struct GetConfig;

impl Message for GetConfig {
    type Reply = Config;
}

pub struct SetConfig {
    pub config: Option<Config>,
}

impl SetConfig {
    pub fn new(config: Option<Config>) -> Self {
        Self { config }
    }
}

impl Message for SetConfig {
    type Reply = ();
}
