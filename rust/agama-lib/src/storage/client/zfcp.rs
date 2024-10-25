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

//! Implements a client to access Agama's D-Bus API related to zFCP management.

use std::collections::HashMap;

use futures_util::future::join_all;
use zbus::{fdo::ObjectManagerProxy, zvariant::OwnedObjectPath, Connection};

use crate::{
    dbus::{extract_id_from_path, get_property},
    error::ServiceError,
    storage::{
        model::zfcp::{ZFCPController, ZFCPDisk},
        proxies::{ZFCPControllerProxy, ZFCPManagerProxy},
    },
};

pub async fn get_wwpns(controller_id: &str) -> Result<Vec<String>, ServiceError> {
    let output = std::process::Command::new("zfcp_san_disc")
        .arg("-b")
        .arg(controller_id)
        .arg("-W")
        .output()
        .expect("zfcp_san_disc failed"); // TODO: real error handling
    Ok(String::from_utf8_lossy(&output.stdout)
        .split_whitespace()
        .map(|s| s.to_string())
        .collect())
}

pub async fn get_luns(controller_id: String, wwpn: String) -> Result<Vec<String>, ServiceError> {
    let output = std::process::Command::new("zfcp_san_disc")
        .arg("-b")
        .arg(controller_id)
        .arg("-p")
        .arg(wwpn)
        .arg("-L")
        .output()
        .expect("zfcp_san_disc failed"); // TODO: real error handling
    Ok(String::from_utf8_lossy(&output.stdout)
        .split_whitespace()
        .map(|s| s.to_string())
        .collect())
}

/// Obtains a LUNs map for the given controller
///
/// Given a controller id it returns a HashMap with each of its WWPNs as keys and the list of
/// LUNS corresponding to that specific WWPN as values.
///
/// Arguments:
///
/// `controller_id`: controller id
pub async fn get_luns_map(
    controller_id: String,
) -> Result<HashMap<String, Vec<String>>, ServiceError> {
    let wwpns = get_wwpns(controller_id.as_str()).await?;
    let mut tasks = vec![];
    for wwpn in wwpns {
        tasks.push((
            wwpn.clone(),
            tokio::spawn(get_luns(controller_id.to_string(), wwpn.clone())),
        ));
    }
    let mut result = HashMap::with_capacity(tasks.len());
    for (wwpn, task) in tasks {
        result.insert(wwpn.clone(), task.await.expect("thread join failed")?);
    }
    Ok(result)
}

const ZFCP_CONTROLLER_PREFIX: &'static str = "/org/opensuse/Agama/Storage1/zfcp_controllers";

/// Partial zfcp controller data used for thread processing
/// TODO: for final version move all those thread related methods to this struct to procude final result
struct PartialZFCPController {
    pub id: String,
    pub channel: String,
    pub lun_scan: bool,
    pub active: bool
}

/// Client to connect to Agama's D-Bus API for zFCP management.
#[derive(Clone)]
pub struct ZFCPClient<'a> {
    manager_proxy: ZFCPManagerProxy<'a>,
    object_manager_proxy: ObjectManagerProxy<'a>,
    connection: Connection,
}

impl<'a> ZFCPClient<'a> {
    pub async fn new(connection: Connection) -> Result<Self, ServiceError> {
        let manager_proxy = ZFCPManagerProxy::new(&connection).await?;
        let object_manager_proxy = ObjectManagerProxy::builder(&connection)
            .destination("org.opensuse.Agama.Storage1")?
            .path("/org/opensuse/Agama/Storage1")?
            .build()
            .await?;
        Ok(Self {
            manager_proxy,
            object_manager_proxy,
            connection,
        })
    }

    pub async fn supported(&self) -> Result<bool, ServiceError> {
        let introspect = self.manager_proxy.introspect().await?;
        // simply check if introspection contain given interface
        Ok(introspect.contains("org.opensuse.Agama.Storage1.ZFCP.Manager"))
    }

    pub async fn is_lun_scan_allowed(&self) -> Result<bool, ServiceError> {
        let allowed = self.manager_proxy.allow_lunscan().await?;
        // simply check if introspection contain given interface
        Ok(allowed)
    }

    pub async fn probe(&self) -> Result<(), ServiceError> {
        Ok(self.manager_proxy.probe().await?)
    }

    pub async fn get_disks(&self) -> Result<Vec<(OwnedObjectPath, ZFCPDisk)>, ServiceError> {
        let managed_objects = self.object_manager_proxy.get_managed_objects().await?;

        let mut devices: Vec<(OwnedObjectPath, ZFCPDisk)> = vec![];
        for (path, ifaces) in managed_objects {
            if let Some(properties) = ifaces.get("org.opensuse.Agama.Storage1.ZFCP.Disk") {
                match ZFCPDisk::try_from(properties) {
                    Ok(device) => {
                        devices.push((path, device));
                    }
                    Err(error) => {
                        log::warn!("Not a valid zFCP disk: {}", error);
                    }
                }
            }
        }
        Ok(devices)
    }

    pub async fn get_controllers(
        &self,
    ) -> Result<Vec<(OwnedObjectPath, ZFCPController)>, ServiceError> {
        let managed_objects = self.object_manager_proxy.get_managed_objects().await?;

        let mut devices: Vec<(OwnedObjectPath, PartialZFCPController)> = vec![];
        for (path, ifaces) in managed_objects {
            if let Some(properties) = ifaces.get("org.opensuse.Agama.Storage1.ZFCP.Controller") {
                let id = extract_id_from_path(&path)?.to_string();
                let channel: String = get_property(properties, "Channel")?;
                devices.push((
                    path,
                    PartialZFCPController {
                        id: id,
                        channel: channel,
                        lun_scan: get_property(properties, "LUNScan")?,
                        active: get_property(properties, "Active")?,
                    },
                ))
            }
        }
        let mut tasks = vec![];
        for (_path, partial_controller) in &devices {
            tasks.push(
                tokio::spawn(get_luns_map(partial_controller.channel.clone()))
            )
        }
        let mut result = Vec::with_capacity(devices.len());
        for (index, task) in tasks.into_iter().enumerate() {
            let (path, partial) = devices.get(index).unwrap();
            result.push((path.clone(), ZFCPController {
                id: partial.id.clone(),
                channel: partial.channel.clone(),
                lun_scan: partial.lun_scan,
                active: partial.active,
                luns_map: task.await.expect("thread join failed")?,
            }));
        }
        Ok(result)
    }

    async fn get_controller_proxy(
        &self,
        controller_id: &str,
    ) -> Result<ZFCPControllerProxy, ServiceError> {
        let dbus = ZFCPControllerProxy::builder(&self.connection)
            .path(ZFCP_CONTROLLER_PREFIX.to_string() + "/" + controller_id)?
            .build()
            .await?;
        Ok(dbus)
    }

    pub async fn get_wwpns(&self, controller_id: &str) -> Result<Vec<String>, ServiceError> {
        let controller = self.get_controller_proxy(controller_id).await?;
        let result = controller.get_wwpns().await?;
        Ok(result)
    }

    pub async fn get_luns(
        &self,
        controller_id: &str,
        wwpn: &str,
    ) -> Result<Vec<String>, ServiceError> {
        let controller = self.get_controller_proxy(controller_id).await?;
        let result = controller.get_luns(wwpn).await?;
        Ok(result)
    }

    /// Obtains a LUNs map for the given controller
    ///
    /// Given a controller id it returns a HashMap with each of its WWPNs as keys and the list of
    /// LUNS corresponding to that specific WWPN as values.
    ///
    /// Arguments:
    ///
    /// `controller_id`: controller id
    pub async fn get_luns_map(
        &self,
        controller_id: &str,
    ) -> Result<HashMap<String, Vec<String>>, ServiceError> {
        let wwpns = self.get_wwpns(controller_id).await?;
        let aresult = wwpns.into_iter().map(|wwpn| async move {
            Ok((
                wwpn.clone(),
                self.get_luns(controller_id, wwpn.as_str()).await?,
            ))
        });
        let sresult = join_all(aresult).await;
        sresult
            .into_iter()
            .collect::<Result<HashMap<String, Vec<String>>, _>>()
    }

    pub async fn activate_controller(&self, controller_id: &str) -> Result<(), ServiceError> {
        let controller = self.get_controller_proxy(controller_id).await?;
        controller.activate().await?;
        Ok(())
    }

    pub async fn activate_disk(
        &self,
        controller_id: &str,
        wwpn: &str,
        lun: &str,
    ) -> Result<(), ServiceError> {
        let controller = self.get_controller_proxy(controller_id).await?;
        let result = controller.activate_disk(wwpn, lun).await?;
        if result == 0 {
            Ok(())
        } else {
            let text = format!("Failed to activate disk. chzdev exit code {}", result);
            Err(ServiceError::UnsuccessfulAction(text))
        }
    }

    pub async fn deactivate_disk(
        &self,
        controller_id: &str,
        wwpn: &str,
        lun: &str,
    ) -> Result<(), ServiceError> {
        let controller = self.get_controller_proxy(controller_id).await?;
        let result = controller.deactivate_disk(wwpn, lun).await?;
        if result == 0 {
            Ok(())
        } else {
            let text = format!("Failed to deactivate disk. chzdev exit code {}", result);
            Err(ServiceError::UnsuccessfulAction(text))
        }
    }
}
