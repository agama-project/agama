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

//! This module implements the web API for the manager module.

pub mod http_client;
pub use http_client::ManagerHTTPClient;

use crate::error::ServiceError;
use crate::proxies::ServiceStatusProxy;
use crate::{
    progress::Progress,
    proxies::{Manager1Proxy, ProgressProxy},
};
use serde_repr::Serialize_repr;
use tokio_stream::StreamExt;
use zbus::Connection;

/// D-Bus client for the manager service
#[derive(Clone)]
pub struct ManagerClient<'a> {
    manager_proxy: Manager1Proxy<'a>,
    progress_proxy: ProgressProxy<'a>,
    status_proxy: ServiceStatusProxy<'a>,
}

/// Represents the installation phase.
/// NOTE: does this conversion have any value?
#[derive(Clone, Copy, Debug, PartialEq, Serialize_repr, utoipa::ToSchema)]
#[repr(u32)]
pub enum InstallationPhase {
    /// Start up phase.
    Startup,
    /// Configuration phase.
    Config,
    /// Installation phase.
    Install,
}

impl TryFrom<u32> for InstallationPhase {
    type Error = ServiceError;

    fn try_from(value: u32) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::Startup),
            1 => Ok(Self::Config),
            2 => Ok(Self::Install),
            _ => Err(ServiceError::UnknownInstallationPhase(value)),
        }
    }
}

impl<'a> ManagerClient<'a> {
    pub async fn new(connection: Connection) -> zbus::Result<ManagerClient<'a>> {
        Ok(Self {
            manager_proxy: Manager1Proxy::new(&connection).await?,
            progress_proxy: ProgressProxy::new(&connection).await?,
            status_proxy: ServiceStatusProxy::new(&connection).await?,
        })
    }

    /// Returns the list of busy services.
    pub async fn busy_services(&self) -> Result<Vec<String>, ServiceError> {
        Ok(self.manager_proxy.busy_services().await?)
    }

    /// Returns the current installation phase.
    pub async fn current_installation_phase(&self) -> Result<InstallationPhase, ServiceError> {
        let phase = self.manager_proxy.current_installation_phase().await?;
        phase.try_into()
    }

    /// Starts the probing process.
    pub async fn probe(&self) -> Result<(), ServiceError> {
        self.wait().await?;
        Ok(self.manager_proxy.probe().await?)
    }

    /// Starts the installation.
    pub async fn install(&self) -> Result<(), ServiceError> {
        Ok(self.manager_proxy.commit().await?)
    }

    /// Executes the after installation tasks.
    pub async fn finish(&self) -> Result<(), ServiceError> {
        Ok(self.manager_proxy.finish().await?)
    }

    /// Determines whether it is possible to start the installation.
    pub async fn can_install(&self) -> Result<bool, ServiceError> {
        Ok(self.manager_proxy.can_install().await?)
    }

    /// Determines whether the installer is running on Iguana.
    pub async fn use_iguana(&self) -> Result<bool, ServiceError> {
        Ok(self.manager_proxy.iguana_backend().await?)
    }

    /// Returns the current progress.
    pub async fn progress(&self) -> zbus::Result<Progress> {
        Progress::from_proxy(&self.progress_proxy).await
    }

    /// Returns whether the service is busy or not
    ///
    /// TODO: move this code to a trait with functions related to the service status.
    pub async fn is_busy(&self) -> bool {
        if let Ok(status) = self.status_proxy.current().await {
            return status != 0;
        }
        true
    }

    /// Waits until the manager is idle.
    pub async fn wait(&self) -> Result<(), ServiceError> {
        let mut stream = self.status_proxy.receive_current_changed().await;
        if !self.is_busy().await {
            return Ok(());
        }

        while let Some(change) = stream.next().await {
            if change.get().await? == 0 {
                return Ok(());
            }
        }
        Ok(())
    }
}
