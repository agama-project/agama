use crate::error::Error;
use agama_lib::connection_to;
use anyhow::Context;
use zbus::{dbus_interface, zvariant::ObjectPath, fdo::ObjectManager};

pub struct QuestionsService {
    questions: Vec<String>,
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
    fn new() -> Self {
        Self {
            questions: vec![],
        }
    }

    pub async fn start(address: &str) -> Result<(), Box<dyn std::error::Error>> {
        const SERVICE_NAME: &str = "org.opensuse.Agama.Questions1";
        const SERVICE_PATH: &str = "/org/opensuse/Agama/Questions1";

        // First connect to the Agama bus, then serve our API,
        // for better error reporting.
        let connection = connection_to(address).await?;

        // When serving, request the service name _after_ exposing the main object
        let questions = Self::new();
        connection.object_server().at(SERVICE_PATH, questions).await?;
        connection.object_server().at(SERVICE_PATH, ObjectManager).await?;
        connection
            .request_name(SERVICE_NAME)
            .await
            .context(format!("Requesting name {SERVICE_NAME}"))?;

        Ok(())
    }
}
