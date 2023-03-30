use crate::error::ServiceError;
use crate::{
    progress::Progress,
    proxies::{ManagerProxy, ProgressProxy},
};
use zbus::Connection;

/// D-Bus client for the manager service
pub struct ManagerClient<'a> {
    manager_proxy: ManagerProxy<'a>,
    progress_proxy: ProgressProxy<'a>,
}

impl<'a> ManagerClient<'a> {
    pub async fn new(connection: Connection) -> zbus::Result<ManagerClient<'a>> {
        Ok(Self {
            manager_proxy: ManagerProxy::new(&connection).await?,
            progress_proxy: ProgressProxy::new(&connection).await?,
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
}
