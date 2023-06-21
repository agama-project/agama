use std::collections::HashMap;

/// module holdings data model for agama questions

/// Basic generic question that fits question without special needs
#[derive(Clone, Debug)]
pub struct GenericQuestion {
    /// numeric id used to indetify question on dbus
    pub id: u32,
    /// class of questions. Similar kinds of questions share same class.
    /// It is dot separated list of elements. Examples are 
    /// `storage.luks.actication` or `software.repositories.unknown_gpg`
    pub class: String,
    /// Textual representation of question. Expected to be read by people
    pub text: String,
    /// possible answers for question
    pub options: Vec<String>,
    /// default answer. Can be used as hint or preselection and it is used as answer for unattended questions.
    pub default_option: String,
    /// additional data to help identify questions. Useful for automatic answers. It is question specific.
    pub data: HashMap<String, String>,
    /// Confirmed answer. If empty then not answered yet.
    pub answer: String,
}

impl GenericQuestion {
    pub fn new(id: u32, class: String, text: String, options: Vec<String>, default_option: String, data: HashMap<String, String>) -> Self {
        Self {
            id,
            class,
            text,
            options,
            default_option,
            data,
            answer: String::from(""),
        }
    }

    pub fn object_path(&self) -> String {
        format!("/org/opensuse/Agama/Questions1/{}", self.id)
    }
}

/// Specialized question for Luks partition activation
#[derive(Clone, Debug)]
pub struct LuksQuestion {
    /// Luks password. Empty means no password set.
    pub password: String,
    /// number of previous attempts to decrypt partition
    pub attempt: u8,
    /// rest of question data that is same as for other questions
    pub base: GenericQuestion,
}

impl LuksQuestion {
    fn device_info(device: &str, label: &str, size: &str) -> String {
        let mut result = device.to_string();
        if !label.is_empty() {
            result = format!("{} {}", result, label);
        }

        if !size.is_empty() {
            result = format!("{} ({})", result, size);
        }

        result
    }

    pub fn new(id: u32, class: String, device: String, label: String, size: String, attempt: u8, data: HashMap<String, String>) -> Self {
        let msg = format!(
            "The device {} is encrypted.",
            Self::device_info(device.as_str(), label.as_str(), size.as_str())
        );
        let base = GenericQuestion::new(
            id,
            class,
            msg,
            vec!["skip".to_string(), "decrypt".to_string()],
            "skip".to_string(),
            data,
        );

        Self {
            password: "".to_string(),
            attempt,
            base,
        }
    }
}
