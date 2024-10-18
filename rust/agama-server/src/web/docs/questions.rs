use utoipa::openapi::{Components, ComponentsBuilder, Paths, PathsBuilder};

use super::ApiDocBuilder;

pub struct QuestionsApiDocBuilder;

impl ApiDocBuilder for QuestionsApiDocBuilder {
    fn title(&self) -> String {
        "Questions HTTP API".to_string()
    }
    fn paths(&self) -> Paths {
        PathsBuilder::new()
            .path_from::<crate::questions::web::__path_answer_question>()
            .path_from::<crate::questions::web::__path_create_question>()
            .path_from::<crate::questions::web::__path_delete_question>()
            .path_from::<crate::questions::web::__path_get_answer>()
            .path_from::<crate::questions::web::__path_list_questions>()
            .build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new()
            .schema_from::<agama_lib::questions::model::Answer>()
            .schema_from::<agama_lib::questions::model::GenericAnswer>()
            .schema_from::<agama_lib::questions::model::GenericQuestion>()
            .schema_from::<agama_lib::questions::model::PasswordAnswer>()
            .schema_from::<agama_lib::questions::model::Question>()
            .schema_from::<agama_lib::questions::model::QuestionWithPassword>()
            .build()
    }
}
