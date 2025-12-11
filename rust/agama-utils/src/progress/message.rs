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

pub struct Get;

impl Message for Get {
    type Reply = Vec<Progress>;
}

pub struct Set {
    pub progress: Progress,
}

impl Set {
    pub fn new(progress: Progress) -> Self {
        Self { progress }
    }
}

impl Message for Set {
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
    pub fn new(scope: Scope, steps: &[&str]) -> Self {
        Self {
            scope,
            steps: steps.into_iter().map(ToString::to_string).collect(),
        }
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
