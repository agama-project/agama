use std::collections::HashMap;

use anyhow::Context;
use serde::{Deserialize, Serialize};

/// Data structure for single yaml answer. For variables specification see
/// corresponding GenericQuestion fields.
#[derive(Serialize, Deserialize, PartialEq, Debug)]
struct Answer {
    pub class: Option<String>,
    pub text: Option<String>,
    pub data: Option<HashMap<String, String>>,
    pub answer: String,           // answer text is only mandatory part of answer
    pub password: Option<String>, // all possible mixins have to be here, so can be specified in answer
}

/// Data structure holding list of Answer.
#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct Answers {
    list: Vec<Answer>,
}

impl Answers {
    pub fn new_from_file(path: &str) -> anyhow::Result<Self> {
        let f = std::fs::File::open(path).context(format!("Failed to open {}", path))?;
        let result: Self =
            serde_yaml::from_reader(f).context(format!("Failed to parse values at {}", path))?;

        Ok(result)
    }

    pub fn id() -> u8 {
        2
    }

    fn find_answer(&self, question: &agama_lib::questions::GenericQuestion) -> Option<&Answer> {
        'main: for answerd in self.list.iter() {
            if let Some(v) = &answerd.class {
                if !question.class.eq(v) {
                    continue;
                }
            }
            if let Some(v) = &answerd.text {
                if !question.text.eq(v) {
                    continue;
                }
            }
            if let Some(v) = &answerd.data {
                for (key, value) in v {
                    // all keys defined in answer has to match
                    let entry = question.data.get(key);
                    if let Some(e_val) = entry {
                        if !e_val.eq(value) {
                            continue 'main;
                        }
                    } else {
                        continue 'main;
                    }
                }
            }

            return Some(answerd);
        }

        None
    }
}

impl crate::questions::AnswerStrategy for Answers {
    fn id(&self) -> u8 {
        Answers::id()
    }

    fn answer(&self, question: &agama_lib::questions::GenericQuestion) -> Option<String> {
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
