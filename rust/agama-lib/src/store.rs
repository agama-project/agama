mod software;
mod storage;
mod users;

use crate::error::ServiceError;
use crate::install_settings::{InstallSettings, Scope};
use crate::store::software::SoftwareStore;
use crate::store::storage::StorageStore;
use crate::store::users::UsersStore;
use std::error::Error;
use zbus::Connection;

/// Loading and storing the settings in the D-Bus service
///
/// This struct uses the default connection built by [connection function](super::connection).
pub struct Store<'a> {
    users: UsersStore<'a>,
    software: SoftwareStore<'a>,
    storage: StorageStore<'a>,
}

impl<'a> Store<'a> {
    pub async fn new(connection: Connection) -> Result<Store<'a>, ServiceError> {
        Ok(Self {
            users: UsersStore::new(connection.clone()).await?,
            software: SoftwareStore::new(connection.clone()).await?,
            storage: StorageStore::new(connection).await?,
        })
    }

    /// Loads the installation settings from the D-Bus service
    pub async fn load(&self, only: Option<Vec<Scope>>) -> Result<InstallSettings, Box<dyn Error>> {
        let scopes = match only {
            Some(scopes) => scopes,
            None => Scope::all().to_vec(),
        };

        let mut settings: InstallSettings = Default::default();
        if scopes.contains(&Scope::Storage) {
            settings.storage = Some(self.storage.load().await?);
        }

        if scopes.contains(&Scope::Software) {
            settings.software = Some(self.software.load().await?);
        }

        if scopes.contains(&Scope::Users) {
            settings.user = Some(self.users.load().await?);
        }

        // TODO: use try_join here
        Ok(settings)
    }

    /// Stores the given installation settings in the D-Bus service
    pub async fn store(&self, settings: &InstallSettings) -> Result<(), Box<dyn Error>> {
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
