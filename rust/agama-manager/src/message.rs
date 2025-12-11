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
    api::{
        manager::{LanguageTag, LicenseContent},
        Action, Config, IssueMap, Proposal, Status, SystemInfo,
    },
};
use serde_json::Value;

/// Gets the information of the underlying system.
#[derive(Debug)]
pub struct GetSystem;

impl Message for GetSystem {
    type Reply = SystemInfo;
}

/// Gets the full config.
///
/// It includes user and default values.
#[derive(Debug)]
pub struct GetExtendedConfig;

impl Message for GetExtendedConfig {
    type Reply = Config;
}

/// Gets the current config set by the user.
#[derive(Debug)]
pub struct GetConfig;

impl Message for GetConfig {
    type Reply = Config;
}

/// Replaces the config.
#[derive(Debug)]
pub struct SetConfig {
    pub config: Config,
}

impl SetConfig {
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

impl Message for SetConfig {
    type Reply = ();
}

/// Updates the config.
#[derive(Debug)]
pub struct UpdateConfig {
    pub config: Config,
}

impl UpdateConfig {
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

impl Message for UpdateConfig {
    type Reply = ();
}

/// Gets the proposal.
#[derive(Debug)]
pub struct GetProposal;

impl Message for GetProposal {
    type Reply = Option<Proposal>;
}

/// Gets the installation issues.
pub struct GetIssues;

impl Message for GetIssues {
    type Reply = IssueMap;
}

pub struct GetLicense {
    pub id: String,
    pub lang: LanguageTag,
}

impl Message for GetLicense {
    type Reply = Option<LicenseContent>;
}

impl GetLicense {
    pub fn new(id: String, lang: LanguageTag) -> Self {
        Self { id, lang }
    }
}

/// Runs the given action.
#[derive(Debug)]
pub struct RunAction {
    pub action: Action,
}

impl RunAction {
    pub fn new(action: Action) -> Self {
        Self { action }
    }
}

impl Message for RunAction {
    type Reply = ();
}

// Gets the storage model.
pub struct GetStorageModel;

impl Message for GetStorageModel {
    type Reply = Option<Value>;
}

// Sets the storage model.
pub struct SetStorageModel {
    pub model: Value,
}

impl SetStorageModel {
    pub fn new(model: Value) -> Self {
        Self { model }
    }
}

impl Message for SetStorageModel {
    type Reply = ();
}

#[derive(Clone)]
pub struct SolveStorageModel {
    pub model: Value,
}

impl SolveStorageModel {
    pub fn new(model: Value) -> Self {
        Self { model }
    }
}

impl Message for SolveStorageModel {
    type Reply = Option<Value>;
}
