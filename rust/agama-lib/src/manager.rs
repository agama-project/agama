use crate::error::ServiceError;
use crate::proxies::ServiceStatusProxy;
use crate::{
    progress::Progress,
    proxies::{ManagerProxy, ProgressProxy},
};
use tokio_stream::StreamExt;
use zbus::Connection;

/// D-Bus client for the manager service
pub struct ManagerClient<'a> {
    manager_proxy: ManagerProxy<'a>,
    progress_proxy: ProgressProxy<'a>,
    status_proxy: ServiceStatusProxy<'a>,
}

impl<'a> ManagerClient<'a> {
    pub async fn new(connection: Connection) -> zbus::Result<ManagerClient<'a>> {
        Ok(Self {
            manager_proxy: ManagerProxy::new(&connection).await?,
            progress_proxy: ProgressProxy::new(&connection).await?,
            status_proxy: ServiceStatusProxy::new(&connection).await?,
        })
    }

    /// Returns the list of busy services.
    pub async fn busy_services(&self) -> Result<Vec<String>, ServiceError> {
        Ok(self.manager_proxy.busy_services().await?)
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
