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

pub fn ask_software_question(
    handler: &Handler<question::Service>,
    question: QuestionSpec,
) -> Result<Answer, AskError> {
    // unwrap OK: unwrap is fine as if we eat all IO resources, we are doomed, so failing is good solution
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    let handler = handler.clone();
    let res = rt.spawn(async move { ask_question(&handler, question).await });
    // unwrap OK: if asking question lead to panic, then we do not have good way to continue and also stop.
    rt.block_on(res).unwrap()
}
