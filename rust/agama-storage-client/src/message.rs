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

use std::sync::Arc;

use agama_utils::{
    actor::Message,
    api::{storage::Config, Issue},
    products::ProductSpec,
    BoxFuture,
};
use tokio::sync::RwLock;

use crate::service;

pub mod bootloader;
pub mod dasd;
pub mod iscsi;

pub struct CallAction {
    pub action: String,
}

impl CallAction {
    pub fn new(action: &str) -> Self {
        Self {
            action: action.to_string(),
        }
    }
}

impl Message for CallAction {
    type Reply = ();
}

pub struct SetStorageConfig {
    pub product: Arc<RwLock<ProductSpec>>,
    pub config: Option<Config>,
}

impl SetStorageConfig {
    pub fn new(product: Arc<RwLock<ProductSpec>>, config: Option<Config>) -> Self {
        Self { product, config }
    }
}

impl Message for SetStorageConfig {
    type Reply = BoxFuture<Result<(), service::Error>>;
}

pub struct GetStorageConfig;

impl Message for GetStorageConfig {
    type Reply = Option<Config>;
}

pub struct GetSystem;

impl Message for GetSystem {
    type Reply = Option<serde_json::Value>;
}

pub struct GetProposal;

impl Message for GetProposal {
    type Reply = Option<serde_json::Value>;
}

pub struct GetIssues;

impl Message for GetIssues {
    type Reply = Vec<Issue>;
}

pub struct GetConfigFromModel {
    pub model: serde_json::Value,
}

impl GetConfigFromModel {
    pub fn new(model: serde_json::Value) -> Self {
        Self { model }
    }
}

impl Message for GetConfigFromModel {
    type Reply = Option<Config>;
}

pub struct GetConfigModel;

impl Message for GetConfigModel {
    type Reply = Option<serde_json::Value>;
}

pub struct SolveConfigModel {
    pub model: serde_json::Value,
}

impl SolveConfigModel {
    pub fn new(model: serde_json::Value) -> Self {
        Self { model }
    }
}

impl Message for SolveConfigModel {
    type Reply = Option<serde_json::Value>;
}

pub struct SetLocale {
    pub locale: String,
}

impl SetLocale {
    pub fn new(locale: String) -> Self {
        Self { locale }
    }
}

impl Message for SetLocale {
    type Reply = ();
}
