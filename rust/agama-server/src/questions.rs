use std::collections::HashMap;

use agama_lib::questions::{self, GenericQuestion, WithPassword};
use log;
use zbus::{dbus_interface, fdo::ObjectManager, zvariant::ObjectPath, Connection};

mod answers;
pub mod web;

#[derive(thiserror::Error, Debug)]
pub enum QuestionsError {
    #[error("Could not read the answers file: {0}")]
    IO(std::io::Error),
    #[error("Could not deserialize the answers file: {0}")]
    Deserialize(serde_yaml::Error),
}

#[derive(Clone, Debug)]
struct GenericQuestionObject(questions::GenericQuestion);

#[dbus_interface(name = "org.opensuse.Agama1.Questions.Generic")]
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
        self.0.default_option.as_str()
    }

    #[dbus_interface(property)]
    pub fn answer(&self) -> &str {
        &self.0.answer
    }

    #[dbus_interface(property)]
    pub fn set_answer(&mut self, value: &str) -> zbus::fdo::Result<()> {
        // TODO verify if answer exists in options or if it is valid in other way
        self.0.answer = value.to_string();

        Ok(())
    }
}

/// Mixin interface for questions that are base + contain question for password
struct WithPasswordObject(questions::WithPassword);

#[dbus_interface(name = "org.opensuse.Agama1.Questions.WithPassword")]
impl WithPasswordObject {
    #[dbus_interface(property)]
    pub fn password(&self) -> &str {
        self.0.password.as_str()
    }

    #[dbus_interface(property)]
    pub fn set_password(&mut self, value: &str) {
        self.0.password = value.to_string();
    }
}

/// Question types used to be able to properly remove object from dbus
enum QuestionType {
    Base,
    BaseWithPassword,
}

/// Trait for objects that can provide answers to all kind of Question.
///
/// If no strategy is selected or the answer is unknown, then ask to the user.
trait AnswerStrategy {
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

/// AnswerStrategy that provides as answer the default option.
struct DefaultAnswers;

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

pub struct Questions {
    questions: HashMap<u32, QuestionType>,
    connection: Connection,
    last_id: u32,
    answer_strategies: Vec<Box<dyn AnswerStrategy + Sync + Send>>,
}

#[dbus_interface(name = "org.opensuse.Agama1.Questions")]
impl Questions {
    /// creates new generic question without answer
    #[dbus_interface(name = "New")]
    async fn new_question(
        &mut self,
        class: &str,
        text: &str,
        options: Vec<&str>,
        default_option: &str,
        data: HashMap<String, String>,
    ) -> zbus::fdo::Result<ObjectPath> {
        log::info!("Creating new question with text: {}.", text);
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
        data: HashMap<String, String>,
    ) -> zbus::fdo::Result<ObjectPath> {
        log::info!("Creating new question with password with text: {}.", text);
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
        let mut question = questions::WithPassword::new(base);
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
    /// TODO: use id as parameter ( need at first check other users of method )
    async fn delete(&mut self, question: ObjectPath<'_>) -> zbus::fdo::Result<()> {
        // TODO: error checking
        let id: u32 = question.rsplit('/').next().unwrap().parse().unwrap();
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

    /// property that defines if questions is interactive or automatically answered with
    /// default answer
    #[dbus_interface(property)]
    fn interactive(&self) -> bool {
        let last = self.answer_strategies.last();
        if let Some(real_strategy) = last {
            real_strategy.id() != DefaultAnswers::id()
        } else {
            true
        }
    }

    #[dbus_interface(property)]
    fn set_interactive(&mut self, value: bool) {
        if value != self.interactive() {
            log::info!("interactive value unchanged - {}", value);
            return;
        }

        log::info!("set interactive to {}", value);
        if value {
            self.answer_strategies.pop();
        } else {
            self.answer_strategies.push(Box::new(DefaultAnswers {}));
        }
    }

    fn add_answer_file(&mut self, path: String) -> zbus::fdo::Result<()> {
        log::info!("Adding answer file {}", path);
        let answers = answers::Answers::new_from_file(path.as_str())
            .map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;
        self.answer_strategies.push(Box::new(answers));
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
    ///
    /// What happens under the hood is that it uses answer_strategies vector
    /// and try to find the first strategy that provides answer. When
    /// answer is provided, it returns immediately.
    fn fill_answer(&self, question: &mut GenericQuestion) {
        for strategy in self.answer_strategies.iter() {
            match strategy.answer(question) {
                None => (),
                Some(answer) => {
                    question.answer = answer;
                    return;
                }
            }
        }
    }

    /// tries to provide answer to question using answer strategies
    ///
    /// What happens under the hood is that it uses answer_strategies vector
    /// and try to find the first strategy that provides answer. When
    /// answer is provided, it returns immediately.
    fn fill_answer_with_password(&self, question: &mut WithPassword) {
        for strategy in self.answer_strategies.iter() {
            let (answer, password) = strategy.answer_with_password(question);
            if let Some(password) = password {
                question.password = password;
            }
            if let Some(answer) = answer {
                question.base.answer = answer;
                return;
            }
        }
    }
}

/// Starts questions dbus service together with Object manager
pub async fn export_dbus_objects(
    connection: &Connection,
) -> Result<(), Box<dyn std::error::Error>> {
    const PATH: &str = "/org/opensuse/Agama1/Questions";

    // When serving, request the service name _after_ exposing the main object
    let questions = Questions::new(connection);
    connection.object_server().at(PATH, questions).await?;
    connection.object_server().at(PATH, ObjectManager).await?;

    Ok(())
}
