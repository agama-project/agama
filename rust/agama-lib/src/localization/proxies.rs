use zbus::dbus_proxy;

#[dbus_proxy(
    interface = "org.opensuse.Agama1.Locale",
    default_service = "org.opensuse.Agama1",
    default_path = "/org/opensuse/Agama1/Locale"
)]
trait Locale {
    /// Commit method
    fn commit(&self) -> zbus::Result<()>;

    /// ListKeymaps method
    fn list_keymaps(&self) -> zbus::Result<Vec<(String, String)>>;

    /// ListLocales method
    fn list_locales(&self) -> zbus::Result<Vec<(String, String, String)>>;

    /// ListTimezones method
    fn list_timezones(&self) -> zbus::Result<Vec<(String, Vec<String>)>>;

    /// Keymap property
    #[dbus_proxy(property)]
    fn keymap(&self) -> zbus::Result<String>;
    #[dbus_proxy(property)]
    fn set_keymap(&self, value: &str) -> zbus::Result<()>;

    /// Locales property
    #[dbus_proxy(property)]
    fn locales(&self) -> zbus::Result<Vec<String>>;
    #[dbus_proxy(property)]
    fn set_locales(&self, value: &[&str]) -> zbus::Result<()>;

    /// Timezone property
    #[dbus_proxy(property)]
    fn timezone(&self) -> zbus::Result<String>;
    #[dbus_proxy(property)]
    fn set_timezone(&self, value: &str) -> zbus::Result<()>;

    /// UILocale property
    #[dbus_proxy(property, name = "UILocale")]
    fn uilocale(&self) -> zbus::Result<String>;
    #[dbus_proxy(property)]
    fn set_uilocale(&self, value: &str) -> zbus::Result<()>;
}
