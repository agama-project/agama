use std::collections::HashMap;

use crate::error::Error;
use log;
use agama_lib::{connection_to,questions::{self, GenericQuestion}};
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
    pub fn text(&self) -> &str {
        self.0.text.as_str()
    }

    #[dbus_interface(property)]
    pub fn options(&self) -> Vec<String> {
        self.0.options.to_owned()
    }

    #[dbus_interface(property)]
    pub fn default_option(&self) -> &str {
        self.0.default_option.as_str()
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

struct LuksQuestionObject(questions::LuksQuestion);

#[dbus_interface(name = "org.opensuse.Agama.Questions1.LuksActivation")]
impl LuksQuestionObject {
    #[dbus_interface(property)]
    pub fn password(&self) -> &str {
        self.0.password.as_str()
    }

    #[dbus_interface(property)]
    pub fn set_password(&mut self, value: &str) -> () {
        self.0.password = value.to_string();
    }

    #[dbus_interface(property)]
    pub fn attempt(&self) -> u8 {
        self.0.attempt
    }
}

/// Question types used to be able to properly remove object from dbus
enum QuestionType {
    Generic,
    Luks,
}

trait AnswerStrategy {
    /// TODO: find way to be able to answer any type of question, not just generic
    fn answer(&self, question: &GenericQuestion) -> Option<String>;
}

struct DefaultAnswers;

impl AnswerStrategy for DefaultAnswers {
    fn answer(&self, question: &GenericQuestion) -> Option<String> {
        return Some(question.default_option.clone())
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
        // TODO: enforce default option and do not use array for it to avoid that unwrap
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
        self.questions.insert(id, QuestionType::Generic);
        Ok(object_path)
    }

    /// creates new specialized luks activation question without answer and password
    async fn new_luks_activation(
        &mut self,
        device: &str,
        label: &str,
        size: &str,
        attempt: u8,
        data: HashMap<String, String>,
    ) -> Result<ObjectPath, zbus::fdo::Error> {
        let id = self.last_id;
        self.last_id += 1; // TODO use some thread safety
        let question = questions::LuksQuestion::new(
            id,
            "storage.encryption.activation".to_string(),
            device.to_string(),
            label.to_string(),
            size.to_string(),
            attempt,
            data
        );
        let object_path = ObjectPath::try_from(question.base.object_path()).unwrap();

        let mut base_question = question.base.clone();
        self.fill_answer(&mut base_question);
        let base_object = GenericQuestionObject(base_question);
        
        self.connection
            .object_server()
            .at(object_path.clone(), LuksQuestionObject(question))
            .await?;
        // NOTE: order here is important as each interface cause signal, so frontend should wait only for GenericQuestions
        // which should be the last interface added
        self.connection
            .object_server()
            .at(object_path.clone(), base_object)
            .await?;

        self.questions.insert(id, QuestionType::Luks);
        Ok(object_path)
    }

    /// Removes question at given object path
    async fn delete(&mut self, question: ObjectPath<'_>) -> Result<(), Error> {
        // TODO: error checking
        let id: u32 = question.rsplit("/").next().unwrap().parse().unwrap();
        let qtype = self.questions.get(&id).unwrap();
        match qtype {
            QuestionType::Generic => {
                self.connection
                    .object_server()
                    .remove::<GenericQuestionObject, _>(question.clone())
                    .await?;
            }
            QuestionType::Luks => {
                self.connection
                    .object_server()
                    .remove::<GenericQuestionObject, _>(question.clone())
                    .await?;
                self.connection
                    .object_server()
                    .remove::<LuksQuestionObject, _>(question.clone())
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
