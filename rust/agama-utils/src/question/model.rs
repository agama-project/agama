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

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub id: u32,
    pub spec: QuestionSpec,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub answer: Option<QuestionAnswer>,
}

impl Question {
    pub fn new(id: u32, spec: QuestionSpec) -> Self {
        Self {
            id,
            spec,
            answer: None,
        }
    }

    // FIXME: check whether the answer is valid.
    pub fn set_answer(&mut self, answer: QuestionAnswer) {
        self.answer = Some(answer);
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct QuestionSpec {
    pub text: String,
    pub class: String,
    #[serde(default)]
    pub field: QuestionField,
    pub actions: Vec<Action>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_action: Option<String>,
    // FIXME: set the proper value_type (or an alternative)
    #[schema(value_type = String)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub additional_data: Option<HashMap<String, Box<RawValue>>>,
}

impl QuestionSpec {
    pub fn new(text: &str, qclass: &str) -> Self {
        Self {
            text: text.to_string(),
            class: qclass.to_string(),
            field: QuestionField::None,
            actions: vec![],
            default_action: None,
            additional_data: None,
        }
    }

    pub fn as_string(mut self) -> Self {
        self.field = QuestionField::String;
        self
    }

    pub fn as_password(mut self) -> Self {
        self.field = QuestionField::Password;
        self
    }

    pub fn as_select(mut self, options: &[(&str, &str)]) -> Self {
        let options: Vec<_> = options
            .iter()
            .map(|(id, label)| SelectionOption::new(id, label))
            .collect();
        self.field = QuestionField::Select { options };
        self
    }

    pub fn with_default_action(mut self, action_id: &str) -> Self {
        self.default_action = Some(action_id.to_string());
        self
    }

    pub fn with_actions(mut self, actions: &[(&str, &str)]) -> Self {
        self.actions = actions
            .iter()
            .map(|(id, label)| Action::new(id, label))
            .collect();
        self
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum QuestionField {
    #[default]
    None,
    String,
    Password,
    Select {
        options: Vec<SelectionOption>,
    },
}

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
