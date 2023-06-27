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

/// Composition for questions which include password.
/// TODO: research a bit how ideally do mixins in rust
#[derive(Clone, Debug)]
pub struct WithPassword {
    /// Luks password. Empty means no password set.
    pub password: String,
    /// rest of question data that is same as for other questions
    pub base: GenericQuestion,
}

impl WithPassword {
    pub fn new(base: GenericQuestion) -> Self {
        Self {
            password: "".to_string(),
            base,
        }
    }
}
