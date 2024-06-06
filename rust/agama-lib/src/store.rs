//! Load/store the settings from/to the D-Bus services.
// TODO: quickly explain difference between FooSettings and FooStore, with an example

use crate::error::ServiceError;
use crate::install_settings::{InstallSettings, Scope};
use crate::{
    localization::LocalizationStore, network::NetworkStore, product::ProductStore,
    software::SoftwareStore, storage::StorageAutoyastStore, storage::StorageStore,
    users::UsersStore,
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
    network: NetworkStore,
    product: ProductStore<'a>,
    software: SoftwareStore<'a>,
    storage: StorageStore<'a>,
    storage_autoyast: StorageAutoyastStore<'a>,
    localization: LocalizationStore<'a>,
}

impl<'a> Store<'a> {
    pub async fn new(
        connection: Connection,
        http_client: reqwest::Client,
    ) -> Result<Store<'a>, ServiceError> {
        Ok(Self {
            localization: LocalizationStore::new(connection.clone()).await?,
            users: UsersStore::new(connection.clone()).await?,
            network: NetworkStore::new(http_client).await?,
            product: ProductStore::new(connection.clone()).await?,
            software: SoftwareStore::new(connection.clone()).await?,
            storage: StorageStore::new(connection.clone()).await?,
            storage_autoyast: StorageAutoyastStore::new(connection).await?,
        })
    }

    /// Loads the installation settings from the D-Bus service.
    ///
    /// NOTE: The storage AutoYaST settings cannot be loaded because they cannot be modified. The
    /// ability of using the storage AutoYaST settings from a JSON config file is temporary and it
    /// will be removed in the future.
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

        if scopes.contains(&Scope::Localization) {
            settings.localization = Some(self.localization.load().await?);
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
        if let Some(storage) = &settings.storage {
            self.storage.store(storage).await?;
        }
        if let Some(storage_autoyast) = &settings.storage_autoyast {
            // Storage scope has precedence.
            if settings.storage.is_none() {
                self.storage_autoyast.store(storage_autoyast.get()).await?;
            }
        }
        Ok(())
    }
}
