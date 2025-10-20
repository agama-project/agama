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

use crate::{
    actor::Message,
    api::question::{self, Config, Question},
};

/// Gets questions configuration (policy, pre-defined answers, etc.).
pub struct GetConfig;

impl Message for GetConfig {
    type Reply = Config;
}

/// Sets questions configuration (policy, pre-defined answers, etc.).
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

/// Gets the list of questions.
pub struct Get;

impl Message for Get {
    type Reply = Vec<question::Question>;
}

/// Asks a question, adding it to the list of questions.
pub struct Ask {
    pub question: question::QuestionSpec,
}

impl Ask {
    pub fn new(question: question::QuestionSpec) -> Self {
        Self { question }
    }
}

impl Message for Ask {
    type Reply = Question;
}

/// Answers a question, updating its current representation.
pub struct Answer {
    pub id: u32,
    pub answer: question::Answer,
}

impl Message for Answer {
    type Reply = ();
}

/// Removes a question from the list.
pub struct Delete {
    pub id: u32,
}

impl Message for Delete {
    type Reply = ();
}
