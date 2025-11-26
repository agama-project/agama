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
use tokio::runtime::Handle;

fn ask_software_question(
    handler: &Handler<question::Service>,
    question: QuestionSpec,
) -> Result<Answer, AskError> {
    Handle::current().block_on(async move { ask_question(handler, question).await })
}
