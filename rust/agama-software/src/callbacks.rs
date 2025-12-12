mod commit_download;
use agama_utils::{
    actor::Handler,
    api::question::{Answer, QuestionSpec},
    question::{self, ask_question, AskError},
};
pub use commit_download::CommitDownload;
mod security;
pub use security::Security;
mod install;
pub use install::Install;

fn ask_software_question(
    handler: &Handler<question::Service>,
    question: QuestionSpec,
) -> Result<Answer, AskError> {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    let handler = handler.clone();
    let res = rt.spawn(async move { ask_question(&handler, question).await });
    rt.block_on(res).unwrap()
}
