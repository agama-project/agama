// Copyright (c) [2024] SUSE LLC
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

use fluent_uri::Uri;

use crate::{
    base_http_client::BaseHTTPClient,
    software::{model::ResolvableType, SoftwareHTTPClient, SoftwareHTTPClientError},
    StoreContext,
};

use super::{
    client::{ScriptsClient, ScriptsClientError},
    settings::ScriptsConfig,
    Script, ScriptError,
};

#[derive(Debug, thiserror::Error)]
pub enum ScriptsStoreError {
    #[error("Error processing script settings: {0}")]
    Script(#[from] ScriptsClientError),
    #[error("Error selecting software: {0}")]
    Software(#[from] SoftwareHTTPClientError),
}

type ScriptStoreResult<T> = Result<T, ScriptsStoreError>;

pub struct ScriptsStore {
    scripts: ScriptsClient,
    software: SoftwareHTTPClient,
}

impl ScriptsStore {
    pub fn new(client: BaseHTTPClient) -> Self {
        Self {
            scripts: ScriptsClient::new(client.clone()),
            software: SoftwareHTTPClient::new(client),
        }
    }

    pub async fn load(&self) -> ScriptStoreResult<ScriptsConfig> {
        let scripts = self.scripts.scripts().await?;

        Ok(ScriptsConfig {
            pre: Self::scripts_by_type(&scripts),
            post_partitioning: Self::scripts_by_type(&scripts),
            post: Self::scripts_by_type(&scripts),
            init: Self::scripts_by_type(&scripts),
        })
    }

    pub async fn store(
        &self,
        settings: &ScriptsConfig,
        context: &StoreContext,
    ) -> ScriptStoreResult<()> {
        self.scripts.delete_scripts().await?;

        if let Some(scripts) = &settings.pre {
            for pre in scripts {
                self.add_script(pre.clone().into(), &context.source).await?;
            }
        }

        if let Some(scripts) = &settings.post_partitioning {
            for post in scripts {
                self.add_script(post.clone().into(), &context.source)
                    .await?;
            }
        }

        if let Some(scripts) = &settings.post {
            for post in scripts {
                self.add_script(post.clone().into(), &context.source)
                    .await?;
            }
        }

        let mut packages = vec![];
        if let Some(scripts) = &settings.init {
            for init in scripts {
                self.add_script(init.clone().into(), &context.source)
                    .await?;
            }
            packages.push("agama-scripts");
        }
        self.software
            .set_resolvables("agama-scripts", ResolvableType::Package, &packages, true)
            .await?;

        Ok(())
    }

    /// Registers an script.
    ///
    /// If it uses a relative URL, it will be resolved against the base URL if given.
    ///
    /// * `script`: script definition.
    /// * `base_url`: base URL to resolve the script URL against.
    async fn add_script(
        &self,
        script: Script,
        base_url: &Option<Uri<String>>,
    ) -> ScriptStoreResult<()> {
        let resolved = match base_url {
            Some(source) => script.resolve_url(&source).unwrap(),
            None => script,
        };
        self.scripts.add_script(resolved).await?;
        Ok(())
    }

    fn scripts_by_type<T>(scripts: &[Script]) -> Option<Vec<T>>
    where
        T: TryFrom<Script, Error = ScriptError> + Clone,
    {
        let scripts: Vec<T> = scripts
            .iter()
            .cloned()
            .filter_map(|s| s.try_into().ok())
            .collect();
        if scripts.is_empty() {
            return None;
        }
        Some(scripts)
    }
}
