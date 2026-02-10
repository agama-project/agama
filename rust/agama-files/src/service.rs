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

use std::{
    path::{Path, PathBuf},
    sync::Arc,
};

use agama_software::{self as software, Resolvable, ResolvableType};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::files::{
        scripts::{self, ScriptsGroup, ScriptsRepository},
        user_file, ScriptsConfig, UserFile,
    },
    progress, question,
};
use async_trait::async_trait;
use strum::IntoEnumIterator;
use tokio::sync::Mutex;

use crate::{message, ScriptsRunner};

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

const DEFAULT_SCRIPTS_DIR: &str = "run/agama/scripts";
const DEFAULT_WORK_DIR: &str = "/";
const DEFAULT_INSTALL_DIR: &str = "/mnt";

/// Builds and spawns the files service.
///
/// This structs allows to build a files service.
pub struct Starter {
    workdir: PathBuf,
    install_dir: PathBuf,
    software: Handler<software::Service>,
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
}

impl Starter {
    /// Creates a new starter.
    ///
    /// * `events`: channel to emit the [localization-specific events](crate::Event).
    pub fn new(
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
        software: Handler<software::Service>,
    ) -> Self {
        Self {
            software,
            progress,
            questions,
            workdir: PathBuf::from(DEFAULT_WORK_DIR),
            install_dir: PathBuf::from(DEFAULT_INSTALL_DIR),
        }
    }

    /// Starts the service and returns the handler to communicate with it.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let scripts = ScriptsRepository::new(self.workdir.join(DEFAULT_SCRIPTS_DIR));
        let service = Service {
            progress: self.progress,
            questions: self.questions,
            software: self.software,
            scripts: Arc::new(Mutex::new(scripts)),
            files: vec![],
            install_dir: self.install_dir,
            root_dir: self.workdir,
        };
        let handler = actor::spawn(service);
        Ok(handler)
    }

    pub fn with_workdir<P: AsRef<Path>>(mut self, workdir: P) -> Self {
        self.workdir = PathBuf::from(workdir.as_ref());
        self
    }

    pub fn with_install_dir<P: AsRef<Path>>(mut self, install_dir: P) -> Self {
        self.install_dir = PathBuf::from(install_dir.as_ref());
        self
    }
}

pub struct Service {
    software: Handler<software::Service>,
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
    scripts: Arc<Mutex<ScriptsRepository>>,
    files: Vec<UserFile>,
    install_dir: PathBuf,
    root_dir: PathBuf,
}

impl Service {
    pub fn starter(
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
        software: Handler<software::Service>,
    ) -> Starter {
        Starter::new(progress, questions, software)
    }

    /// Clear the scripts.
    ///
    /// Keep the pre-scripts because they are expected to run as soon as they are imported.
    pub async fn clear_scripts(&mut self) -> Result<(), Error> {
        let mut repo = self.scripts.lock().await;
        let groups: Vec<_> = ScriptsGroup::iter()
            .filter(|g| g != &ScriptsGroup::Pre)
            .collect();
        repo.clear(groups.as_slice())?;
        Ok(())
    }

    pub async fn add_scripts(&mut self, config: ScriptsConfig) -> Result<(), Error> {
        let mut repo = self.scripts.lock().await;
        if let Some(scripts) = config.pre {
            for pre in scripts {
                repo.add(pre.into())?;
            }
        }

        if let Some(scripts) = config.post_partitioning {
            for post in scripts {
                repo.add(post.into())?;
            }
        }

        if let Some(scripts) = config.post {
            for post in scripts {
                repo.add(post.into())?;
            }
        }

        let mut packages = vec![];
        if let Some(scripts) = config.init {
            for init in scripts {
                repo.add(init.into())?;
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
        let config = message.config.unwrap_or_default();

        self.clear_scripts().await?;
        if let Some(scripts) = config.scripts {
            self.add_scripts(scripts.clone()).await?;
        }

        if let Some(files) = config.files {
            self.files = files;
        } else {
            self.files.clear();
        }

        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::RunScripts> for Service {
    async fn handle(&mut self, message: message::RunScripts) -> Result<bool, Error> {
        let scripts = self.scripts.lock().await;
        let workdir = scripts.workdir.clone();
        let to_run = scripts.by_group(message.group).clone();

        if to_run.is_empty() {
            return Ok(false);
        } else {
            let runner = ScriptsRunner::new(
                &self.root_dir,
                &self.install_dir,
                &workdir,
                self.progress.clone(),
                self.questions.clone(),
            );
            if let Err(error) = runner.run(&to_run).await {
                tracing::error!("Error running scripts: {error}");
            }
            Ok(true)
        }
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
