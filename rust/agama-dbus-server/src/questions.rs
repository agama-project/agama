use std::{result, fmt::format};

use crate::error::Error;
use agama_lib::connection_to;
use anyhow::Context;
use zbus::{dbus_interface, zvariant::ObjectPath, fdo::ObjectManager, Connection};

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

pub struct QuestionsService {
    questions: Vec<String>,
    connection: Connection,
}

#[dbus_interface(name = "org.opensuse.Agama.Questions1")]
impl QuestionsService {
    #[dbus_interface(name = "New")]
    fn new_question(&self, text: &str, options: Vec<&str>, default_option: Vec<&str>) -> Result<ObjectPath, Error> {
        // TODO: implement it
        // TODO: why default option is array? Taken from old service in ruby
        Ok(ObjectPath::from_static_str("TODO").unwrap())
    }

    fn new_luks_activation(&self, device: &str, label: &str, size: &str, attempt: u8) -> Result<ObjectPath, Error> {
        // TODO: implement it
        Ok(ObjectPath::from_static_str("TODO").unwrap())
    }

    fn delete(&self, question: ObjectPath) -> Result<(), Error>{
        // TODO: implement it
        Ok(())
    }
}

impl QuestionsService {
    fn new(connection: &Connection) -> Self {
        Self {
            questions: vec![],
            connection: connection.to_owned(),
        }
    }

    pub async fn start(address: &str) -> Result<(), Box<dyn std::error::Error>> {
        const SERVICE_NAME: &str = "org.opensuse.Agama.Questions1";
        const SERVICE_PATH: &str = "/org/opensuse/Agama/Questions1";

        // First connect to the Agama bus, then serve our API,
        // for better error reporting.
        let connection = connection_to(address).await?;

        // When serving, request the service name _after_ exposing the main object
        let questions = Self::new(&connection);
        connection.object_server().at(SERVICE_PATH, questions).await?;
        connection.object_server().at(SERVICE_PATH, ObjectManager).await?;
        connection
            .request_name(SERVICE_NAME)
            .await
            .context(format!("Requesting name {SERVICE_NAME}"))?;

        Ok(())
    }
}
