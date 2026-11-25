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
use crate::define_message;

define_message!(GetStatus -> Status);
define_message!(GetProgress -> Vec<Progress>);
define_message!(SetProgress { progress: Progress } -> ());
define_message!(Start { scope: Scope, size: usize, step: String } -> ());
define_message!(StartWithSteps { scope: Scope, steps: Vec<String> } -> ());
define_message!(Next { scope: Scope } -> ());
define_message!(NextWithStep { scope: Scope, step: String } -> ());

define_message!(Finish { scope: Scope } -> ());
define_message!(SetStage { stage: Stage } -> ());
define_message!(GetStage -> Stage);

/// Determines whether the progress is empty.
///
/// It can specify a scope to limit the query.
pub struct IsEmpty {
    pub scope: Option<Scope>,
}

impl Default for IsEmpty {
    fn default() -> Self {
        Self::new()
    }
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
