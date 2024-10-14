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

use std::collections::HashMap;

use agama_lib::questions::GenericQuestion;
use serde::{Deserialize, Serialize};

use super::QuestionsError;

/// Data structure for single JSON answer. For variables specification see
/// corresponding [agama_lib::questions::GenericQuestion] fields.
/// The *matcher* part is: `class`, `text`, `data`.
/// The *answer* part is: `answer`, `password`.
#[derive(Serialize, Deserialize, PartialEq, Debug)]
struct Answer {
    pub class: Option<String>,
    pub text: Option<String>,
    /// A matching GenericQuestion can have other data fields too
    pub data: Option<HashMap<String, String>>,
    /// The answer text is the only mandatory part of an Answer
    pub answer: String,
    /// All possible mixins have to be here, so they can be specified in an Answer
    pub password: Option<String>,
}

impl Answer {
    /// Determines whether the answer responds to the given question.
    ///
    /// * `question`: question to compare with.
    pub fn responds(&self, question: &GenericQuestion) -> bool {
        if let Some(class) = &self.class {
            if question.class != *class {
                return false;
            }
        }

        if let Some(text) = &self.text {
            if question.text != *text {
                return false;
            }
        }

        if let Some(data) = &self.data {
            return data.iter().all(|(key, value)| {
                let Some(e_val) = question.data.get(key) else {
                    return false;
                };

                e_val == value
            });
        }

        true
    }
}

/// Data structure holding list of Answer.
/// The first matching Answer is used, even if there is
/// a better (more specific) match later in the list.
#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct Answers {
    answers: Vec<Answer>,
}

impl Answers {
    pub fn new_from_file(path: &str) -> Result<Self, QuestionsError> {
        let f = std::fs::File::open(path).map_err(QuestionsError::IO)?;
        let result: Self = serde_json::from_reader(f).map_err(QuestionsError::Deserialize)?;

        Ok(result)
    }

    pub fn id() -> u8 {
        2
    }

    fn find_answer(&self, question: &GenericQuestion) -> Option<&Answer> {
        self.answers.iter().find(|a| a.responds(question))
    }
}

impl crate::questions::AnswerStrategy for Answers {
    fn id(&self) -> u8 {
        Answers::id()
    }

    fn answer(&self, question: &GenericQuestion) -> Option<String> {
        let answer = self.find_answer(question);
        answer.map(|answer| answer.answer.clone())
    }

    fn answer_with_password(
        &self,
        question: &agama_lib::questions::WithPassword,
    ) -> (Option<String>, Option<String>) {
        // use here fact that with password share same matchers as generic one
        let answer = self.find_answer(&question.base);
        if let Some(answer) = answer {
            (Some(answer.answer.clone()), answer.password.clone())
        } else {
            (None, None)
        }
    }
}

#[cfg(test)]
mod tests {
    use agama_lib::questions::{GenericQuestion, WithPassword};

    use crate::questions::AnswerStrategy;

    use super::*;

    // set of fixtures for test
    fn get_answers() -> Answers {
        Answers {
            answers: vec![
                Answer {
                    class: Some("without_data".to_string()),
                    data: None,
                    text: None,
                    answer: "Ok".to_string(),
                    password: Some("testing pwd".to_string()), // ignored for generic question
                },
                Answer {
                    class: Some("with_data".to_string()),
                    data: Some(HashMap::from([
                        ("data1".to_string(), "value1".to_string()),
                        ("data2".to_string(), "value2".to_string()),
                    ])),
                    text: None,
                    answer: "Maybe".to_string(),
                    password: None,
                },
                Answer {
                    class: Some("with_data".to_string()),
                    data: Some(HashMap::from([(
                        "data1".to_string(),
                        "another_value1".to_string(),
                    )])),
                    text: None,
                    answer: "Ok2".to_string(),
                    password: None,
                },
            ],
        }
    }

    #[test]
    fn test_class_match() {
        let answers = get_answers();
        let question = GenericQuestion {
            id: 1,
            class: "without_data".to_string(),
            text: "JFYI we will kill all bugs during installation.".to_string(),
            options: vec!["Ok".to_string(), "Cancel".to_string()],
            default_option: "Cancel".to_string(),
            data: HashMap::new(),
            answer: "".to_string(),
        };
        assert_eq!(Some("Ok".to_string()), answers.answer(&question));
    }

    #[test]
    fn test_no_match() {
        let answers = get_answers();
        let question = GenericQuestion {
            id: 1,
            class: "non-existing".to_string(),
            text: "Hard question?".to_string(),
            options: vec!["Ok".to_string(), "Cancel".to_string()],
            default_option: "Cancel".to_string(),
            data: HashMap::new(),
            answer: "".to_string(),
        };
        assert_eq!(None, answers.answer(&question));
    }

    #[test]
    fn test_with_password() {
        let answers = get_answers();
        let question = GenericQuestion {
            id: 1,
            class: "without_data".to_string(),
            text: "Please provide password for dooms day.".to_string(),
            options: vec!["Ok".to_string(), "Cancel".to_string()],
            default_option: "Cancel".to_string(),
            data: HashMap::new(),
            answer: "".to_string(),
        };
        let with_password = WithPassword {
            password: "".to_string(),
            base: question,
        };
        let expected = (Some("Ok".to_string()), Some("testing pwd".to_string()));
        assert_eq!(expected, answers.answer_with_password(&with_password));
    }

    /// An Answer matches on *data* if all its keys and values are in the GenericQuestion *data*.
    /// The GenericQuestion can have other *data* keys.
    #[test]
    fn test_partial_data_match() {
        let answers = get_answers();
        let question = GenericQuestion {
            id: 1,
            class: "with_data".to_string(),
            text: "Hard question?".to_string(),
            options: vec!["Ok2".to_string(), "Maybe".to_string(), "Cancel".to_string()],
            default_option: "Cancel".to_string(),
            data: HashMap::from([
                ("data1".to_string(), "value1".to_string()),
                ("data2".to_string(), "value2".to_string()),
                ("data3".to_string(), "value3".to_string()),
            ]),
            answer: "".to_string(),
        };
        assert_eq!(Some("Maybe".to_string()), answers.answer(&question));
    }

    #[test]
    fn test_full_data_match() {
        let answers = get_answers();
        let question = GenericQuestion {
            id: 1,
            class: "with_data".to_string(),
            text: "Hard question?".to_string(),
            options: vec!["Ok2".to_string(), "Maybe".to_string(), "Cancel".to_string()],
            default_option: "Cancel".to_string(),
            data: HashMap::from([
                ("data1".to_string(), "another_value1".to_string()),
                ("data2".to_string(), "value2".to_string()),
                ("data3".to_string(), "value3".to_string()),
            ]),
            answer: "".to_string(),
        };
        assert_eq!(Some("Ok2".to_string()), answers.answer(&question));
    }

    #[test]
    fn test_no_data_match() {
        let answers = get_answers();
        let question = GenericQuestion {
            id: 1,
            class: "with_data".to_string(),
            text: "Hard question?".to_string(),
            options: vec!["Ok2".to_string(), "Maybe".to_string(), "Cancel".to_string()],
            default_option: "Cancel".to_string(),
            data: HashMap::from([
                ("data1".to_string(), "different value".to_string()),
                ("data2".to_string(), "value2".to_string()),
                ("data3".to_string(), "value3".to_string()),
            ]),
            answer: "".to_string(),
        };
        assert_eq!(None, answers.answer(&question));
    }

    // A "universal answer" with unspecified class+text+data is possible
    #[test]
    fn test_universal_match() {
        let answers = Answers {
            answers: vec![Answer {
                class: None,
                text: None,
                data: None,
                answer: "Yes".into(),
                password: None,
            }],
        };
        let question = GenericQuestion {
            id: 1,
            class: "without_data".to_string(),
            text: "JFYI we will kill all bugs during installation.".to_string(),
            options: vec!["Ok".to_string(), "Cancel".to_string()],
            default_option: "Cancel".to_string(),
            data: HashMap::new(),
            answer: "".to_string(),
        };
        assert_eq!(Some("Yes".to_string()), answers.answer(&question));
    }

    #[test]
    fn test_loading_json() {
        let file = r#"
            {
                "answers": [
                {
                   "class": "without_data",
                   "answer": "OK"
                },
                {
                    "class": "with_data",
                    "data": {
                        "testk": "testv",
                        "testk2": "testv2"
                    },
                    "answer": "Cancel"
                }]
            }
        "#;
        let result: Answers = serde_json::from_str(file).expect("failed to load JSON string");
        assert_eq!(result.answers.len(), 2);
    }
}
