use agama_utils::{actor::Handler, api::question::QuestionSpec, progress, question};
use tokio::runtime::Handle;
use zypp_agama::callbacks::PkgDownloadCallbacks;

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

impl PkgDownloadCallbacks for CommitDownload {
    fn start_preload(&self) {
        // TODO: report progress that we start preloading packages
        tracing::info!("Start preload");
    }

    fn problem(
        &self,
        name: &str,
        error: zypp_agama::callbacks::DownloadResolvableError,
        description: &str,
    ) -> zypp_agama::callbacks::ProblemResponse {
        // TODO: make it generic for any problem questions
        // TODO: localization
        let actions = [("Retry", "Retry"), ("Ignore", "Ignore")];
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
        // TODO: add to ProblemResolve enum also from_str method
        answer_str
            .action
            .as_str()
            .parse::<zypp_agama::callbacks::ProblemResponse>()
            .unwrap_or(zypp_agama::callbacks::ProblemResponse::ABORT)
    }
}
