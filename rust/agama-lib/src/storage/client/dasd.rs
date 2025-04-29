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

//! Implements a client to access Agama's D-Bus API related to DASD management.

use std::collections::HashMap;

use zbus::{
    fdo::{IntrospectableProxy, ObjectManagerProxy},
    zvariant::{ObjectPath, OwnedObjectPath},
    Connection,
};

use crate::{
    error::ServiceError,
    storage::{
        model::dasd::DASDDevice,
        proxies::dasd::ManagerProxy,
        settings::dasd::{DASDConfig, DASDDeviceConfig, DASDDeviceState},
    },
};

/// Client to connect to Agama's D-Bus API for DASD management.
#[derive(Clone)]
pub struct DASDClient<'a> {
    manager_proxy: ManagerProxy<'a>,
    object_manager_proxy: ObjectManagerProxy<'a>,
    introspectable_proxy: IntrospectableProxy<'a>,
}

impl<'a> DASDClient<'a> {
    pub async fn new(connection: Connection) -> Result<DASDClient<'a>, ServiceError> {
        let manager_proxy = ManagerProxy::new(&connection).await?;
        let object_manager_proxy = ObjectManagerProxy::builder(&connection)
            .destination("org.opensuse.Agama.Storage1")?
            .path("/org/opensuse/Agama/Storage1")?
            .build()
            .await?;
        let introspectable_proxy = IntrospectableProxy::builder(&connection)
            .destination("org.opensuse.Agama.Storage1")?
            .path("/org/opensuse/Agama/Storage1")?
            .build()
            .await?;

        Ok(Self {
            manager_proxy,
            object_manager_proxy,
            introspectable_proxy,
        })
    }

    pub async fn supported(&self) -> Result<bool, ServiceError> {
        let introspect = self.introspectable_proxy.introspect().await?;
        // simply check if introspection contain given interface
        Ok(introspect.contains("org.opensuse.Agama.Storage1.DASD.Manager"))
    }

    pub async fn get_config(&self) -> Result<DASDConfig, ServiceError> {
        // TODO: implement
        Ok(DASDConfig::default())
    }

    pub async fn set_config(&self, config: DASDConfig) -> Result<(), ServiceError> {
        // at first probe to ensure we work on real system info
        self.probe().await?;
        self.config_activate(&config).await?;
        self.config_format(&config).await?;
        self.config_set_diag(&config).await?;
        Ok(())
    }

    async fn config_activate(&self, config: &DASDConfig) -> Result<(), ServiceError> {
        let pairs = self.config_pairs(config).await?;
        let to_activate: Vec<&str> = pairs
            .iter()
            .filter(|(system, _config)| system.enabled == false)
            .filter(|(_system, config)| {
                config.state.clone().unwrap_or_default() == DASDDeviceState::Active
            })
            .map(|(system, _config)| system.id.as_str())
            .collect();
        self.enable(&to_activate).await?;

        if !to_activate.is_empty() {
            // reprobe after calling enable. TODO: check if it is needed or callbacks take into action and update it automatically
            self.probe().await?;
        }
        Ok(())
    }

    async fn config_format(&self, config: &DASDConfig) -> Result<(), ServiceError> {
        let pairs = self.config_pairs(config).await?;
        let to_format: Vec<&str> = pairs
            .iter()
            .filter(|(system, config)| {
                if config.format == Some(true) {
                    true
                } else if config.format == None {
                    !system.formatted
                } else {
                    false
                }
            })
            .map(|(system, _config)| system.id.as_str())
            .collect();
        self.format(&to_format).await?;

        if !to_format.is_empty() {
            // reprobe after calling format. TODO: check if it is needed or callbacks take into action and update it automatically
            // also do we need to wait here for finish of format progress?
            self.probe().await?;
        }
        Ok(())
    }

    async fn config_set_diag(&self, config: &DASDConfig) -> Result<(), ServiceError> {
        let pairs = self.config_pairs(config).await?;
        let to_enable: Vec<&str> = pairs
            .iter()
            .filter(|(_system, config)| config.diag == Some(true))
            .map(|(system, _config)| system.id.as_str())
            .collect();
        self.set_diag(&to_enable, true).await?;

        let to_disable: Vec<&str> = pairs
            .iter()
            .filter(|(_system, config)| config.diag == Some(false))
            .map(|(system, _config)| system.id.as_str())
            .collect();
        self.set_diag(&to_disable, false).await?;

        if !to_enable.is_empty() || !to_disable.is_empty() {
            // reprobe after calling format. TODO: check if it is needed or callbacks take into action and update it automatically
            // also do we need to wait here for finish of format progress?
            self.probe().await?;
        }
        Ok(())
    }

    async fn config_pairs(
        &self,
        config: &DASDConfig,
    ) -> Result<Vec<(DASDDevice, DASDDeviceConfig)>, ServiceError> {
        let devices = self.devices().await?;
        let devices_map: HashMap<&str, DASDDevice> = devices
            .iter()
            .map(|d| (d.1.id.as_str(), d.1.clone()))
            .collect();
        config
            .devices
            .iter()
            .map(|c| {
                Ok((
                    devices_map
                        .get(c.channel.as_str())
                        .ok_or(ServiceError::DASDChannelNotFound(c.channel.clone()))?
                        .clone(),
                    c.clone(),
                ))
            })
            .collect()
    }

    pub async fn probe(&self) -> Result<(), ServiceError> {
        Ok(self.manager_proxy.probe().await?)
    }

    pub async fn devices(&self) -> Result<Vec<(OwnedObjectPath, DASDDevice)>, ServiceError> {
        let managed_objects = self.object_manager_proxy.get_managed_objects().await?;

        let mut devices: Vec<(OwnedObjectPath, DASDDevice)> = vec![];
        for (path, ifaces) in managed_objects {
            if let Some(properties) = ifaces.get("org.opensuse.Agama.Storage1.DASD.Device") {
                match DASDDevice::try_from(properties) {
                    Ok(device) => {
                        devices.push((path, device));
                    }
                    Err(error) => {
                        log::warn!("Not a valid DASD device: {}", error);
                    }
                }
            }
        }
        Ok(devices)
    }

    pub async fn format(&self, ids: &[&str]) -> Result<String, ServiceError> {
        let selected = self.find_devices(ids).await?;
        let references = selected.iter().collect::<Vec<&ObjectPath<'_>>>();
        let (exit_code, job_path) = self.manager_proxy.format(&references).await?;
        if exit_code != 0 {
            return Err(ServiceError::UnsuccessfulAction("DASD format".to_string()));
        }

        Ok(job_path.to_string())
    }

    pub async fn enable(&self, ids: &[&str]) -> Result<(), ServiceError> {
        let selected = self.find_devices(ids).await?;
        let references = selected.iter().collect::<Vec<&ObjectPath<'_>>>();
        self.manager_proxy.enable(&references).await?;
        Ok(())
    }

    pub async fn disable(&self, ids: &[&str]) -> Result<(), ServiceError> {
        let selected = self.find_devices(ids).await?;
        let references = selected.iter().collect::<Vec<&ObjectPath<'_>>>();
        self.manager_proxy.disable(&references).await?;
        Ok(())
    }

    pub async fn set_diag(&self, ids: &[&str], diag: bool) -> Result<(), ServiceError> {
        let selected = self.find_devices(ids).await?;
        let references = selected.iter().collect::<Vec<&ObjectPath<'_>>>();
        self.manager_proxy.set_diag(&references, diag).await?;
        Ok(())
    }

    async fn find_devices(&self, ids: &[&str]) -> Result<Vec<ObjectPath<'_>>, ServiceError> {
        let devices = self.devices().await?;
        let selected: Vec<ObjectPath> = devices
            .into_iter()
            .filter_map(|(path, device)| {
                if ids.contains(&device.id.as_str()) {
                    Some(path.into_inner())
                } else {
                    None
                }
            })
            .collect();
        Ok(selected)
    }
}
