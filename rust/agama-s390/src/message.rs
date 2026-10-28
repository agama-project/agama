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

use crate::service::Error;
use agama_utils::{
    actor::Message,
    api::{
        s390::{Config, SystemInfo},
        RawConfig,
    },
    BoxFuture,
};

pub struct ProbeDASD;

impl Message for ProbeDASD {
    type Reply = ();
}

pub struct ProbeZFCP;

impl Message for ProbeZFCP {
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

pub struct SetZFCPConfig {
    pub config: Option<RawConfig>,
}

impl SetZFCPConfig {
    pub fn new(config: Option<RawConfig>) -> Self {
        Self { config }
    }
}

impl Message for SetZFCPConfig {
    type Reply = BoxFuture<Result<(), Error>>;
}

pub struct SetDASDConfig {
    pub config: Option<RawConfig>,
}

impl SetDASDConfig {
    pub fn new(config: Option<RawConfig>) -> Self {
        Self { config }
    }
}

impl Message for SetDASDConfig {
    type Reply = BoxFuture<Result<(), Error>>;
}

#[derive(Clone)]
pub struct SetLocale {
    pub locale: String,
}

impl SetLocale {
    pub fn new(locale: &str) -> Self {
        Self {
            locale: locale.to_string(),
        }
    }
}

impl Message for SetLocale {
    type Reply = ();
}
