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

/// Trait for objects that can provide answers to all kind of Question.
///
/// If no strategy is selected or the answer is unknown, then ask to the user.
pub trait AnswerStrategy {
    /// Id for quick runtime inspection of strategy type
    fn id(&self) -> u8;
    /// Provides answer for generic question
    ///
    /// I gets as argument the question to answer. Returned value is `answer`
    /// property or None. If `None` is used, it means that this object does not
    /// answer to given question.
    fn answer(&self, question: &GenericQuestion) -> Option<String>;
    /// Provides answer and password for base question with password
    ///
    /// I gets as argument the question to answer. Returned value is pair
    /// of `answer` and `password` properties. If `None` is used in any
    /// position it means that this object does not respond to given property.
    ///
    /// It is object responsibility to provide correct pair. For example if
    /// possible answer can be "Ok" and "Cancel". Then for `Ok` password value
    /// should be provided and for `Cancel` it can be `None`.
    fn answer_with_password(&self, question: &WithPassword) -> (Option<String>, Option<String>);
}
