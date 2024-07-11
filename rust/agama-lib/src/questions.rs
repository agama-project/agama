//! Data model for Agama questions

use std::collections::HashMap;
pub mod http_client;
pub mod model;

/// Basic generic question that fits question without special needs
/// NOTE: structs below is for dbus usage and holds complete questions data
/// for user side data model see questions::model
#[derive(Clone, Debug)]
pub struct GenericQuestion {
    /// numeric id used to identify question on D-Bus
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
    pub fn new(
        id: u32,
        class: String,
        text: String,
        options: Vec<String>,
        default_option: String,
        data: HashMap<String, String>,
    ) -> Self {
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

    /// Gets object path of given question. It is useful as parameter
    /// for deleting it.
    ///
    /// # Examples
    ///
    /// ```
    ///   use std::collections::HashMap;
    ///   use agama_lib::questions::GenericQuestion;
    ///   let question = GenericQuestion::new(
    ///     2,
    ///     "test_class".to_string(),
    ///     "Really?".to_string(),
    ///     vec!["Yes".to_string(), "No".to_string()],
    ///     "No".to_string(),
    ///     HashMap::new()
    ///   );
    ///   assert_eq!(question.object_path(), "/org/opensuse/Agama1/Questions/2".to_string());
    /// ```
    pub fn object_path(&self) -> String {
        format!("/org/opensuse/Agama1/Questions/{}", self.id)
    }
}

/// Composition for questions which include password.
///
/// ## Extension
/// If there is need to provide more mixins, then this structure does not work
/// well as it is hard do various combinations. Idea is when need for more
/// mixins arise to convert it to Question Struct that have optional mixins
/// inside like
///
/// ```no_compile
/// struct Question {
///   base: GenericQuestion,
///   with_password: Option<WithPassword>,
///   another_mixin: Option<AnotherMixin>
/// }
/// ```
///
/// This way all handling code can check if given mixin is used and
/// act appropriate.
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
