// Copyright (c) [2025] SUSE LLC
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

use agama_security::test_utils::start_service as start_security_service;
use agama_utils::{
    actor::Handler,
    api::{
        event,
        software::{SoftwareProposal, SystemInfo},
        Issue,
    },
    issue,
    products::ProductSpec,
    progress, question,
};
use async_trait::async_trait;

use crate::{
    model::state::SoftwareState,
    service::{self},
    ModelAdapter, Service,
};

pub struct TestModel;

#[async_trait]
impl ModelAdapter for TestModel {
    async fn system_info(&self) -> Result<SystemInfo, service::Error> {
        Ok(SystemInfo::default())
    }

    async fn proposal(&self) -> Result<SoftwareProposal, service::Error> {
        Ok(SoftwareProposal {
            used_space: 1048576,
            patterns: Default::default(),
        })
    }

    /// Refresh repositories information.
    async fn refresh(&mut self) -> Result<(), service::Error> {
        Ok(())
    }

    /// install rpms to target system
    async fn install(&self) -> Result<bool, service::Error> {
        Ok(true)
    }

    /// Finalizes system like disabling local repositories
    async fn finish(&self) -> Result<(), service::Error> {
        Ok(())
    }

    fn set_product(&mut self, _product_spec: ProductSpec) {}

    /// Applies the configuration to the system.
    ///
    /// It does not perform the installation, just update the repositories and
    /// the software selection.
    async fn write(
        &mut self,
        _software: SoftwareState,
        _progress: Handler<progress::Service>,
    ) -> Result<Vec<Issue>, service::Error> {
        Ok(vec![])
    }
}

/// Starts a testing software service.
pub async fn start_service(
    events: event::Sender,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
) -> Handler<Service> {
    let security = start_security_service(questions.clone()).await;
    Service::starter(events, issues, progress, questions, security)
        .with_model(TestModel {})
        .start()
        .await
        .expect("Could not spawn a testing software service")
}
