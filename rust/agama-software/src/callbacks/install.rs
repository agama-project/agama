use agama_utils::{
    actor::Handler,
    api::{question::QuestionSpec, Scope},
    progress,
    question::{self},
};
use gettextrs::gettext;
use zypp_agama::callbacks::{install, ProblemResponse};

use crate::callbacks::ask_software_question;
use agama_l10n::helpers::gettext_noop;

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
        let msg = format!("Installing {}", package_name);
        // just ignore issues with reporting progress
        let _ = self
            .progress
            .cast(progress::message::NextWithStep::new(Scope::Software, &msg));
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

        let question = QuestionSpec::new(&description, "software.package_error.install_error")
            // TODO: add abort when it is properly handled in UI/backend
            .with_action_ids(&[gettext_noop("Retry"), gettext_noop("Ignore")])
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

        let message = gettext("There was a problem running a package script.");
        let full_message = message + "\n\n" + &description;
        let question = QuestionSpec::new(&full_message, "software.script_problem")
            .with_action_ids(&[gettext_noop("Retry"), gettext_noop("Continue")])
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
    }
}
