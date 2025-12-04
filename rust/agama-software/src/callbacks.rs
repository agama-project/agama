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
use std::sync::mpsc;
use tokio::runtime::Builder;

fn ask_software_question(
    handler: &Handler<question::Service>,
    question: QuestionSpec,
) -> Result<Answer, AskError> {
    let (tx, rx) = mpsc::channel();
    let question_handler = handler.clone();
    std::thread::spawn(move || {
        let runtime = Builder::new_current_thread().enable_all().build().unwrap();
        let result =
            runtime.block_on(async move { ask_question(&question_handler, question).await });
        // unwrap OK: the receiver should not be dropped before the thread finishes
        tx.send(result).unwrap();
    });
    // unwrap OK: the sender should not be dropped before sending a value
    rx.recv().unwrap()
}
