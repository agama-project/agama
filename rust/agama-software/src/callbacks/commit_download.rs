use agama_utils::{
    actor::Handler,
    api::question::QuestionSpec,
    progress,
    question::{self, ask_question},
};
use gettextrs::gettext;
use tokio::runtime::Handle;
use zypp_agama::callbacks::pkg_download::{Callback, DownloadError};

#[derive(Clone)]
pub struct CommitDownload {
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
}

impl CommitDownload {
    pub fn new(
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
    ) -> Self {
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
        name: String,
        error: DownloadError,
        description: String,
    ) -> zypp_agama::callbacks::ProblemResponse {
        // TODO: make it generic for any problemResponse questions
        // TODO: we need support for abort and make it default action
        let labels = [gettext("Retry"), gettext("Ignore")];
        let actions = [
            ("Retry", labels[0].as_str()),
            ("Ignore", labels[1].as_str()),
        ];
        let error_str = error.to_string();
        let data = [
            ("package", name.as_str()),
            ("error_code", error_str.as_str()),
        ];
        let question =
            QuestionSpec::new(description.as_str(), "software.package_error.provide_error")
                .with_actions(&actions)
                .with_data(&data);
        let result = Handle::current()
            .block_on(async move { ask_question(&self.questions, question).await });
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return zypp_agama::callbacks::ProblemResponse::ABORT;
        };

        answer
            .action
            .as_str()
            .parse::<zypp_agama::callbacks::ProblemResponse>()
            .unwrap_or(zypp_agama::callbacks::ProblemResponse::ABORT)
    }

    fn gpg_check(
        &self,
        resolvable_name: String,
        _repo_url: String,
        check_result: zypp_agama::callbacks::pkg_download::GPGCheckResult,
    ) -> Option<zypp_agama::callbacks::ProblemResponse> {
        if check_result == zypp_agama::callbacks::pkg_download::GPGCheckResult::Ok {
            // GPG is happy, so we are also happy and lets just continue
            return None;
        }

        // do not log URL here as it can contain sensitive info and it is visible from other logs
        tracing::warn!(
            "GPG check failed for {:?} with {:?}",
            resolvable_name,
            check_result
        );

        // TODO: implement the DUD case:
        // DUD (Driver Update Disk)
        // ignore the error when the package comes from the DUD repository and
        // the DUD package GPG checks are disabled via a boot option
        //
        // if repo_url == Agama::Software::Manager.dud_repository_url && ignore_dud_packages_gpg_errors? {
        //   logger.info "Ignoring the GPG check failure for a DUD package"
        //   return Ok(ProblemResponse::IGNORE);
        // }

        None
    }
}
