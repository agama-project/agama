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

use crate::{
    base_http_client::BaseHTTPClient,
    error::ServiceError,
    software::{model::ResolvableType, SoftwareHTTPClient},
};

use super::{client::ScriptsClient, settings::ScriptsConfig, Script, ScriptError};

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

    pub async fn load(&self) -> Result<ScriptsConfig, ServiceError> {
        let scripts = self.scripts.scripts().await?;

        Ok(ScriptsConfig {
            pre: Self::scripts_by_type(&scripts),
            post: Self::scripts_by_type(&scripts),
            init: Self::scripts_by_type(&scripts),
        })
    }

    pub async fn store(&self, settings: &ScriptsConfig) -> Result<(), ServiceError> {
        self.scripts.delete_scripts().await?;

        if let Some(scripts) = &settings.pre {
            for pre in scripts {
                self.scripts.add_script(pre.clone().into()).await?;
            }
        }

        if let Some(scripts) = &settings.post {
            for post in scripts {
                self.scripts.add_script(post.clone().into()).await?;
            }
        }

        let mut packages = vec![];
        if let Some(scripts) = &settings.init {
            for init in scripts {
                self.scripts.add_script(init.clone().into()).await?;
            }
            packages.push("agama-scripts");
        }
        self.software
            .set_resolvables("agama-scripts", ResolvableType::Package, &packages, true)
            .await?;

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
