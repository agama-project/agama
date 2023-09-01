mod common;

use self::common::DBusServer;
use agama_dbus_server::locale;
use agama_lib::locale::LocaleProxy;
use async_std::test;
use std::error::Error;

#[test]
async fn test_locales_list() -> Result<(), Box<dyn Error>> {
    let mut server = DBusServer::new().start().await;
    let connection = server.connection();
    locale::export_dbus_objects(&connection).await?;
    server.request_name().await?;

    let proxy = LocaleProxy::new(&connection).await?;
    let locales = proxy.locales().await?;
    assert_eq!(locales, vec!["en_US.UTF-8".to_string()]);
    Ok(())
}

#[test]
async fn test_labels_for_locales() -> Result<(), Box<dyn Error>> {
    let mut server = DBusServer::new().start().await;
    let connection = server.connection();
    locale::export_dbus_objects(&connection).await?;
    server.request_name().await?;

    let proxy = LocaleProxy::new(&connection).await?;
    let labels = proxy.labels_for_locales().await?;
    let ((name, territory), (l10n_name, l10n_territory)) = labels.first().unwrap();
    assert_eq!(name, "English");
    assert_eq!(territory, "United States");
    assert_eq!(l10n_name, "English");
    assert_eq!(l10n_territory, "United States");
    Ok(())
}
