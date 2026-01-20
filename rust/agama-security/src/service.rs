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

use std::path::PathBuf;

use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{self, question::QuestionSpec, security::SSLFingerprint},
    question::{self, ask_question},
};
use async_trait::async_trait;
use gettextrs::gettext;

use crate::{certificate::Certificate, message};

const DEFAULT_WORKDIR: &str = "/etc/pki/trust/anchors";

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
}

impl Starter {
    pub fn new(questions: Handler<question::Service>) -> Starter {
        Self {
            questions,
            workdir: PathBuf::from(DEFAULT_WORKDIR),
        }
    }

    pub fn with_workdir(mut self, workdir: &PathBuf) -> Self {
        self.workdir = workdir.clone();
        self
    }

    pub fn start(self) -> Result<Handler<Service>, Error> {
        let service = Service {
            questions: self.questions,
            state: State::new(self.workdir),
        };
        let handler = actor::spawn(service);
        Ok(handler)
    }
}

#[derive(Default)]
struct State {
    trusted: Vec<SSLFingerprint>,
    rejected: Vec<SSLFingerprint>,
    imported: Vec<PathBuf>,
    workdir: PathBuf,
}

impl State {
    pub fn new(workdir: PathBuf) -> Self {
        Self {
            workdir,
            ..Default::default()
        }
    }
    pub fn trust(&mut self, certificate: &Certificate) {
        match certificate.fingerprint() {
            Some(fingerprint) => self.trusted.push(fingerprint),
            None => tracing::warn!("Failed to get the certificate fingerprint"),
        }
    }

    pub fn reject(&mut self, certificate: &Certificate) {
        match certificate.fingerprint() {
            Some(fingerprint) => self.rejected.push(fingerprint),
            None => tracing::warn!("Failed to get the certificate fingerprint"),
        }
    }

    pub fn import(&mut self, certificate: &Certificate) -> Result<(), Error> {
        let path = self.workdir.join("registration_server.pem");
        certificate
            .import(&path)
            .map_err(|e| Error::CertificateIO(e))?;
        self.imported.push(path);
        Ok(())
    }

    /// Determines whether the certificate is trusted.
    pub fn is_trusted(&self, certificate: &Certificate) -> bool {
        Self::contains(&self.trusted, certificate)
    }

    /// Determines whether the certificate was rejected.
    pub fn is_rejected(&self, certificate: &Certificate) -> bool {
        Self::contains(&self.rejected, certificate)
    }

    pub fn reset(&mut self) {
        self.trusted.clear();
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
}

impl Service {
    pub fn starter(questions: Handler<question::Service>) -> Starter {
        Starter::new(questions)
    }

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
            self.state.import(&certificate)?;
            return Ok(true);
        }

        if self.should_trust_certificate(&certificate).await {
            tracing::info!("The user trusts certificate {fingerprint}");
            self.state.trust(&certificate);
            self.state.import(&certificate)?;
            return Ok(true);
        } else {
            tracing::info!("The user rejects the certificate {fingerprint}");
            self.state.reject(&certificate);
            return Ok(false);
        }
    }
}
