use crate::error::ServiceError;
use crate::proxies::ServiceStatusProxy;
use crate::{
    progress::Progress,
    proxies::{ManagerProxy, ProgressProxy},
};
use futures_util::StreamExt;
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

    pub async fn busy_services(&self) -> Result<Vec<String>, ServiceError> {
        Ok(self.manager_proxy.busy_services().await?)
    }

    pub async fn probe(&self) -> Result<(), ServiceError> {
        Ok(self.manager_proxy.probe().await?)
    }

    pub async fn install(&self) -> Result<(), ServiceError> {
        Ok(self.manager_proxy.commit().await?)
    }

    pub async fn can_install(&self) -> Result<bool, ServiceError> {
        Ok(self.manager_proxy.can_install().await?)
    }

    pub async fn progress(&self) -> zbus::Result<Progress> {
        Progress::from_proxy(&self.progress_proxy).await
    }

    /// Waits until the manager is idle.
    pub async fn wait(&self) -> Result<(), ServiceError> {
        if self.status_proxy.current().await? == 0 {
            return Ok(());
        }

        let mut s = self.status_proxy.receive_current_changed().await;
        while let Some(change) = s.next().await {
            if change.get().await? == 0 {
                return Ok(());
            }
        }
        Ok(())
    }
}
