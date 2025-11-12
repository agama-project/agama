use agama_utils::{actor::Handler, api::question::QuestionSpec, progress, question};
use gettextrs::gettext;
use tokio::runtime::Handle;
use zypp_agama::callbacks::pkg_download::{Callback, DownloadError};

struct CommitDownload {
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
}

impl CommitDownload {
    fn new(progress: Handler<progress::Service>, questions: Handler<question::Service>) -> Self {
        Self {
            progress,
            questions,
        }
    }
}

impl Callback for CommitDownload {
    fn start_preload(&self) {
        // TODO: report progress that we start preloading packages
        tracing::info!("Start preload");
    }

    fn problem(
        &self,
        name: &str,
        error: DownloadError,
        description: &str,
    ) -> zypp_agama::callbacks::ProblemResponse {
        // TODO: make it generic for any problemResponse questions
        let labels = [gettext("Retry"), gettext("Ignore")];
        let actions = [("Retry", labels[0].as_str()), ("Ignore", labels[1].as_str())];
        let error_str = error.to_string();
        let data = [("package", name), ("error_code", error_str.as_str())];
        let question = QuestionSpec::new(description, "software.package_error.provide_error")
            .with_actions(&actions)
            .with_data(&data);
        let result = Handle::current().block_on(async move {
            self.questions
                .call(question::message::Ask::new(question))
                .await
        });
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return zypp_agama::callbacks::ProblemResponse::ABORT;
        };

        let Some(answer_str) = answer.answer else {
            tracing::warn!("No answer provided");
            return zypp_agama::callbacks::ProblemResponse::ABORT;
        };

        answer_str
            .action
            .as_str()
            .parse::<zypp_agama::callbacks::ProblemResponse>()
            .unwrap_or(zypp_agama::callbacks::ProblemResponse::ABORT)
    }
}
