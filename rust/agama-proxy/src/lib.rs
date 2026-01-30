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

pub mod message;
pub mod model;
pub mod service;
pub use service::{Service, Starter};
pub mod test_utils;

#[cfg(test)]
mod tests {
    use super::*;
    use agama_utils::api;
    use tokio::sync::broadcast;

    #[tokio::test]
    async fn test_proxy_service() {
        use std::fs;
        use tempfile::tempdir;

        let (sender, _receiver) = broadcast::channel(100);
        let temp_dir = tempdir().unwrap();
        let config_dir = temp_dir.path().join("config");
        let install_dir = temp_dir.path().join("install");

        let service = Starter::new(sender)
            .with_install_dir(&install_dir)
            .with_workdir(&config_dir)
            .start()
            .expect("Failed to start service");

        // Would be nice
        //fs::create_dir_all(&config_dir.join("etc/sysconfig")).unwrap();
        // Check initial config is empty
        let config = service.call(message::GetConfig).await.unwrap();
        assert_eq!(config, None);

        // Update config
        let new_config = api::proxy::Config {
            enabled: Some(true),
            http: Some("http://proxy.example.com".to_string()),
            ..Default::default()
        };

        service
            .call(message::SetConfig::new(Some(new_config.clone())))
            .await
            .unwrap();

        // Check config is updated
        let config = service.call(message::GetConfig).await.unwrap();
        assert_eq!(config, Some(new_config));
        // Call Finish
        service.call(message::Finish).await.unwrap();

        // Check if the config file was written to the install_dir
        let expected_path = install_dir.join("etc/sysconfig/proxy");
        assert!(expected_path.exists());

        let content = fs::read_to_string(expected_path).unwrap();
        assert!(content.contains("HTTP_PROXY=\"http://proxy.example.com\""));
        assert!(content.contains("PROXY_ENABLED=\"yes\""));
    }
}
