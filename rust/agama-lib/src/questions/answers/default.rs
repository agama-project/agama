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

use crate::questions::{GenericQuestion, WithPassword};

use super::AnswerStrategy;

/// AnswerStrategy that provides as answer the default option.
pub struct DefaultAnswers;

impl DefaultAnswers {
    pub fn id() -> u8 {
        1
    }
}

impl AnswerStrategy for DefaultAnswers {
    fn id(&self) -> u8 {
        DefaultAnswers::id()
    }

    fn answer(&self, question: &GenericQuestion) -> Option<String> {
        Some(question.default_option.clone())
    }

    fn answer_with_password(&self, question: &WithPassword) -> (Option<String>, Option<String>) {
        (Some(question.base.default_option.clone()), None)
    }
}
