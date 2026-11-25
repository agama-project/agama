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
    api::software::{Config, Proposal, SystemInfo},
    define_message,
    products::ProductSpec,
};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::Resolvable;

define_message!(GetSystem -> SystemInfo);
define_message!(SetSystem<T> { config: T } -> ());
define_message!(GetConfig -> Config);

pub struct SetConfig<T> {
    pub config: Option<T>,
    pub product: Arc<RwLock<ProductSpec>>,
}

impl<T: Send + 'static> Message for SetConfig<T> {
    type Reply = ();
}

impl<T> SetConfig<T> {
    pub fn new(product: Arc<RwLock<ProductSpec>>, config: Option<T>) -> Self {
        Self { config, product }
    }

    pub fn with(product: Arc<RwLock<ProductSpec>>, config: T) -> Self {
        Self {
            config: Some(config),
            product,
        }
    }
}

define_message!(GetProposal -> Option<Proposal>);
define_message!(Install -> ());
define_message!(Probe -> ());
define_message!(Finish -> ());

// Sets a resolvables list
define_message!(SetResolvables { id: String, resolvables: Vec<Resolvable> } -> ());
define_message!(SetLocale { locale: String } -> ());
define_message!(IsPatternSelected { name: String } -> bool);
