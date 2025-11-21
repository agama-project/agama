use agama_utils::{
    actor::Handler,
    api::question::QuestionSpec,
    question::{self, ask_question},
};
use gettextrs::gettext;
use tokio::runtime::Handle;
use zypp_agama::callbacks::security;

#[derive(Clone)]
pub struct Security {
    questions: Handler<question::Service>,
}

impl Security {
    pub fn new(questions: Handler<question::Service>) -> Self {
        Self { questions }
    }
}

impl security::Callback for Security {
    fn unsigned_file(&self, file: String, repository_alias: String) -> bool {
        // TODO: support for extra_repositories with allow_unsigned config
        // TODO: localization for text when parameters in gextext will be solved
        let text = if repository_alias.is_empty() {
            format!(
                "The file {file} is not digitally signed. The origin \
                and integrity of the file cannot be verified. Use it anyway?"
            )
        } else {
            format!(
                "The file {file} from {repository_alias} is not digitally signed. The origin \
                and integrity of the file cannot be verified. Use it anyway?"
            )
        };
        let labels = [gettext("Yes"), gettext("No")];
        let actions = [("Yes", labels[0].as_str()), ("No", labels[1].as_str())];
        let data = [("filename", file.as_str())];
        let question = QuestionSpec::new(&text, "software.unsigned_file")
            .with_actions(&actions)
            .with_data(&data)
            .with_default_action("No");
        let result = Handle::current()
            .block_on(async move { ask_question(&self.questions, question).await });
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return false;
        };

        answer.action == "Yes"
    }

    fn accept_key(
        &self,
        key_id: String,
        key_name: String,
        key_fingerprint: String,
        _repository_alias: String,
    ) -> security::GpgKeyTrust {
        // TODO: support for extra_repositories with specified gpg key checksum
        // TODO: localization with params
        let text = format!(
            "The key {key_id} ({key_name}) with fingerprint {key_fingerprint} is unknown. \
              Do you want to trust this key?"
        );
        let labels = [gettext("Trust"), gettext("Skip")];
        let actions = [("Trust", labels[0].as_str()), ("Skip", labels[1].as_str())];
        let data = [
            ("id", key_id.as_str()),
            ("name", key_name.as_str()),
            ("fingerprint", key_fingerprint.as_str()),
        ];
        let question = QuestionSpec::new(&text, "software.import_gpg")
            .with_actions(&actions)
            .with_data(&data)
            .with_default_action("Skip");
        let result = Handle::current()
            .block_on(async move { ask_question(&self.questions, question).await });
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return security::GpgKeyTrust::Reject;
        };

        answer
            .action
            .as_str()
            .parse::<security::GpgKeyTrust>()
            .unwrap_or(security::GpgKeyTrust::Reject)
    }

    fn unknown_key(&self, file: String, key_id: String, repository_alias: String) -> bool {
        // TODO: localization for text when parameters in gextext will be solved
        let text = if repository_alias.is_empty() {
            format!(
                "The file {file} is digitally signed with \
                the following unknown GnuPG key: {key_id}. Use it anyway?"
            )
        } else {
            format!(
                "The file {file} from {repository_alias} is digitally signed with \
                the following unknown GnuPG key: {key_id}. Use it anyway?"
            )
        };
        let labels = [gettext("Yes"), gettext("No")];
        let actions = [("Yes", labels[0].as_str()), ("No", labels[1].as_str())];
        let data = [("filename", file.as_str()), ("id", key_id.as_str())];
        let question = QuestionSpec::new(&text, "software.unknown_gpg")
            .with_actions(&actions)
            .with_data(&data)
            .with_default_action("No");
        let result = Handle::current()
            .block_on(async move { ask_question(&self.questions, question).await });
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return false;
        };

        answer.action == "Yes"
    }

    fn verification_failed(
        &self,
        file: String,
        key_id: String,
        key_name: String,
        key_fingerprint: String,
        repository_alias: String,
    ) -> bool {
        // TODO: localization for text when parameters in gextext will be solved
        let text = if repository_alias.is_empty() {
            format!(
                "The file {file} is digitally signed with the \
                following GnuPG key, but the integrity check failed: {key_id} ({key_name}). \
                Use it anyway?"
            )
        } else {
            // TODO: Originally it uses repository url and not alias. Does it matter?
            format!(
                "The file {file} from {repository_alias} is digitally signed with the \
                following GnuPG key, but the integrity check failed: {key_id} ({key_name}). \
                Use it anyway?"
            )
        };
        let labels = [gettext("Yes"), gettext("No")];
        let actions = [("Yes", labels[0].as_str()), ("No", labels[1].as_str())];
        let data = [("filename", file.as_str())];
        let question = QuestionSpec::new(&text, "software.verification_failed")
            .with_actions(&actions)
            .with_data(&data)
            .with_default_action("No");
        let result = Handle::current()
            .block_on(async move { ask_question(&self.questions, question).await });
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return false;
        };

        answer.action == "Yes"
    }

    fn checksum_missing(&self, file: String) -> bool {
        // TODO: localization for text when parameters in gextext will be solved
        let text = format!(
            "No checksum for the file {file} was found in the repository. This means that \
              although the file is part of the signed repository, the list of checksums \
              does not mention this file. Use it anyway?"
        );
        let labels = [gettext("Yes"), gettext("No")];
        let actions = [("Yes", labels[0].as_str()), ("No", labels[1].as_str())];
        let question = QuestionSpec::new(&text, "software.digest.no_digest")
            .with_actions(&actions)
            .with_default_action("Yes");
        let result = Handle::current()
            .block_on(async move { ask_question(&self.questions, question).await });
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return false;
        };

        answer.action == "Yes"
    }

    fn checksum_unknown(&self, file: String, checksum: String) -> bool {
        let text = format!(
            "The checksum of the file {file} is \"{checksum}\" but the expected checksum is \
              unknown. This means that the origin and integrity of the file cannot be verified. \
              Use it anyway?"
        );
        let labels = [gettext("Yes"), gettext("No")];
        let actions = [("Yes", labels[0].as_str()), ("No", labels[1].as_str())];
        let question = QuestionSpec::new(&text, "software.digest.unknown_digest")
            .with_actions(&actions)
            .with_default_action("Yes");
        let result = Handle::current()
            .block_on(async move { ask_question(&self.questions, question).await });
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return false;
        };

        answer.action == "Yes"
    }

    fn checksum_wrong(&self, file: String, expected: String, actual: String) -> bool {
        let text = format!(
            "The expected checksum of file %{file} is \"%{actual}\" but it was expected to be \
              \"%{expected}\". The file has changed by accident or by an attacker since the \
              creater signed it. Use it anyway?"
        );
        let labels = [gettext("Yes"), gettext("No")];
        let actions = [("Yes", labels[0].as_str()), ("No", labels[1].as_str())];
        let question = QuestionSpec::new(&text, "software.digest.unknown_digest")
            .with_actions(&actions)
            .with_default_action("Yes");
        let result = Handle::current()
            .block_on(async move { ask_question(&self.questions, question).await });
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return false;
        };

        answer.action == "Yes"
    }
}
