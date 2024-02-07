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

    pub async fn language(&self) -> Result<Option<String>, ServiceError> {
        let locales = self.localization_proxy.locales().await?;
        let mut iter = locales.into_iter();
        let first = iter.next();
        // may be None
        Ok(first)
    }

    pub async fn keyboard(&self) -> Result<String, ServiceError> {
        Ok(self.localization_proxy.keymap().await?)
    }

    pub async fn timezone(&self) -> Result<String, ServiceError> {
        Ok(self.localization_proxy.timezone().await?)
    }

    pub async fn set_language(&self, language: &str) -> zbus::Result<()> {
        let locales = [language];
        self.localization_proxy.set_locales(&locales).await
    }

    pub async fn set_keyboard(&self, keyboard: &str) -> zbus::Result<()> {
        self.localization_proxy.set_keymap(keyboard).await
    }

    pub async fn set_timezone(&self, timezone: &str) -> zbus::Result<()> {
        self.localization_proxy.set_timezone(timezone).await
    }
}
