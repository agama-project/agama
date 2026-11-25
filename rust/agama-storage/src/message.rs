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

use crate::client;
use agama_utils::{
    actor::Message,
    api::{storage::Config, Issue},
    define_message,
    products::ProductSpec,
    BoxFuture,
};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::RwLock;

define_message!(Activate -> ());
define_message!(Probe -> ());
define_message!(Install -> ());
define_message!(Finish -> ());
define_message!(Umount -> ());
define_message!(GetSystem -> Option<Value>);
define_message!(GetConfig -> Option<Config>);
define_message!(GetConfigFromModel { model: Value } -> Option<Config>);
define_message!(GetConfigModel -> Option<Value>);
define_message!(GetProposal -> Option<Value>);
define_message!(GetIssues -> Vec<Issue>);

#[derive(Clone)]
pub struct SetConfig {
    pub product: Arc<RwLock<ProductSpec>>,
    pub config: Option<Config>,
}

impl SetConfig {
    pub fn new(product: Arc<RwLock<ProductSpec>>, config: Option<Config>) -> Self {
        Self { product, config }
    }

    pub fn with(product: Arc<RwLock<ProductSpec>>, config: Config) -> Self {
        Self {
            product,
            config: Some(config),
        }
    }
}

impl Message for SetConfig {
    type Reply = BoxFuture<Result<(), client::Error>>;
}

define_message!(SolveConfigModel { model: Value } -> Option<Value>);
define_message!(SetLocale { locale: String } -> ());
