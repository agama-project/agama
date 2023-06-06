use std::collections::HashMap;

use crate::error::Error;
use agama_lib::connection_to;
use anyhow::Context;
use zbus::{dbus_interface, zvariant::ObjectPath, fdo::ObjectManager, Connection};

#[derive(Clone,Debug)]
pub struct GenericQuestion {
    id: u32,
    text: String,
    options: Vec<String>,
    default_option: String,
    answer: String,
}

impl GenericQuestion {
    pub fn new(id: u32, text: String, options: Vec<String>, default_option: String) -> Self {
        Self {
            id,
            text,
            options,
            default_option,
            answer: String::from("")
        }
    }

    pub fn object_path(&self) -> String {
        format!("/org/opensuse/Agama/Questions1/{}", self.id)
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Questions1.Generic")]
impl GenericQuestion {
    #[dbus_interface(property)]
    pub fn id(&self) -> u32 {
        self.id
    }

    #[dbus_interface(property)]
    pub fn text(&self) -> &str {
        self.text.as_str()
    }

    #[dbus_interface(property)]
    pub fn options(&self) -> Vec<String> {
        self.options.to_owned()
    }

    #[dbus_interface(property)]
    pub fn default_option(&self) -> &str {
        self.default_option.as_str()
    }

    #[dbus_interface(property)]
    pub fn answer(&self) -> &str {
        &self.answer
    }

    #[dbus_interface(property)]
    pub fn set_answer(&mut self, value: &str) -> Result<(), zbus::fdo::Error> {
        // TODO verify if answer exists in options or if it is valid in other way
        self.answer = value.to_string();

        Ok(())
    }
}

#[derive(Clone,Debug)]
pub struct LuksQuestion {
    password: String,
    attempt: u8,
    generic_question: GenericQuestion,
}

impl LuksQuestion {
    fn device_info(device: &str, label: &str, size: &str) -> String{
        let mut result = device.to_string();
        if !label.is_empty() {
            result = format!("{} {}", result, label);
        }

        if !size.is_empty() {
            result = format!("{} ({})", result, size);
        }

        return result.to_string();
    }

    pub fn new(id: u32, device: String, label: String, size: String, attempt: u8) -> Self {
        let msg = format!("The device {} is encrypted.", Self::device_info(device.as_str(), label.as_str(), size.as_str()));
        Self {
            password: "".to_string(),
            attempt,
            generic_question: GenericQuestion::new(id, msg,
                 vec!["skip".to_string(), "decrypt".to_string()],"skip".to_string()),
        }
    }

    pub fn generic_question(&self) -> &GenericQuestion {
        &self.generic_question
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Questions1.LuksActivation")]
impl LuksQuestion {
    #[dbus_interface(property)]
    pub fn luks_password(&self) -> &str {
        self.password.as_str()
    }

    #[dbus_interface(property)]
    pub fn set_luks_password(&mut self, value: &str) -> () {
        self.password = value.to_string();
    }

    #[dbus_interface(property)]
    pub fn activation_attempt(&self) -> u8 {
        self.attempt
    }
}

enum QuestionType {
    Generic,
    Luks
}

pub struct Questions {
    questions: HashMap<u32, QuestionType>,
    connection: Connection,
    last_id: u32
}

#[dbus_interface(name = "org.opensuse.Agama.Questions1")]
impl Questions {
    #[dbus_interface(name = "New")]
    async fn new_question(&mut self, text: &str, options: Vec<&str>, default_option: Vec<&str>) -> Result<ObjectPath, zbus::fdo::Error> {
        let id = self.last_id;
        self.last_id += 1; // TODO use some thread safety
        let options = options.iter().map(|o| o.to_string()).collect();
        let question = GenericQuestion::new(id, text.to_string(), options, default_option.first().unwrap().to_string());
        let object_path = ObjectPath::try_from(question.object_path()).unwrap();
        
        self.connection.object_server().at(question.object_path(), question).await?;
        self.questions.insert(id, QuestionType::Generic);
        Ok(object_path)
    }

    async fn new_luks_activation(&mut self, device: &str, label: &str, size: &str, attempt: u8) -> Result<ObjectPath, zbus::fdo::Error> {
        let id = self.last_id;
        self.last_id += 1; // TODO use some thread safety
        let question = LuksQuestion::new(id, device.to_string(), label.to_string(), size.to_string(), attempt);
        let object_path = ObjectPath::try_from(question.generic_question.object_path()).unwrap();

        self.connection.object_server().at(question.generic_question.object_path(), question.generic_question.clone()).await?;
        self.connection.object_server().at(question.generic_question.object_path(), question).await?;
        
        
        self.questions.insert(id, QuestionType::Luks);
        Ok(object_path)
    }

    async fn delete(&mut self, question: ObjectPath<'_>) -> Result<(), Error>{
        // TODO: error checking
        let id : u32 = question.rsplit("/").next().unwrap().parse().unwrap();
        let qtype = self.questions.get(&id).unwrap();
        match qtype {
            QuestionType::Generic => {
                self.connection.object_server().remove::<GenericQuestion,_>(question.clone()).await?;
            },
            QuestionType::Luks => {
                self.connection.object_server().remove::<GenericQuestion,_>(question.clone()).await?;
                self.connection.object_server().remove::<LuksQuestion,_>(question.clone()).await?;
            },          
        };
        self.questions.remove(&id);
        Ok(())
    }
}

impl Questions {
    fn new(connection: &Connection) -> Self {
        Self {
            questions: HashMap::new(),
            connection: connection.to_owned(),
            last_id: 0
        }
    }
}

pub async fn start_service(address: &str) -> Result<(), Box<dyn std::error::Error>> {
        const SERVICE_NAME: &str = "org.opensuse.Agama.Questions1";
        const SERVICE_PATH: &str = "/org/opensuse/Agama/Questions1";

        // First connect to the Agama bus, then serve our API,
        // for better error reporting.
        let connection = connection_to(address).await?;

        // When serving, request the service name _after_ exposing the main object
        let questions = Questions::new(&connection);
        connection.object_server().at(SERVICE_PATH, questions).await?;
        connection.object_server().at(SERVICE_PATH, ObjectManager).await?;
        connection
            .request_name(SERVICE_NAME)
            .await
            .context(format!("Requesting name {SERVICE_NAME}"))?;

        Ok(())
    }

