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

use agama_utils::{actor::Handler, api::event, issue};
use async_trait::async_trait;
use std::{fs, path::PathBuf, process::Command};
use tempfile::tempdir;

use crate::{
    service::{self},
    ModelAdapter, Service,
};

pub struct TestModel {
    source_dir: PathBuf,
    target_dir: PathBuf,
}

#[async_trait]
impl ModelAdapter for TestModel {
    fn hostname(&self) -> Result<String, service::Error> {
        Ok("test-hostname".to_string())
    }

    fn static_hostname(&self) -> Result<String, service::Error> {
        let path = self.source_dir.join("etc/hostname");
        fs::read_to_string(path).map_err(service::Error::from)
    }

    fn set_static_hostname(&mut self, name: String) -> Result<(), service::Error> {
        let path = self.source_dir.join("etc/hostname");
        fs::write(path, name).map_err(service::Error::from)
    }

    fn set_hostname(&mut self, _name: String) -> Result<(), service::Error> {
        Ok(())
    }

    fn install(&self) -> Result<(), service::Error> {
        let from = self.source_dir.join("etc/hostname");
        if fs::exists(&from)? {
            let to = self.target_dir.join("etc/hostname");
            fs::create_dir_all(to.parent().unwrap())?;
            fs::copy(from, to)?;
        }
        Ok(())
    }

    fn static_target_dir(&self) -> &str {
        self.target_dir.to_str().unwrap()
    }
}

/// Starts a testing hostname service.
pub async fn start_service(
    events: event::Sender,
    issues: Handler<issue::Service>,
) -> Handler<Service> {
    let temp_source = tempdir().unwrap();
    let temp_target = tempdir().unwrap();
    let hostname_path = temp_source.path().join("etc");
    fs::create_dir_all(&hostname_path).unwrap();
    fs::write(hostname_path.join("hostname"), "test-hostname").unwrap();

    let model = TestModel {
        source_dir: temp_source.path().to_path_buf(),
        target_dir: temp_target.path().to_path_buf(),
    };

    Service::starter(events, issues)
        .with_model(model)
        .start()
        .await
        .expect("Could not spawn a testing hostname service")
}
