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

use crate::service;
use agama_utils::{
    api::{storage::Config, Issue},
    define_message,
    products::ProductSpec,
    BoxFuture,
};
use std::sync::Arc;
use tokio::sync::RwLock;
pub mod bootloader;
pub mod dasd;
pub mod iscsi;
pub mod zfcp;

define_message!(CallAction { action: String } -> ());

define_message!(SetStorageConfig { product: Arc<RwLock<ProductSpec>>, config: Option<Config> } -> BoxFuture<Result<(), service::Error>>);
define_message!(GetStorageConfig -> Option<Config>);
define_message!(GetSystem -> Option<serde_json::Value>);
define_message!(GetProposal -> Option<serde_json::Value>);
define_message!(GetIssues -> Vec<Issue>);
define_message!(GetConfigFromModel { model: serde_json::Value } -> Option<Config>);
define_message!(GetConfigModel -> Option<serde_json::Value>);
define_message!(SolveConfigModel { model: serde_json::Value } -> Option<serde_json::Value>);
define_message!(SetLocale { locale: String } -> ());
