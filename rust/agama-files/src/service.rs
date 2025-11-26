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

use std::path::{Path, PathBuf};

use agama_software::{self as software, Resolvable, ResolvableType};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        event,
        files::{
            scripts::{self, ScriptsRepository},
            user_file, ScriptsConfig, UserFile,
        },
    },
    progress,
};
use async_trait::async_trait;

use crate::message;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Files(#[from] user_file::Error),
    #[error(transparent)]
    Scripts(#[from] scripts::Error),
    #[error(transparent)]
    Software(#[from] software::service::Error),
    #[error(transparent)]
    Actor(#[from] actor::Error),
}

const DEFAULT_SCRIPTS_DIR: &str = "/run/agama/scripts";
const DEFAULT_INSTALL_DIR: &str = "/mnt";

/// Builds and spawns the files service.
///
/// This structs allows to build a files service.
pub struct Starter {
    progress: Handler<progress::Service>,
    events: event::Sender,
    software: Handler<software::Service>,
    scripts_workdir: PathBuf,
    install_dir: PathBuf,
}

impl Starter {
    /// Creates a new starter.
    ///
    /// * `events`: channel to emit the [localization-specific events](crate::Event).
    pub fn new(
        events: event::Sender,
        progress: Handler<progress::Service>,
        software: Handler<software::Service>,
    ) -> Self {
        Self {
            events,
            progress,
            software,
            scripts_workdir: PathBuf::from(DEFAULT_SCRIPTS_DIR),
            install_dir: PathBuf::from(DEFAULT_INSTALL_DIR),
        }
    }

    /// Starts the service and returns the handler to communicate with it.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let scripts = ScriptsRepository::new(self.scripts_workdir);
        let service = Service {
            progress: self.progress,
            events: self.events,
            software: self.software,
            scripts,
            files: vec![],
            install_dir: self.install_dir,
        };
        let handler = actor::spawn(service);
        Ok(handler)
    }

    pub fn with_scripts_workdir<P: AsRef<Path>>(mut self, workdir: P) -> Self {
        self.scripts_workdir = PathBuf::from(workdir.as_ref());
        self
    }

    pub fn with_install_dir<P: AsRef<Path>>(mut self, install_dir: P) -> Self {
        self.install_dir = PathBuf::from(install_dir.as_ref());
        self
    }
}

pub struct Service {
    progress: Handler<progress::Service>,
    events: event::Sender,
    software: Handler<software::Service>,
    scripts: ScriptsRepository,
    files: Vec<UserFile>,
    install_dir: PathBuf,
}

impl Service {
    pub fn starter(
        events: event::Sender,
        progress: Handler<progress::Service>,
        software: Handler<software::Service>,
    ) -> Starter {
        Starter::new(events, progress, software)
    }

    pub async fn add_scripts(&mut self, config: ScriptsConfig) -> Result<(), Error> {
        if let Some(scripts) = config.pre {
            for pre in scripts {
                self.scripts.add(pre.into())?;
            }
        }

        if let Some(scripts) = config.post_partitioning {
            for post in scripts {
                self.scripts.add(post.into())?;
            }
        }

        if let Some(scripts) = config.post {
            for post in scripts {
                self.scripts.add(post.into())?;
            }
        }

        let mut packages = vec![];
        if let Some(scripts) = config.init {
            for init in scripts {
                self.scripts.add(init.into())?;
            }
            packages.push(Resolvable::new("agama-scripts", ResolvableType::Package));
        }
        _ = self
            .software
            .call(agama_software::message::SetResolvables::new(
                "agama-scripts".to_string(),
                packages,
            ))
            .await?;
        Ok(())
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::SetConfig> for Service {
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), Error> {
        self.scripts.clear()?;
        self.files.clear();

        let config = message.config.unwrap_or_default();

        if let Some(scripts) = config.scripts {
            self.add_scripts(scripts.clone()).await?;
        }

        self.files = config.files;

        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::RunScripts> for Service {
    async fn handle(&mut self, message: message::RunScripts) -> Result<(), Error> {
        self.scripts.run(message.group);
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::WriteFiles> for Service {
    async fn handle(&mut self, _message: message::WriteFiles) -> Result<(), Error> {
        for file in &self.files {
            file.write(&self.install_dir).await?;
        }
        Ok(())
    }
}
