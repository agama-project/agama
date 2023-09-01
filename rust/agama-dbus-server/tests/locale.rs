mod common;

use self::common::DBusServer;
use agama_dbus_server::locale;
use agama_lib::locale::LocaleProxy;
use async_std::test;

#[test]
async fn test_locales_list() {
    let mut server = DBusServer::new().start().await;
    let connection = server.connection();
    locale::export_dbus_objects(&connection).await.unwrap();
    server.request_name().await.unwrap();

    let proxy = LocaleProxy::new(&connection).await.unwrap();
    let locales = proxy.locales().await.unwrap();
    assert_eq!(locales, vec!["en_US.UTF-8".to_string()]);
}

#[test]
async fn test_labels_for_locales() {
    let mut server = DBusServer::new().start().await;
    let connection = server.connection();
    locale::export_dbus_objects(&connection).await.unwrap();
    server.request_name().await.unwrap();

    let proxy = LocaleProxy::new(&connection).await.unwrap();
    let labels = proxy.labels_for_locales().await.unwrap();
    let ((name, territory), (l10n_name, l10n_territory)) = labels.first().unwrap();
    assert_eq!(name, "English");
    assert_eq!(territory, "United States");
    assert_eq!(l10n_name, "English");
    assert_eq!(l10n_territory, "United States");
}
