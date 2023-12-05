use crate::error::ServiceError;
use crate::proxies::LocaleProxy;
use zbus::Connection;

/// D-Bus client for the software service
pub struct LocalizationClient<'a> {
    localization_proxy: LocaleProxy<'a>,
}

impl<'a> LocalizationClient<'a> {
    pub async fn new(connection: Connection) -> Result<LocalizationClient<'a>, ServiceError> {
        Ok(Self {
            localization_proxy: LocaleProxy::new(&connection).await?,
        })
    }

    pub async fn language(&self) -> Result<String, ServiceError> {
        let locales = self.localization_proxy.locales().await?;
        if locales.is_empty() {
            // FIXME is this right?
            Ok("".to_owned())
        } else {
            // without clone:
            // error[E0507]: cannot move out of index of `Vec<std::string::String>`
            // but why, it's a Vec<String> I should be able to move it?!
            Ok(locales[0].clone())
        }
    }

    pub async fn keyboard(&self) -> Result<String, ServiceError> {
        Ok(self.localization_proxy.keymap().await?)
    }

    pub async fn timezone(&self) -> Result<String, ServiceError> {
        Ok(self.localization_proxy.timezone().await?)
    }
}
