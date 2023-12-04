//! Load/store the settings from/to the D-Bus services.

use crate::error::ServiceError;
use crate::install_settings::{InstallSettings, Scope};
use crate::{
    network::NetworkStore, software::SoftwareStore, storage::StorageStore, users::UsersStore, product::ProductStore
};
use zbus::Connection;

/// Struct that loads/stores the settings from/to the D-Bus services.
///
/// It is composed by a set of "stores" that are able to load/store the
/// settings for each service.
///
/// This struct uses the default connection built by [connection function](super::connection).
pub struct Store<'a> {
    users: UsersStore<'a>,
    network: NetworkStore<'a>,
    product: ProductStore<'a>,
    software: SoftwareStore<'a>,
    storage: StorageStore<'a>,
}

impl<'a> Store<'a> {
    pub async fn new(connection: Connection) -> Result<Store<'a>, ServiceError> {
        Ok(Self {
            users: UsersStore::new(connection.clone()).await?,
            network: NetworkStore::new(connection.clone()).await?,
            product: ProductStore::new(connection.clone()).await?,
            software: SoftwareStore::new(connection.clone()).await?,
            storage: StorageStore::new(connection).await?,
        })
    }

    /// Loads the installation settings from the D-Bus service
    pub async fn load(&self, only: Option<Vec<Scope>>) -> Result<InstallSettings, ServiceError> {
        let scopes = match only {
            Some(scopes) => scopes,
            None => Scope::all().to_vec(),
        };

        let mut settings: InstallSettings = Default::default();
        if scopes.contains(&Scope::Network) {
            settings.network = Some(self.network.load().await?);
        }
        if scopes.contains(&Scope::Storage) {
            settings.storage = Some(self.storage.load().await?);
        }

        if scopes.contains(&Scope::Software) {
            settings.software = Some(self.software.load().await?);
        }

        if scopes.contains(&Scope::Users) {
            settings.user = Some(self.users.load().await?);
        }

        if scopes.contains(&Scope::Product) {
            settings.product = Some(self.product.load().await?);
        }

        // TODO: use try_join here
        Ok(settings)
    }

    /// Stores the given installation settings in the D-Bus service
    pub async fn store(&self, settings: &InstallSettings) -> Result<(), ServiceError> {
        if let Some(network) = &settings.network {
            self.network.store(network).await?;
        }
        // order is important here as network can be critical for connection
        // to registration server and selecting product is important for rest
        if let Some(product) = &settings.product {
            self.product.store(product).await?;
        }
        if let Some(software) = &settings.software {
            self.software.store(software).await?;
        }
        if let Some(user) = &settings.user {
            self.users.store(user).await?;
        }
        if let Some(storage) = &settings.storage {
            self.storage.store(storage).await?;
        }
        Ok(())
    }
}
