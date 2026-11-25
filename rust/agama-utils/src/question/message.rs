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
    api::question::{Answer as QuestionAnswer, Config, Question, QuestionSpec},
    define_message,
};

define_message!(
    /// Gets questions configuration (policy, pre-defined answers, etc.).
    GetConfig -> Option<Config>
);

define_message!(
    /// Sets questions configuration (policy, pre-defined answers, etc.).
    SetConfig { config: Option<Config> } -> ()
);

define_message!(
    /// Gets the list of questions.
    Get -> Vec<Question>
);

define_message!(
    /// Asks a question, adding it to the list of questions.
    Ask { question: QuestionSpec } -> Question
);

define_message!(
    /// Answers a question, updating its current representation.
    Answer { id: u32, answer: QuestionAnswer } -> ()
);

define_message!(
    /// Removes a question from the list.
    Delete { id: u32 } -> ()
);
