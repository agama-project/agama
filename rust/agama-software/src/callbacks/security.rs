use agama_l10n::helpers::gettext_noop;
use agama_utils::{actor::Handler, api::question::QuestionSpec, question};
use i18n_format::i18n_format;
use zypp_agama::callbacks::security;

use crate::callbacks::ask_software_question;

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
        tracing::info!(
            "unsigned_file callback: file='{}', repository_alias='{}'",
            file,
            repository_alias
        );
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
        let question = QuestionSpec::new(&text, "software.unsigned_file")
            .with_yes_no_actions()
            .with_data(&[("filename", file.as_str())]);
        let result = ask_software_question(&self.questions, question);
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
        tracing::info!(
            "accept_key callback: key_id='{}', key_name='{}', key_fingerprint='{}'",
            key_id,
            key_name,
            key_fingerprint,
        );
        // TODO: support for extra_repositories with specified gpg key checksum
        let text = i18n_format!(
            // TRANSLATORS: substituting: key ID, (key name), fingerprint
            "The key {0} ({1}) with fingerprint {2} is unknown. \
              Do you want to trust this key?",
            &key_id,
            &key_name,
            &key_fingerprint
        );
        let question = QuestionSpec::new(&text, "software.import_gpg")
            .with_action_ids(&[gettext_noop("Trust"), gettext_noop("Skip")])
            .with_data(&[
                ("id", key_id.as_str()),
                ("name", key_name.as_str()),
                ("fingerprint", key_fingerprint.as_str()),
            ])
            .with_default_action("Skip");
        let result = ask_software_question(&self.questions, question);
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
        tracing::info!(
            "unknown_key callback: file='{}', key_id='{}', repository_alias='{}'",
            file,
            key_id,
            repository_alias
        );
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
        let question = QuestionSpec::new(&text, "software.unknown_gpg")
            .with_yes_no_actions()
            .with_data(&[("filename", file.as_str()), ("id", key_id.as_str())]);
        let result = ask_software_question(&self.questions, question);
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
        _key_fingerprint: String,
        repository_alias: String,
    ) -> bool {
        tracing::info!(
            "verification_failed callback: file='{}', key_id='{}', key_name='{}', repository_alias='{}'",
            file,
            key_id,
            key_name,
            repository_alias
        );
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
        let question = QuestionSpec::new(&text, "software.verification_failed")
            .with_yes_no_actions()
            .with_data(&[("filename", file.as_str())]);
        let result = ask_software_question(&self.questions, question);
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return false;
        };

        answer.action == "Yes"
    }

    fn checksum_missing(&self, file: String) -> bool {
        tracing::info!("checksum_missing callback: file='{}'", file);
        // TODO: localization for text when parameters in gextext will be solved
        let text = format!(
            "No checksum for the file {file} was found in the repository. This means that \
              although the file is part of the signed repository, the list of checksums \
              does not mention this file. Use it anyway?"
        );
        let question = QuestionSpec::new(&text, "software.digest.no_digest").with_yes_no_actions();
        let result = ask_software_question(&self.questions, question);
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return false;
        };

        answer.action == "Yes"
    }

    fn checksum_unknown(&self, file: String, checksum: String) -> bool {
        tracing::info!(
            "checksum_unknown callback: file='{}', checksum='{}'",
            file,
            checksum
        );
        let text = format!(
            "The checksum of the file {file} is \"{checksum}\" but the expected checksum is \
              unknown. This means that the origin and integrity of the file cannot be verified. \
              Use it anyway?"
        );
        let question =
            QuestionSpec::new(&text, "software.digest.unknown_digest").with_yes_no_actions();
        let result = ask_software_question(&self.questions, question);
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return false;
        };

        answer.action == "Yes"
    }

    fn checksum_wrong(&self, file: String, expected: String, actual: String) -> bool {
        tracing::info!(
            "checksum_wrong callback: file='{}', expected='{}', actual='{}'",
            file,
            expected,
            actual
        );
        let text = format!(
            "The expected checksum of file %{file} is \"%{actual}\" but it was expected to be \
              \"%{expected}\". The file has changed by accident or by an attacker since the \
              creater signed it. Use it anyway?"
        );

        let question =
            QuestionSpec::new(&text, "software.digest.unknown_digest").with_yes_no_actions();
        let result = ask_software_question(&self.questions, question);
        let Ok(answer) = result else {
            tracing::warn!("Failed to ask question {:?}", result);
            return false;
        };

        answer.action == "Yes"
    }
}
