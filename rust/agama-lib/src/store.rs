//! Load/store the settings from/to the D-Bus services.
// TODO: quickly explain difference between FooSettings and FooStore, with an example

use crate::error::ServiceError;
use crate::install_settings::InstallSettings;
use crate::{
    localization::LocalizationStore, network::NetworkStore, product::ProductStore,
    software::SoftwareStore, storage::StorageStore, users::UsersStore,
};
use zbus::Connection;

/// Struct that loads/stores the settings from/to the D-Bus services.
///
/// It is composed by a set of "stores" that are able to load/store the
/// settings for each service.
///
/// This struct uses the default connection built by [connection function](super::connection).
pub struct Store<'a> {
    users: UsersStore,
    network: NetworkStore,
    product: ProductStore<'a>,
    software: SoftwareStore<'a>,
    storage: StorageStore<'a>,
    localization: LocalizationStore,
}

impl<'a> Store<'a> {
    pub async fn new(
        connection: Connection,
        http_client: reqwest::Client,
    ) -> Result<Store<'a>, ServiceError> {
        Ok(Self {
            localization: LocalizationStore::new().await?,
            users: UsersStore::new().await?,
            network: NetworkStore::new(http_client).await?,
            product: ProductStore::new(connection.clone()).await?,
            software: SoftwareStore::new(connection.clone()).await?,
            storage: StorageStore::new(connection).await?,
        })
    }

    /// Loads the installation settings from the HTTP interface.
    pub async fn load(&self) -> Result<InstallSettings, ServiceError> {
        let mut settings: InstallSettings = Default::default();
        settings.network = Some(self.network.load().await?);
        settings.software = Some(self.software.load().await?);
        settings.user = Some(self.users.load().await?);
        settings.product = Some(self.product.load().await?);
        settings.localization = Some(self.localization.load().await?);

        let storage_settings = self.storage.load().await?;
        settings.storage = storage_settings.storage.clone();
        settings.storage_autoyast = storage_settings.storage_autoyast.clone();

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
        // ordering: localization after product as some product may miss some locales
        if let Some(localization) = &settings.localization {
            self.localization.store(localization).await?;
        }
        if let Some(software) = &settings.software {
            self.software.store(software).await?;
        }
        if let Some(user) = &settings.user {
            self.users.store(user).await?;
        }
        if settings.storage.is_some() || settings.storage_autoyast.is_some() {
            self.storage.store(settings.into()).await?
        }
        Ok(())
    }
}
