use utoipa::openapi::{ComponentsBuilder, OpenApi, OpenApiBuilder, PathsBuilder};

pub struct QuestionsApiDocBuilder;

impl QuestionsApiDocBuilder {
    pub fn build() -> OpenApi {
        let paths = PathsBuilder::new()
            .path_from::<crate::questions::web::__path_answer_question>()
            .path_from::<crate::questions::web::__path_create_question>()
            .path_from::<crate::questions::web::__path_delete_question>()
            .path_from::<crate::questions::web::__path_get_answer>()
            .path_from::<crate::questions::web::__path_list_questions>()
            .build();

        let components = ComponentsBuilder::new()
            .schema_from::<agama_lib::questions::model::Answer>()
            .schema_from::<agama_lib::questions::model::GenericAnswer>()
            .schema_from::<agama_lib::questions::model::GenericQuestion>()
            .schema_from::<agama_lib::questions::model::PasswordAnswer>()
            .schema_from::<agama_lib::questions::model::Question>()
            .schema_from::<agama_lib::questions::model::QuestionWithPassword>()
            .build();

        OpenApiBuilder::new()
            .paths(paths)
            .components(Some(components))
            .build()
    }
}
