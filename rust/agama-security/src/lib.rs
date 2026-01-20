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

//! This crate implements the support for handling security settings,
//! including certificates management.

pub mod service;
pub use service::{Service, Starter};

pub mod message;

pub mod test_utils;

mod certificate;

#[cfg(test)]
mod tests {
    use crate::{message, service::Service};
    use agama_utils::{
        actor::Handler,
        api::{self, event::Event, question::Answer},
        question,
    };
    use openssl::{hash::MessageDigest, x509::X509};
    use std::{
        env,
        fs::{self},
        path::PathBuf,
    };
    use tempfile::TempDir;
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    struct Context {
        handler: Handler<Service>,
        questions: Handler<question::Service>,
        _tmp_dir: TempDir,
        _events_rx: broadcast::Receiver<Event>,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let tmp_dir = TempDir::new().expect("Could not create temp dir");
            let workdir = tmp_dir.path().to_path_buf();

            let bin_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .expect("Could not find parent dir")
                .join("share/bin")
                .canonicalize()
                .expect("Could not find share/bin");

            // Update PATH to include the bin dir
            let path = env::var("PATH").unwrap_or_default();
            let new_path = format!("{}:{}", bin_dir.display(), path);
            env::set_var("PATH", new_path);

            let (events_tx, events_rx) = broadcast::channel::<Event>(16);
            let questions = question::start(events_tx)
                .await
                .expect("Could not start question service");

            let handler = Service::starter(questions.clone())
                .with_workdir(&workdir)
                .start()
                .expect("Could not start the security service");

            Self {
                handler,
                questions,
                _tmp_dir: tmp_dir,
                _events_rx: events_rx,
            }
        }
    }

    fn load_test_certificate() -> X509 {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share/test.pem");
        let content = fs::read(path).expect("failed to read test certificate");
        X509::from_pem(&content).expect("failed to parse test certificate")
    }

    fn get_fingerprint(cert: &X509) -> String {
        let digest = cert.digest(MessageDigest::sha256()).unwrap();
        digest
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<Vec<String>>()
            .join(":")
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_check_certificate_pre_approved(
        ctx: &mut Context,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let cert = load_test_certificate();
        let fingerprint = get_fingerprint(&cert);

        // Set the certificate as pre-approved
        let config = api::security::Config {
            ssl_certificates: Some(vec![api::security::SSLFingerprint::sha256(&fingerprint)]),
        };
        ctx.handler
            .call(message::SetConfig::new(Some(config)))
            .await?;

        // Check the certificate
        let valid = ctx
            .handler
            .call(message::CheckCertificate::new(cert))
            .await?;

        assert!(valid);

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_check_certificate_user_trusted(
        ctx: &mut Context,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let cert = load_test_certificate();

        // Clear config
        ctx.handler.call(message::SetConfig::new(None)).await?;

        let questions = ctx.questions.clone();
        tokio::spawn(async move {
            loop {
                // Poll for the question
                let pending = questions.call(question::message::Get).await.unwrap();
                if let Some(q) = pending
                    .iter()
                    .find(|q| q.spec.class == "registration.certificate")
                {
                    questions
                        .call(question::message::Answer {
                            id: q.id,
                            answer: Answer {
                                action: "Trust".to_string(),
                                value: Default::default(),
                            },
                        })
                        .await
                        .unwrap();
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
        });

        // Check the certificate
        let valid = ctx
            .handler
            .call(message::CheckCertificate::new(cert))
            .await?;

        assert!(valid);

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_check_certificate_user_rejected(
        ctx: &mut Context,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let cert = load_test_certificate();

        // Clear config
        ctx.handler.call(message::SetConfig::new(None)).await?;

        let questions = ctx.questions.clone();
        tokio::spawn(async move {
            loop {
                // Poll for the question
                let pending = questions.call(question::message::Get).await.unwrap();
                if let Some(q) = pending
                    .iter()
                    .find(|q| q.spec.class == "registration.certificate")
                {
                    questions
                        .call(question::message::Answer {
                            id: q.id,
                            answer: Answer {
                                action: "Reject".to_string(),
                                value: Default::default(),
                            },
                        })
                        .await
                        .unwrap();
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
        });

        // Check the certificate
        let valid = ctx
            .handler
            .call(message::CheckCertificate::new(cert))
            .await?;

        assert!(!valid);

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_check_certificate_remembers_trust(
        ctx: &mut Context,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let cert = load_test_certificate();

        // Clear config
        ctx.handler.call(message::SetConfig::new(None)).await?;

        let questions = ctx.questions.clone();
        tokio::spawn(async move {
            loop {
                // Poll for the question
                let pending = questions.call(question::message::Get).await.unwrap();
                if let Some(q) = pending
                    .iter()
                    .find(|q| q.spec.class == "registration.certificate")
                {
                    questions
                        .call(question::message::Answer {
                            id: q.id,
                            answer: Answer {
                                action: "Trust".to_string(),
                                value: Default::default(),
                            },
                        })
                        .await
                        .unwrap();
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
        });

        // Check the certificate (first time)
        let valid = ctx
            .handler
            .call(message::CheckCertificate::new(cert.clone()))
            .await?;

        assert!(valid);

        // Check the certificate again (should be remembered)
        let valid_again = ctx
            .handler
            .call(message::CheckCertificate::new(cert))
            .await?;

        assert!(valid_again);

        Ok(())
    }
}

