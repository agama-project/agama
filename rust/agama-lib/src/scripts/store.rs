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

use crate::{base_http_client::BaseHTTPClient, error::ServiceError};

use super::{client::ScriptsClient, settings::ScriptsConfig, Script, ScriptConfig, ScriptsGroup};

pub struct ScriptsStore {
    client: ScriptsClient,
}

impl ScriptsStore {
    pub fn new(client: BaseHTTPClient) -> Self {
        Self {
            client: ScriptsClient::new(client),
        }
    }

    pub fn new_with_client(client: ScriptsClient) -> Result<Self, ServiceError> {
        Ok(Self { client })
    }

    pub async fn load(&self) -> Result<ScriptsConfig, ServiceError> {
        let scripts = self.client.scripts().await?;

        Ok(ScriptsConfig {
            pre: Self::to_script_configs(&scripts, ScriptsGroup::Pre),
            post: Self::to_script_configs(&scripts, ScriptsGroup::Post),
        })
    }

    pub async fn store(&self, settings: &ScriptsConfig) -> Result<(), ServiceError> {
        self.client.delete_scripts().await?;

        for pre in &settings.pre {
            self.client
                .add_script(&Self::to_script(pre, ScriptsGroup::Pre))
                .await?;
        }

        for post in &settings.post {
            self.client
                .add_script(&Self::to_script(post, ScriptsGroup::Post))
                .await?;
        }

        self.client.run_scripts(ScriptsGroup::Pre).await?;

        Ok(())
    }

    fn to_script(config: &ScriptConfig, group: ScriptsGroup) -> Script {
        Script {
            name: config.name.clone(),
            source: config.source.clone(),
            group,
        }
    }

    fn to_script_configs(scripts: &[Script], group: ScriptsGroup) -> Vec<ScriptConfig> {
        scripts
            .iter()
            .filter(|s| s.group == group)
            .map(|s| s.into())
            .collect()
    }
}
