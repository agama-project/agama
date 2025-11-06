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
};

#[derive(Clone)]
pub struct GetSystem;

impl Message for GetSystem {
    type Reply = SystemInfo;
}

pub struct SetSystem<T> {
    pub config: T,
}

impl<T: Send + 'static> Message for SetSystem<T> {
    type Reply = ();
}

impl<T> SetSystem<T> {
    pub fn new(config: T) -> Self {
        Self { config }
    }
}

pub struct GetConfig;

impl Message for GetConfig {
    type Reply = Config;
}

pub struct SetConfig<T> {
    pub config: T,
}

impl<T: Send + 'static> Message for SetConfig<T> {
    type Reply = ();
}

impl<T> SetConfig<T> {
    pub fn new(config: T) -> Self {
        Self { config }
    }
}

pub struct GetProposal;

impl Message for GetProposal {
    type Reply = Option<Proposal>;
}

pub struct Install;

impl Message for Install {
    type Reply = bool;
}

pub struct Refresh;

impl Message for Refresh {
    type Reply = ();
}

pub struct Finish;

impl Message for Finish {
    type Reply = ();
}
