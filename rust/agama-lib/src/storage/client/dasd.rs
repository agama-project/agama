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

use zbus::{
    fdo::ObjectManagerProxy,
    zvariant::{ObjectPath, OwnedObjectPath},
    Connection,
};

use crate::{
    error::ServiceError,
    storage::{model::dasd::DASDDevice, proxies::dasd::ManagerProxy},
};

/// Client to connect to Agama's D-Bus API for DASD management.
#[derive(Clone)]
pub struct DASDClient<'a> {
    manager_proxy: ManagerProxy<'a>,
    object_manager_proxy: ObjectManagerProxy<'a>,
}

impl<'a> DASDClient<'a> {
    pub async fn new(connection: Connection) -> Result<DASDClient<'a>, ServiceError> {
        let manager_proxy = ManagerProxy::new(&connection).await?;
        let object_manager_proxy = ObjectManagerProxy::builder(&connection)
            .destination("org.opensuse.Agama.Storage1")?
            .path("/org/opensuse/Agama/Storage1")?
            .build()
            .await?;
        Ok(Self {
            manager_proxy,
            object_manager_proxy,
        })
    }

    pub async fn supported(&self) -> Result<bool, ServiceError> {
        let introspect = self.manager_proxy.introspect().await?;
        // simply check if introspection contain given interface
        Ok(introspect.contains("org.opensuse.Agama.Storage1.DASD.Manager"))
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
