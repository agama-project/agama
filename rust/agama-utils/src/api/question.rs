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

use crate::gettext_noop;
use gettextrs::gettext;
use merge::Merge;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fmt};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    // TODO: use it when checking the answer.
    #[error("Invalid answer for question {0}")]
    InvalidAnswer(u32),
}

/// Questions configuration.
#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub policy: Option<Policy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub answers: Option<Vec<AnswerRule>>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum Policy {
    /// Automatically answer questions.
    Auto,
    /// Ask the user.
    User,
}

/// Defines the answer to use for any question which matches the rule.
///
/// If the rule matches with the question ([class](Self::class),
/// [text](Self::text) or [data](Self::data), it applies the specified `answer`).
#[derive(Clone, Serialize, Deserialize, Debug, utoipa::ToSchema, PartialEq)]
pub struct AnswerRule {
    /// Question class (see [QuestionSpec::class]).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub class: Option<String>,
    /// Question text (see [QuestionSpec::text]).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// A question can include custom data. If any of the entries matches,
    /// the rule is applied (see [QuestionSpec::data]).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<HashMap<String, String>>,
    /// The answer to use (see [QuestionSpec::answer]).
    #[serde(flatten)]
    pub answer: Answer,
}

impl AnswerRule {
    /// Determines whether the answer responds to the given question.
    ///
    /// * `spec`: question spec to compare with.
    pub fn answers_to(&self, spec: &QuestionSpec) -> bool {
        if let Some(class) = &self.class {
            if spec.class != *class {
                return false;
            }
        }

        if let Some(text) = &self.text {
            if spec.text != *text {
                return false;
            }
        }

        if let Some(data) = &self.data {
            return data.iter().all(|(key, value)| {
                let Some(e_val) = spec.data.get(key) else {
                    return false;
                };

                e_val == value
            });
        }

        true
    }
}

/// Represents a question including its [specification](QuestionSpec) and [answer](QuestionAnswer).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    /// Question ID.
    pub id: u32,
    /// Question specification.
    #[serde(flatten)]
    pub spec: QuestionSpec,
    /// Question answer.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub answer: Option<Answer>,
}

impl fmt::Debug for Question {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Question")
            .field("id", &self.id)
            .field("spec", &self.spec)
            .field("answer", &self.answer.as_ref().map(|_| "[FILTERED]"))
            .finish()
    }
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
    pub fn set_answer(&mut self, answer: Answer) -> Result<(), Error> {
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
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QuestionSpec {
    /// Question text.
    pub text: String,
    /// Question class (e.g., "autoyast.unsupported"). It works as a hint for
    /// the UI or to match pre-defined answers. The values that are understood
    /// by Agama's UI are documented [in the Questions
    /// page](https://agama-project.github.io/docs/user/reference/profile/answers).
    pub class: String,
    /// Optionally, a question might define an additional field (e.g., a
    /// password, a selector, etc.).
    #[serde(default)]
    pub field: QuestionField,
    /// List of available actions.
    pub actions: Vec<Action>,
    /// Default action.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_action: Option<String>,
    /// Additional data that can be set for any question.
    // FIXME: set the proper value_type.
    #[schema(value_type = HashMap<String, String>)]
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub data: HashMap<String, String>,
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
            data: HashMap::new(),
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

    /// Sets the available actions.
    ///
    /// * `actions`: available actions in `(id, label)` format.
    pub fn with_actions(mut self, actions: &[(&str, &str)]) -> Self {
        self.actions = actions
            .iter()
            .map(|(id, label)| Action::new(id, label))
            .collect();
        self
    }

    /// Sets the available actions from a list of IDs.
    ///
    /// The labels are generated by calling `gettext` on each ID.
    ///
    /// * `ids`: available action IDs.
    pub fn with_action_ids(self, ids: &[&str]) -> Self {
        let labels: Vec<String> = ids.iter().map(|&id| gettext(id)).collect();
        let actions: Vec<(&str, &str)> = ids
            .iter()
            .zip(&labels)
            .map(|(&id, label)| (id, label.as_str()))
            .collect();
        self.with_actions(&actions)
    }

    /// Adds localized "Yes" and "No" actions to the question.
    ///
    /// This is a convenience method for creating questions that require a simple
    /// yes or no answer. The action IDs will be "Yes" and "No", and their labels
    /// will be localized.
    ///
    /// This method sets the default action to "No". If you need a different
    /// default, you can override it with a subsequent call to [QuestionSpec::with_default_action].
    ///
    /// # Example
    ///
    /// ```
    ///   use agama_utils::api::question::QuestionSpec;
    ///   let q = QuestionSpec::new("Continue?", "q.continue").with_yes_no_actions();
    ///   assert_eq!(q.default_action.as_deref(), Some("No"));
    ///   assert_eq!(q.actions.len(), 2);
    ///   assert_eq!(q.actions[0].id, "Yes");
    ///   assert_eq!(q.actions[1].id, "No");
    ///   // localized labels
    ///   assert_eq!(q.actions[0].label, "Yes");
    ///   assert_eq!(q.actions[1].label, "No");
    /// ```
    pub fn with_yes_no_actions(self) -> Self {
        self.with_action_ids(&[gettext_noop("Yes"), gettext_noop("No")])
            .with_default_action("No")
    }

    /// Sets the additional data.
    ///
    /// * `data`: available actions in `(id, label)` format.
    pub fn with_data(mut self, data: &[(&str, &str)]) -> Self {
        self.data = data
            .iter()
            .map(|(id, label)| (id.to_string(), label.to_string()))
            .collect::<HashMap<String, String>>();
        self
    }

    pub fn with_owned_data(mut self, data: HashMap<String, String>) -> Self {
        self.data = data;
        self
    }
}

/// Question field.
///
/// Apart from the actions, a question can include a field. The field can go
/// from a string to a selector.
///
/// The field is usually presented as a control in a form.
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema, PartialEq)]
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
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema, PartialEq)]
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
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
pub struct Answer {
    #[serde(alias = "answer")]
    pub action: String,
    #[serde(alias = "password", skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

impl Answer {
    /// Creates a new answer.
    pub fn new(action: &str) -> Self {
        Self {
            action: action.to_string(),
            value: None,
        }
    }

    /// Adds a value to an answer.
    pub fn with_value(mut self, value: &str) -> Self {
        self.value = Some(value.to_string());
        self
    }
}

/// Represents an update operation over the list of questions.
///
/// It is used by the HTTP layer only.
#[derive(Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum UpdateQuestion {
    /// Answer the question with the given answer.
    Answer {
        id: u32,
        #[serde(flatten)]
        answer: Answer,
    },
    /// Remove the question.
    Delete { id: u32 },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_question() {
        let q = QuestionSpec::new("Please, enter a username", "username")
            .as_string()
            .with_action_ids(&["Next", "Cancel"]);

        let q_str = serde_json::to_string_pretty(&q).unwrap();
        println!("{}", &q_str);
        assert!(matches!(q.field, QuestionField::String));
        assert_eq!(q.actions[0], Action::new("Next", "Next"));
        assert_eq!(q.actions[1], Action::new("Cancel", "Cancel"));
    }

    #[test]
    fn test_password_question() {
        let q = QuestionSpec::new("Decrypt the device", "luks")
            .as_password()
            .with_action_ids(&["Decrypt", "Skip"]);

        let q_str = serde_json::to_string_pretty(&q).unwrap();
        println!("{}", &q_str);
        assert!(matches!(q.field, QuestionField::Password));
        assert_eq!(q.actions[0], Action::new("Decrypt", "Decrypt"));
        assert_eq!(q.actions[1], Action::new("Skip", "Skip"));
    }

    #[test]
    fn test_select_question() {
        let q = QuestionSpec::new("There is a solver conflict...", "conflict")
            .as_select(&[("opt1", "Option 1"), ("opt2", "Option 2")])
            .with_action_ids(&["Decrypt", "Skip"]);

        let q_str = serde_json::to_string_pretty(&q).unwrap();
        println!("{}", &q_str);
        assert!(matches!(
            q.field,
            QuestionField::Select { options: _options }
        ));
        assert_eq!(q.actions[0], Action::new("Decrypt", "Decrypt"));
        assert_eq!(q.actions[1], Action::new("Skip", "Skip"));
    }

    #[test]
    fn test_answers_to() {
        let answer = Answer {
            action: "Cancel".to_string(),
            value: None,
        };

        let q = QuestionSpec::new("Please, enter a username", "username")
            .as_string()
            .with_data(&[("id", "1")])
            .with_action_ids(&["Next", "Cancel"]);

        let rule_by_text = AnswerRule {
            text: Some("Please, enter a username".to_string()),
            class: Default::default(),
            data: Default::default(),
            answer: answer.clone(),
        };
        assert!(rule_by_text.answers_to(&q));

        let rule_by_class = AnswerRule {
            text: Default::default(),
            class: Some("username".to_string()),
            data: Default::default(),
            answer: answer.clone(),
        };
        assert!(rule_by_class.answers_to(&q));

        let rule_by_data = AnswerRule {
            text: Default::default(),
            class: Default::default(),
            data: Some(HashMap::from([("id".to_string(), "1".to_string())])),
            answer: answer.clone(),
        };
        assert!(rule_by_data.answers_to(&q));

        let not_matching_rule = AnswerRule {
            text: Some("Another text".to_string()),
            class: None,
            data: None,
            answer: answer.clone(),
        };
        assert!(!not_matching_rule.answers_to(&q));
    }

    #[test]
    fn test_merge_question_config() {
        // updated config
        let mut updated = Config {
            policy: Some(Policy::Auto),
            answers: Some(vec![AnswerRule {
                class: Some("foo".to_string()),
                text: None,
                data: None,
                answer: Answer::new("yes"),
            }]),
        };

        // original config to merge from
        let original = Config {
            policy: Some(Policy::User),
            answers: Some(vec![
                AnswerRule {
                    class: Some("bar".to_string()),
                    text: None,
                    data: None,
                    answer: Answer::new("no"),
                },
                AnswerRule {
                    class: Some("baz".to_string()),
                    text: Some("question text".to_string()),
                    data: None,
                    answer: Answer::new("maybe"),
                },
            ]),
        };

        updated.merge(original.clone());

        // Assertions for policy (overwrite_none strategy)
        // updated.policy was Some(Auto), original.policy is Some(User).
        // Since updated.policy was Some, it should NOT be overwritten.
        assert_eq!(updated.policy, Some(Policy::Auto));

        // Assertions for answers (overwrite_none strategy)
        // updated.answers was Some, original.answers is Some.
        // Since updated.answers was Some, it should NOT be overwritten.
        assert_eq!(updated.answers.as_ref().unwrap().len(), 1);
        assert_eq!(
            updated.answers.as_ref().unwrap()[0].class,
            Some("foo".to_string())
        );
        assert_eq!(
            updated.answers.as_ref().unwrap()[0].answer.action,
            "yes".to_string()
        );

        // Test with None for updated.answers to check overwrite
        let mut updated1 = Config {
            policy: None,
            answers: None, // None
        };
        let original1 = Config {
            policy: Some(Policy::User),
            answers: Some(vec![AnswerRule {
                class: Some("qux".to_string()),
                text: None,
                data: None,
                answer: Answer::new("go"),
            }]),
        };
        updated1.merge(original1.clone());
        // updated1.answers was None, so it should be overwritten by original1.answers.
        assert_eq!(updated1.answers.as_ref().unwrap().len(), 1);
        assert_eq!(
            updated1.answers.as_ref().unwrap()[0].class,
            Some("qux".to_string())
        );
        assert_eq!(
            updated1.answers.as_ref().unwrap()[0].answer.action,
            "go".to_string()
        );
        // updated1.policy was None, so it should be overwritten.
        assert_eq!(updated1.policy, Some(Policy::User));
    }

    #[test]
    fn test_merge_question_config_with_nones_and_empty() {
        // Case 1: updated.policy is None, original.policy is Some
        let mut updated = Config {
            policy: None,
            answers: None, // Now is None
        };
        let original = Config {
            policy: Some(Policy::Auto),
            answers: None, // Now is None
        };
        updated.merge(original.clone());
        assert_eq!(updated.policy, Some(Policy::Auto));
        assert_eq!(updated.answers, None); // updated.answers was None, original.answers was None, so it remains None.

        // Case 2: updated.policy is Some, original.policy is None
        let mut updated1 = Config {
            policy: Some(Policy::User),
            answers: None, // Now is None
        };
        let original1 = Config {
            policy: None,
            answers: None, // Now is None
        };
        updated1.merge(original1);
        assert_eq!(updated1.policy, Some(Policy::User)); // updated1.policy was Some, so it's not overwritten.
        assert_eq!(updated1.answers, None); // updated1.answers was None, original1.answers was None, so it remains None.

        // Case 3: updated.answers is None, original.answers is Some non-empty
        let mut updated2 = Config {
            policy: None,
            answers: None, // Now is None
        };
        let original2 = Config {
            policy: None,
            answers: Some(vec![AnswerRule {
                class: Some("foo".to_string()),
                text: None,
                data: None,
                answer: Answer::new("yes"),
            }]),
        };
        updated2.merge(original2.clone());
        assert_eq!(updated2.answers.as_ref().unwrap().len(), 1);
        assert_eq!(
            updated2.answers.as_ref().unwrap()[0].class,
            Some("foo".to_string())
        );
        assert_eq!(
            updated2.answers.as_ref().unwrap()[0].answer.action,
            "yes".to_string()
        );

        // Case 4: updated.answers is Some non-empty, original.answers is None
        let mut updated3 = Config {
            policy: None,
            answers: Some(vec![AnswerRule {
                class: Some("bar".to_string()),
                text: None,
                data: None,
                answer: Answer::new("no"),
            }]),
        };
        let original3 = Config {
            policy: None,
            answers: None, // Now is None
        };
        updated3.merge(original3);
        assert_eq!(updated3.answers.as_ref().unwrap().len(), 1); // updated.answers was Some, so it's not overwritten.
        assert_eq!(
            updated3.answers.as_ref().unwrap()[0].class,
            Some("bar".to_string())
        );
        assert_eq!(
            updated3.answers.as_ref().unwrap()[0].answer.action,
            "no".to_string()
        );
    }
}
