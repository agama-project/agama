use agama_utils::{
    actor::Handler,
    api::question::QuestionSpec,
    progress,
    question::{self},
};
use gettextrs::gettext;
use zypp_agama::callbacks::{install, ProblemResponse};

use crate::callbacks::ask_software_question;

#[derive(Clone)]
pub struct Install {
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
}

impl Install {
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

impl install::Callback for Install {
    fn package_start(&self, package_name: String) {
        tracing::info!("Installing package {}", package_name);
        // TODO: report progress
    }

    fn package_problem(
        &self,
        package_name: String,
        error: install::InstallError,
        description: String,
    ) -> ProblemResponse {
        tracing::error!(
            "Problem installing package {}: {} - {}",
            package_name,
            error,
            description
        );

        // TODO: add abort when it is properly handled in UI/backend
        let labels = [gettext("Retry"), gettext("Ignore")];
        let actions = [
            ("Retry", labels[0].as_str()),
            ("Ignore", labels[1].as_str()),
        ];
        let question = QuestionSpec::new(&description, "software.package_error.install_error")
            .with_actions(&actions)
            .with_data(&[("package", package_name.as_str())]);

        let result = ask_software_question(&self.questions, question);
        let Ok(answer) = result else {
            tracing::warn!(
                "Failed to ask question about package install error: {:?}",
                result
            );
            return ProblemResponse::ABORT;
        };

        answer
            .action
            .as_str()
            .parse()
            .unwrap_or(ProblemResponse::ABORT)
    }

    fn script_problem(&self, description: String) -> ProblemResponse {
        tracing::error!("Problem running install script: {}", description);

        let labels = [gettext("Retry"), gettext("Continue")];
        let actions = [
            ("Retry", labels[0].as_str()),
            ("Continue", labels[1].as_str()),
        ];
        let message = gettext("There was a problem running a package script.");
        let full_message = message + "\n\n" + &description;
        let question = QuestionSpec::new(&full_message, "software.script_problem")
            .with_actions(&actions)
            .with_data(&[("details", &description)]);

        let result = ask_software_question(&self.questions, question);
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question about script problem: {:?}", result);
            return ProblemResponse::ABORT;
        };

        match answer.action.as_str() {
            "Retry" => ProblemResponse::RETRY,
            "Continue" => ProblemResponse::IGNORE,
            _ => {
                tracing::warn!("Unknown action {:?}", answer.action);
                ProblemResponse::ABORT
            }
        }
    }

    fn package_finish(&self, package_name: String) {
        tracing::info!("Finished installing package {}", package_name);
        // TODO: report progress
    }
}
