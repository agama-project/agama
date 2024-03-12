//! This module implements the web API for the manager module.

use crate::error::ServiceError;
use crate::proxies::ServiceStatusProxy;
use crate::{
    progress::Progress,
    proxies::{Manager1Proxy, ProgressProxy},
};
use serde::Serialize;
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
#[derive(Clone, Copy, Debug, PartialEq, Serialize, utoipa::ToSchema)]
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
        Ok(phase.try_into()?)
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
