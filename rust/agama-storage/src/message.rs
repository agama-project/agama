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

use crate::config::Config;
use agama_utils::actor::Message;
use serde_json::value::RawValue;

#[derive(Clone)]
pub struct Activate;

impl Message for Activate {
    type Reply = ();
}

#[derive(Clone)]
pub struct Probe;

impl Message for Probe {
    type Reply = ();
}

#[derive(Clone)]
pub struct Install;

impl Message for Install {
    type Reply = ();
}

#[derive(Clone)]
pub struct Finish;

impl Message for Finish {
    type Reply = ();
}

#[derive(Clone)]
pub struct GetSystem;

impl Message for GetSystem {
    type Reply = Option<Box<RawValue>>;
}

#[derive(Clone)]
pub struct GetConfig;

impl Message for GetConfig {
    type Reply = Option<Config>;
}

#[derive(Clone)]
pub struct GetConfigModel;

impl Message for GetConfigModel {
    type Reply = Option<Box<RawValue>>;
}

#[derive(Clone)]
pub struct GetProposal;

impl Message for GetProposal {
    type Reply = Option<Box<RawValue>>;
}

#[derive(Clone)]
pub struct SetProduct {
    pub id: String,
}

impl SetProduct {
    pub fn new(id: &str) -> Self {
        Self { id: id.to_string() }
    }
}

impl Message for SetProduct {
    type Reply = ();
}

#[derive(Clone)]
pub struct SetConfig {
    pub config: Option<Config>,
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

impl Message for SetConfig {
    type Reply = ();
}

#[derive(Clone)]
pub struct SetConfigModel {
    pub model: Box<RawValue>,
}

impl SetConfigModel {
    pub fn new(model: Box<RawValue>) -> Self {
        Self { model }
    }
}

impl Message for SetConfigModel {
    type Reply = ();
}

#[derive(Clone)]
pub struct SolveConfigModel {
    pub model: Box<RawValue>,
}

impl SolveConfigModel {
    pub fn new(model: Box<RawValue>) -> Self {
        Self { model }
    }
}

impl Message for SolveConfigModel {
    type Reply = Option<Box<RawValue>>;
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
