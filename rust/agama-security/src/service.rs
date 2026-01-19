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

use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self,
        question::QuestionSpec,
        security::{SSLFingerprint, SSLFingerprintAlgorithm},
    },
    question::{self, ask_question},
};
use async_trait::async_trait;
use gettextrs::gettext;
use openssl::x509;

use crate::{certificate::Certificate, message};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
}

pub struct Starter {
    questions: Handler<question::Service>,
}

impl Starter {
    pub fn new(questions: Handler<question::Service>) -> Starter {
        Self { questions }
    }

    pub fn start(self) -> Result<Handler<Service>, Error> {
        let service = Service {
            questions: self.questions,
            state: State::default(),
        };
        let handler = actor::spawn(service);
        Ok(handler)
    }
}

#[derive(Default)]
struct State {
    fingerprints: Vec<SSLFingerprint>,
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
                self.state.fingerprints = config.ssl_certificates.unwrap_or_default();
            }
            None => {
                self.state = State::default();
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
            ssl_certificates: Some(self.state.fingerprints.clone()),
        })
    }
}

#[async_trait]
impl MessageHandler<message::CheckCertificate> for Service {
    // check whether the certificate is trusted.
    // if it is not trusted, ask the user
    // if the user rejects, adds it to a list of not trusted
    // if the user accepts, adds it to the list of fingerprints
    // and import the certificate.
    async fn handle(&mut self, message: message::CheckCertificate) -> Result<bool, Error> {
        let certificate = Certificate::new(message.certificate);

        if let Some(sha256) = certificate.sha256() {
            if self
                .state
                .fingerprints
                .iter()
                .find(|f| f.algorithm == SSLFingerprintAlgorithm::SHA256 && f.fingerprint == sha256)
                .is_some()
            {
                certificate.import().unwrap();
                return Ok(true);
            };
        }

        if let Some(sha1) = certificate.sha1() {
            if self
                .state
                .fingerprints
                .iter()
                .find(|f| f.algorithm == SSLFingerprintAlgorithm::SHA1 && f.fingerprint == sha1)
                .is_some()
            {
                certificate.import().unwrap();
                return Ok(true);
            }
        }

        if self.should_trust_certificate(&certificate).await {
            certificate.import().unwrap();
            Ok(true)
        } else {
            Ok(false)
        }
    }
}
