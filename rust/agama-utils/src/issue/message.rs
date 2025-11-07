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
use crate::api::issue::{Issue, IssueMap};
use crate::api::Scope;

pub struct Get;

impl Message for Get {
    type Reply = IssueMap;
}

// FIXME: consider an alternative approach to avoid pub(crate),
// making it only visible to the service.
pub struct Update {
    pub(crate) scope: Scope,
    pub(crate) issues: Vec<Issue>,
    pub(crate) notify: bool,
}

impl Update {
    pub fn new(scope: Scope, issues: Vec<Issue>) -> Self {
        Self {
            scope,
            issues,
            notify: true,
        }
    }

    pub fn notify(mut self, notify: bool) -> Self {
        self.notify = notify;
        self
    }
}

impl Message for Update {
    type Reply = ();
}

pub struct Clear {
    pub scope: Scope,
}

impl Clear {
    pub fn new(scope: Scope) -> Self {
        Self { scope }
    }
}

impl Message for Clear {
    type Reply = ();
}
