use super::proxies::{CalculatorProxy, Storage1Proxy, StorageProposalProxy};
use crate::error::ServiceError;
use serde::Serialize;
use std::collections::HashMap;
use zbus::Connection;

/// Represents a storage device
#[derive(Serialize, Debug)]
pub struct StorageDevice {
    name: String,
    description: String,
}

/// D-Bus client for the storage service
pub struct StorageClient<'a> {
    pub connection: Connection,
    calculator_proxy: CalculatorProxy<'a>,
    storage_proxy: Storage1Proxy<'a>,
}

impl<'a> StorageClient<'a> {
    pub async fn new(connection: Connection) -> Result<StorageClient<'a>, ServiceError> {
        Ok(Self {
            calculator_proxy: CalculatorProxy::new(&connection).await?,
            storage_proxy: Storage1Proxy::new(&connection).await?,
            connection,
        })
    }

    /// Returns the proposal proxy
    ///
    /// The proposal might not exist.
    // NOTE: should we implement some kind of memoization?
    async fn proposal_proxy(&self) -> Result<StorageProposalProxy<'a>, ServiceError> {
        Ok(StorageProposalProxy::new(&self.connection).await?)
    }

    /// Returns the available devices
    ///
    /// These devices can be used for installing the system.
    pub async fn available_devices(&self) -> Result<Vec<StorageDevice>, ServiceError> {
        let devices: Vec<_> = self
            .calculator_proxy
            .available_devices()
            .await?
            .into_iter()
            .map(|(name, description, _)| StorageDevice { name, description })
            .collect();
        Ok(devices)
    }

    /// Returns the candidate devices for the proposal
    pub async fn candidate_devices(&self) -> Result<Vec<String>, ServiceError> {
        Ok(self.proposal_proxy().await?.candidate_devices().await?)
    }

    /// Runs the probing process
    pub async fn probe(&self) -> Result<(), ServiceError> {
        Ok(self.storage_proxy.probe().await?)
    }

    pub async fn calculate(
        &self,
        candidate_devices: Vec<String>,
        encryption_password: String,
        lvm: bool,
    ) -> Result<u32, ServiceError> {
        let mut settings: HashMap<&str, zbus::zvariant::Value<'_>> = HashMap::new();
        settings.insert(
            "CandidateDevices",
            zbus::zvariant::Value::new(candidate_devices),
        );
        settings.insert(
            "EncryptionPassword",
            zbus::zvariant::Value::new(encryption_password),
        );
        settings.insert("LVM", zbus::zvariant::Value::new(lvm));
        Ok(self.calculator_proxy.calculate(settings).await?)
    }
}
