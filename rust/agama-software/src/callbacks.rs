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
        // unwrap OK: fails only when OS resource limits exhausted anyway
        let runtime = Builder::new_current_thread().enable_all().build().unwrap();
        let result =
            runtime.block_on(async move { ask_question(&question_handler, question).await });
        // unwrap OK: rx.recv() does happen
        tx.send(result).unwrap();
    });
    // unwrap OK: tx.send() does happen
    rx.recv().unwrap()
}
