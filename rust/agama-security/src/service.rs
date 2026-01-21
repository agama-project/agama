// Copyright (c) [2026] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

use std::path::{Path, PathBuf};

use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{self, question::QuestionSpec, security::SSLFingerprint},
    question::{self, ask_question},
};
use async_trait::async_trait;
use gettextrs::gettext;

use crate::{certificate::Certificate, message};

const DEFAULT_WORKDIR: &str = "/etc/pki/trust/anchors";
const DEFAULT_INSTALL_DIR: &str = "/mnt";

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error("Could not write the certificate: {0}")]
    CertificateIO(#[source] std::io::Error),
}

pub struct Starter {
    questions: Handler<question::Service>,
    workdir: PathBuf,
    install_dir: PathBuf,
}

impl Starter {
    pub fn new(questions: Handler<question::Service>) -> Starter {
        Self {
            questions,
            workdir: PathBuf::from(DEFAULT_WORKDIR),
            install_dir: PathBuf::from(DEFAULT_INSTALL_DIR),
        }
    }

    pub fn with_install_dir<P: AsRef<Path>>(mut self, install_dir: P) -> Self {
        self.install_dir = PathBuf::from(install_dir.as_ref());
        self
    }

    pub fn with_workdir(mut self, workdir: &PathBuf) -> Self {
        self.workdir = workdir.clone();
        self
    }

    pub fn start(self) -> Result<Handler<Service>, Error> {
        let service = Service {
            questions: self.questions,
            state: State::new(self.workdir),
            install_dir: self.install_dir.clone(),
        };
        let handler = actor::spawn(service);
        Ok(handler)
    }
}

#[derive(Default)]
struct State {
    trusted: Vec<SSLFingerprint>,
    rejected: Vec<SSLFingerprint>,
    imported: Vec<String>,
    workdir: PathBuf,
}

impl State {
    pub fn new(workdir: PathBuf) -> Self {
        Self {
            workdir,
            ..Default::default()
        }
    }

    /// Trust the given certificate.
    ///
    /// * `certificate`: certificate to trust.
    pub fn trust(&mut self, certificate: &Certificate) {
        match certificate.fingerprint() {
            Some(fingerprint) => self.trusted.push(fingerprint),
            None => tracing::warn!("Failed to get the certificate fingerprint"),
        }
    }

    /// Reject the given certificate.
    ///
    /// * `certificate`: certificate to import.
    pub fn reject(&mut self, certificate: &Certificate) {
        match certificate.fingerprint() {
            Some(fingerprint) => self.rejected.push(fingerprint),
            None => tracing::warn!("Failed to get the certificate fingerprint"),
        }
    }

    /// Import the given certificate.
    ///
    /// It will be copied to the running system using the given name.
    ///
    /// * `certificate`: certificate to import.
    /// * `name`: certificate name (e.g., "registration_server")
    pub fn import(&mut self, certificate: &Certificate, name: &str) -> Result<(), Error> {
        let path = self.workdir.join(format!("{name}.pem"));
        certificate
            .import(&path)
            .map_err(|e| Error::CertificateIO(e))?;
        self.imported.push(name.to_string());
        Ok(())
    }

    /// Determines whether the certificate is trusted.
    ///
    /// It checks whether its SHA1 or SHA256 fingerprint are included in the list of trusted
    /// certificates.
    ///
    /// * `certificate`: certificate to check.
    pub fn is_trusted(&self, certificate: &Certificate) -> bool {
        Self::contains(&self.trusted, certificate)
    }

    /// Determines whether the certificate was rejected.
    ///
    /// It checks whether its SHA1 or SHA256 fingerprint are included in the list of rejected
    /// certificates.
    pub fn is_rejected(&self, certificate: &Certificate) -> bool {
        Self::contains(&self.rejected, certificate)
    }

    /// Reset the list of trusted certificates.
    ///
    /// Beware that it does not remove the already imported certificates.
    pub fn reset(&mut self) {
        self.trusted.clear();
    }

    /// Copy the certificates to the given directory.
    ///
    /// * `directory`: directory to copy the certificates.
    pub fn copy_certificates(&self, directory: &Path) {
        let workdir = self.workdir.strip_prefix("/").unwrap_or(&self.workdir);
        let target_directory = directory.join(workdir);
        for name in &self.imported {
            let filename = format!("{name}.pem");
            let source = self.workdir.join(&filename);
            let destination = target_directory.join(&filename);

            println!("COPYING {} {}", source.display(), destination.display());
            if let Err(error) = std::fs::copy(source, destination) {
                tracing::warn!("Failed to write the certificate to {filename}: {error}",);
            }
        }
    }

    fn contains(list: &[SSLFingerprint], certificate: &Certificate) -> bool {
        if let Some(sha256) = certificate.sha256() {
            if list.contains(&sha256) {
                return true;
            }
        }

        if let Some(sha1) = certificate.sha1() {
            if list.contains(&sha1) {
                return true;
            }
        }

        false
    }
}

pub struct Service {
    questions: Handler<question::Service>,
    state: State,
    install_dir: PathBuf,
}

impl Service {
    pub fn starter(questions: Handler<question::Service>) -> Starter {
        Starter::new(questions)
    }

    /// Asks the user whether to trust the certificate.
    ///
    /// * `certificate`: certificate to check.
    pub async fn should_trust_certificate(&self, certificate: &Certificate) -> bool {
        let labels = [gettext("Trust"), gettext("Reject")];
        let msg = gettext("Trying to import a self-signed certificate. Do you want to trust it and register the product?");

        let question = QuestionSpec::new(&msg, "registration.certificate")
            .with_owned_data(certificate.to_data())
            .with_actions(&[
                ("Trust", labels[0].as_str()),
                ("Reject", labels[1].as_str()),
            ])
            .with_default_action("Trust");

        if let Ok(answer) = ask_question(&self.questions, question).await {
            return answer.action == "Trust";
        }
        false
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::SetConfig<api::security::Config>> for Service {
    async fn handle(
        &mut self,
        message: message::SetConfig<api::security::Config>,
    ) -> Result<(), Error> {
        match message.config {
            Some(config) => {
                self.state.trusted = config.ssl_certificates.unwrap_or_default();
            }
            None => {
                self.state.reset();
            }
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(
        &mut self,
        _message: message::GetConfig,
    ) -> Result<api::security::Config, Error> {
        Ok(api::security::Config {
            ssl_certificates: Some(self.state.trusted.clone()),
        })
    }
}

#[async_trait]
impl MessageHandler<message::CheckCertificate> for Service {
    async fn handle(&mut self, message: message::CheckCertificate) -> Result<bool, Error> {
        let certificate = Certificate::new(message.certificate);
        let fingerprint = certificate
            .fingerprint()
            .as_ref()
            .map(ToString::to_string)
            .unwrap_or("unknown".to_string());

        let trusted = self.state.is_trusted(&certificate);
        let rejected = self.state.is_rejected(&certificate);

        tracing::info!(
            "Certificate fingerprint={fingerprint} trusted={trusted} rejected={rejected}"
        );

        if rejected {
            return Ok(false);
        }

        if trusted {
            // import in case it was not previously imported
            tracing::info!("Importing already trusted certificate {fingerprint}");
            self.state.import(&certificate, &message.name)?;
            return Ok(true);
        }

        if self.should_trust_certificate(&certificate).await {
            tracing::info!("The user trusts certificate {fingerprint}");
            self.state.trust(&certificate);
            self.state.import(&certificate, &message.name)?;
            return Ok(true);
        } else {
            tracing::info!("The user rejects the certificate {fingerprint}");
            self.state.reject(&certificate);
            return Ok(false);
        }
    }
}

#[async_trait]
impl MessageHandler<message::Finish> for Service {
    async fn handle(&mut self, _message: message::Finish) -> Result<(), Error> {
        self.state.copy_certificates(&self.install_dir);
        Ok(())
    }
}
