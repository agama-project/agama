// Copyright (c) [2024] SUSE LLC
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

use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use std::collections::HashMap;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    // TODO: use it when checking the answer.
    #[error("Invalid answer for question {0}")]
    InvalidAnswer(u32),
}

/// Represents a question including its [specification](QuestionSpec) and [answer](QuestionAnswer).
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    /// Question ID.
    pub id: u32,
    /// Question specification.
    #[serde(flatten)]
    pub spec: QuestionSpec,
    /// Question answer.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub answer: Option<QuestionAnswer>,
}

impl Question {
    /// Creates a new question using the given ID and spec.
    ///
    /// The question does not have an answer yet. Use the [Question::set_answer]
    /// function to set an answer.
    ///
    /// * `id`: question ID.
    /// * `spec`: question specification.
    pub fn new(id: u32, spec: QuestionSpec) -> Self {
        Self {
            id,
            spec,
            answer: None,
        }
    }

    /// Sets an answer for the question.
    ///
    /// FIXME: check whether the answer is valid.
    ///
    /// * `answer`: question answer.
    pub fn set_answer(&mut self, answer: QuestionAnswer) -> Result<(), Error> {
        self.answer = Some(answer);
        Ok(())
    }
}

/// Defines how a question should look like.
///
/// A question is composed by a set of actions and, optionally, and additional
/// field. For instance, a question to decrypt a device using a password would have:
///
/// * a pair of actions, "decrypt" and "skip".
/// * a password field.
///
/// In other cases, like a simple "yes/no" questions, the field would not be needed.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct QuestionSpec {
    /// Question text.
    pub text: String,
    /// Question class (e.g., "autoyast.unsupported"). It works as a hint for
    /// the UI or to match pre-defined answers.
    pub class: String,
    /// Optionally, a question might define an additional field (e.g., a
    /// password, a selector, etc.).
    #[serde(default)]
    pub field: QuestionField,
    /// List of available actions.
    pub actions: Vec<Action>,
    /// Default action.
    /// Question class (e.g., "autoyast.unsupported"). It works as a hint for
    /// the UI or as the selected option when not using the "auto" policy.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_action: Option<String>,
    /// Additional data that can be set for any question.
    // FIXME: set the proper value_type.
    #[schema(value_type = HashMap<String, String>)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<HashMap<String, Box<RawValue>>>,
}

impl QuestionSpec {
    /// Creates a new question specification.
    ///
    /// * `text`: question text.
    /// * `class`: question class.
    pub fn new(text: &str, class: &str) -> Self {
        Self {
            text: text.to_string(),
            class: class.to_string(),
            field: QuestionField::None,
            actions: vec![],
            default_action: None,
            data: None,
        }
    }

    /// Sets the question field to be a string.
    pub fn as_string(mut self) -> Self {
        self.field = QuestionField::String;
        self
    }

    /// Sets the question field to be a password.
    pub fn as_password(mut self) -> Self {
        self.field = QuestionField::Password;
        self
    }

    /// Sets the question field to be a selector.
    ///
    /// * `options`: available options in `(id, label)` format.
    pub fn as_select(mut self, options: &[(&str, &str)]) -> Self {
        let options: Vec<_> = options
            .iter()
            .map(|(id, label)| SelectionOption::new(id, label))
            .collect();
        self.field = QuestionField::Select { options };
        self
    }

    /// Sets a default action.
    ///
    /// FIXME: check whether the action exists.
    ///
    /// * `action_id`: action identifier.
    pub fn with_default_action(mut self, action_id: &str) -> Self {
        self.default_action = Some(action_id.to_string());
        self
    }

    /// Sets the available actions.o
    ///
    /// * `actions`: available actions in `(id, label)` format.
    pub fn with_actions(mut self, actions: &[(&str, &str)]) -> Self {
        self.actions = actions
            .iter()
            .map(|(id, label)| Action::new(id, label))
            .collect();
        self
    }
}

/// Question field.
///
/// Apart from the actions, a question can include a field. The field can go
/// from a string to a selector.
///
/// The field is usually presented as a control in a form.
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum QuestionField {
    /// No field.
    #[default]
    None,
    /// A simple string field.
    String,
    /// A password field.
    Password,
    /// A selector field.
    Select { options: Vec<SelectionOption> },
}

/// Selector option.
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SelectionOption {
    id: String,
    label: String,
}

impl SelectionOption {
    pub fn new(id: &str, label: &str) -> Self {
        Self {
            id: id.to_string(),
            label: label.to_string(),
        }
    }
}

/// Question action.
///
/// They are usually presented as the button in a form.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
pub struct Action {
    /// Action value.
    pub id: String,
    /// Localized option.
    pub label: String,
}

impl Action {
    pub fn new(id: &str, label: &str) -> Self {
        Self {
            id: id.to_string(),
            label: label.to_string(),
        }
    }
}

/// Question answer.
///
/// It includes the action and, optionally, and additional value which depends
/// on the question field.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct QuestionAnswer {
    pub action: String,
    pub value: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_question() {
        let q = QuestionSpec::new("Please, enter a username", "username")
            .as_string()
            .with_actions(&[("next", "Next"), ("cancel", "Cancel")]);

        let q_str = serde_json::to_string_pretty(&q).unwrap();
        println!("{}", &q_str);
        assert!(matches!(q.field, QuestionField::String));
        assert_eq!(q.actions[0], Action::new("next", "Next"));
        assert_eq!(q.actions[1], Action::new("cancel", "Cancel"));
    }

    #[test]
    fn test_password_question() {
        let q = QuestionSpec::new("Decrypt the device", "luks")
            .as_password()
            .with_actions(&[("decrypt", "Decrypt"), ("skip", "Skip")]);

        let q_str = serde_json::to_string_pretty(&q).unwrap();
        println!("{}", &q_str);
        assert!(matches!(q.field, QuestionField::Password));
        assert_eq!(q.actions[0], Action::new("decrypt", "Decrypt"));
        assert_eq!(q.actions[1], Action::new("skip", "Skip"));
    }

    #[test]
    fn test_select_question() {
        let q = QuestionSpec::new("There is a solver conflict...", "conflict")
            .as_select(&[("opt1", "Option 1"), ("opt2", "Option 2")])
            .with_actions(&[("decrypt", "Decrypt"), ("skip", "Skip")]);

        let q_str = serde_json::to_string_pretty(&q).unwrap();
        println!("{}", &q_str);
        assert!(matches!(
            q.field,
            QuestionField::Select { options: _options }
        ));
        assert_eq!(q.actions[0], Action::new("decrypt", "Decrypt"));
        assert_eq!(q.actions[1], Action::new("skip", "Skip"));
    }
}
