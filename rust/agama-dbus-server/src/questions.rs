use std::collections::HashMap;

use crate::error::Error;
use log;
use agama_lib::{connection_to,questions::{self, GenericQuestion, WithPassword}};
use anyhow::Context;
use zbus::{dbus_interface, fdo::ObjectManager, zvariant::ObjectPath, Connection};

#[derive(Clone, Debug)]
struct GenericQuestionObject(questions::GenericQuestion);

#[dbus_interface(name = "org.opensuse.Agama.Questions1.Generic")]
impl GenericQuestionObject {
    #[dbus_interface(property)]
    pub fn id(&self) -> u32 {
        self.0.id
    }

    #[dbus_interface(property)]
    pub fn class(&self) -> &str {
        &self.0.class
    }

    #[dbus_interface(property)]
    pub fn data(&self) -> HashMap<String, String> {
        self.0.data.to_owned()
    }

    #[dbus_interface(property)]
    pub fn text(&self) -> &str {
        self.0.text.as_str()
    }

    #[dbus_interface(property)]
    pub fn options(&self) -> Vec<String> {
        self.0.options.to_owned()
    }

    #[dbus_interface(property)]
    pub fn default_option(&self) -> &str {
        match self.default_option {
            Some(ref option) => option.as_str(),
            None => "",
        }
    }

    #[dbus_interface(property)]
    pub fn answer(&self) -> &str {
        &self.0.answer
    }

    #[dbus_interface(property)]
    pub fn set_answer(&mut self, value: &str) -> Result<(), zbus::fdo::Error> {
        // TODO verify if answer exists in options or if it is valid in other way
        self.0.answer = value.to_string();

        Ok(())
    }
}

/// Mixin interface for questions that are base + contain question for password
struct WithPasswordObject(questions::WithPassword);

#[dbus_interface(name = "org.opensuse.Agama.Questions1.WithPassword")]
impl WithPasswordObject {
    #[dbus_interface(property)]
    pub fn password(&self) -> &str {
        self.0.password.as_str()
    }

    #[dbus_interface(property)]
    pub fn set_password(&mut self, value: &str) -> () {
        self.0.password = value.to_string();
    }
}

/// Question types used to be able to properly remove object from dbus
enum QuestionType {
    Base,
    BaseWithPassword,
}

trait AnswerStrategy {
    /// Provides answer for generic question
    fn answer(&self, question: &GenericQuestion) -> Option<String>;
    /// Provides answer and password for base question with password
    fn answer_with_password(&self, question: &WithPassword) -> (Option<String>, Option<String>);
}

struct DefaultAnswers;

impl AnswerStrategy for DefaultAnswers {
    fn answer(&self, question: &GenericQuestion) -> Option<String> {
        return Some(question.default_option.clone())
    }

    fn answer_with_password(&self, question: &WithPassword) -> (Option<String>, Option<String>) {
        return (Some(question.base.default_option.clone()), None)
    }
}

pub struct Questions {
    questions: HashMap<u32, QuestionType>,
    connection: Connection,
    last_id: u32,
    answer_strategies: Vec<Box<dyn AnswerStrategy + Sync + Send>>
}

#[dbus_interface(name = "org.opensuse.Agama.Questions1")]
impl Questions {
    /// creates new generic question without answer
    #[dbus_interface(name = "New")]
    async fn new_question(
        &mut self,
        class: &str,
        text: &str,
        options: Vec<&str>,
        default_option: &str,
        data: HashMap<String, String>
    ) -> Result<ObjectPath, zbus::fdo::Error> {
        let id = self.last_id;
        self.last_id += 1; // TODO use some thread safety
        let options = options.iter().map(|o| o.to_string()).collect();
        let mut question = questions::GenericQuestion::new(
            id,
            class.to_string(),
            text.to_string(),
            options,
            default_option.to_string(),
            data,
        );
        self.fill_answer(&mut question);
        let object_path = ObjectPath::try_from(question.object_path()).unwrap();
        let question_object = GenericQuestionObject(question);

        self.connection
            .object_server()
            .at(object_path.clone(), question_object)
            .await?;
        self.questions.insert(id, QuestionType::Base);
        Ok(object_path)
    }

    /// creates new specialized luks activation question without answer and password
    async fn new_with_password(
        &mut self,
        class: &str,
        text: &str,
        options: Vec<&str>,
        default_option: &str,
        data: HashMap<String, String>
    ) -> Result<ObjectPath, zbus::fdo::Error> {
        let id = self.last_id;
        self.last_id += 1; // TODO use some thread safety
        // TODO: share code better
        let options = options.iter().map(|o| o.to_string()).collect();
        let base = questions::GenericQuestion::new(
            id,
            class.to_string(),
            text.to_string(),
            options,
            default_option.to_string(),
            data,
        );
        let mut question = questions::WithPassword::new(
            base
        );
        let object_path = ObjectPath::try_from(question.base.object_path()).unwrap();

        let base_question = question.base.clone();
        self.fill_answer_with_password(&mut question);
        let base_object = GenericQuestionObject(base_question);
        
        self.connection
            .object_server()
            .at(object_path.clone(), WithPasswordObject(question))
            .await?;
        // NOTE: order here is important as each interface cause signal, so frontend should wait only for GenericQuestions
        // which should be the last interface added
        self.connection
            .object_server()
            .at(object_path.clone(), base_object)
            .await?;

        self.questions.insert(id, QuestionType::BaseWithPassword);
        Ok(object_path)
    }

    /// Removes question at given object path
    async fn delete(&mut self, question: ObjectPath<'_>) -> Result<(), Error> {
        // TODO: error checking
        let id: u32 = question.rsplit("/").next().unwrap().parse().unwrap();
        let qtype = self.questions.get(&id).unwrap();
        match qtype {
            QuestionType::Base => {
                self.connection
                    .object_server()
                    .remove::<GenericQuestionObject, _>(question.clone())
                    .await?;
            }
            QuestionType::BaseWithPassword => {
                self.connection
                    .object_server()
                    .remove::<GenericQuestionObject, _>(question.clone())
                    .await?;
                self.connection
                    .object_server()
                    .remove::<WithPasswordObject, _>(question.clone())
                    .await?;
            }
        };
        self.questions.remove(&id);
        Ok(())
    }

    /// sets questions to be answered by default answer instead of asking user
    async fn use_default_answer(&mut self) -> Result<(), Error> {
        log::info!("Answer questions with default option");
        self.answer_strategies.push(Box::new(DefaultAnswers{}));
        Ok(())
    }
}

impl Questions {
    /// Creates new questions interface with clone of connection to be able to
    /// attach or detach question objects
    fn new(connection: &Connection) -> Self {
        Self {
            questions: HashMap::new(),
            connection: connection.to_owned(),
            last_id: 0,
            answer_strategies: vec![],
        }
    }

    /// tries to provide answer to question using answer strategies
    fn fill_answer(&self, question: &mut GenericQuestion) -> () {
        for strategy in self.answer_strategies.iter() {
            match strategy.answer(question) {
                None => (),
                Some(answer) => question.answer = answer,
            }
        }
    }

        /// tries to provide answer to question using answer strategies
        fn fill_answer_with_password(&self, question: &mut WithPassword) -> () {
            for strategy in self.answer_strategies.iter() {
                let (answer, password) = strategy.answer_with_password(question);
                if let Some(password) = password {
                    question.password = password;
                }
                if let Some(answer) = answer {
                    question.base.answer = answer;
                }
            }
        }
}

/// Starts questions dbus service together with Object manager
pub async fn start_service(address: &str) -> Result<(), Box<dyn std::error::Error>> {
    const SERVICE_NAME: &str = "org.opensuse.Agama.Questions1";
    const SERVICE_PATH: &str = "/org/opensuse/Agama/Questions1";

    // First connect to the Agama bus, then serve our API,
    // for better error reporting.
    let connection = connection_to(address).await?;

    // When serving, request the service name _after_ exposing the main object
    let questions = Questions::new(&connection);
    connection
        .object_server()
        .at(SERVICE_PATH, questions)
        .await?;
    connection
        .object_server()
        .at(SERVICE_PATH, ObjectManager)
        .await?;
    connection
        .request_name(SERVICE_NAME)
        .await
        .context(format!("Requesting name {SERVICE_NAME}"))?;

    Ok(())
}
