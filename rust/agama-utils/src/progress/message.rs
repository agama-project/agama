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

use crate::actor::Message;
use crate::api::progress::Progress;
use crate::api::scope::Scope;
use crate::api::status::Stage;
use crate::api::Status;

pub struct GetStatus;

impl Message for GetStatus {
    type Reply = Status;
}

pub struct GetProgress;

impl Message for GetProgress {
    type Reply = Vec<Progress>;
}

pub struct SetProgress {
    pub progress: Progress,
}

impl SetProgress {
    pub fn new(progress: Progress) -> Self {
        Self { progress }
    }
}

impl Message for SetProgress {
    type Reply = ();
}

pub struct Start {
    pub scope: Scope,
    pub size: usize,
    pub step: String,
}

impl Start {
    pub fn new(scope: Scope, size: usize, step: &str) -> Self {
        Self {
            scope,
            size,
            step: step.to_string(),
        }
    }
}

impl Message for Start {
    type Reply = ();
}

pub struct StartWithSteps {
    pub scope: Scope,
    pub steps: Vec<String>,
}

impl StartWithSteps {
    pub fn new(scope: Scope, steps: Vec<String>) -> Self {
        Self { scope, steps }
    }
}

impl Message for StartWithSteps {
    type Reply = ();
}

pub struct Next {
    pub scope: Scope,
}

impl Next {
    pub fn new(scope: Scope) -> Self {
        Self { scope }
    }
}

impl Message for Next {
    type Reply = ();
}

pub struct NextWithStep {
    pub scope: Scope,
    pub step: String,
}

impl NextWithStep {
    pub fn new(scope: Scope, step: &str) -> Self {
        Self {
            scope,
            step: step.to_string(),
        }
    }
}

impl Message for NextWithStep {
    type Reply = ();
}

pub struct Finish {
    pub scope: Scope,
}

impl Finish {
    pub fn new(scope: Scope) -> Self {
        Self { scope }
    }
}

impl Message for Finish {
    type Reply = ();
}

pub struct SetStage {
    pub stage: Stage,
}

impl SetStage {
    pub fn new(stage: Stage) -> Self {
        Self { stage }
    }
}

impl Message for SetStage {
    type Reply = ();
}

pub struct GetStage;

impl Message for GetStage {
    type Reply = Stage;
}

/// Determines whether the progress is empty.
///
/// It can specify a scope to limit the query.
pub struct IsEmpty {
    pub scope: Option<Scope>,
}

impl IsEmpty {
    pub fn new() -> Self {
        IsEmpty { scope: None }
    }

    pub fn with_scope(scope: Scope) -> Self {
        IsEmpty { scope: Some(scope) }
    }
}

impl Message for IsEmpty {
    type Reply = bool;
}
