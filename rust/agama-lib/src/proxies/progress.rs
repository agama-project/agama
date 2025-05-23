//! # D-Bus interface proxy for: `org.opensuse.Agama1.Progress`
//!
//! This code was generated by `zbus-xmlgen` `5.0.0` from D-Bus introspection data.
//! Source: `org.opensuse.Agama.Storage1.bus.xml`.
//!
//! You may prefer to adapt it, instead of using it verbatim.
//!
//! More information can be found in the [Writing a client proxy] section of the zbus
//! documentation.
//!
//! This type implements the [D-Bus standard interfaces], (`org.freedesktop.DBus.*`) for which the
//! following zbus API can be used:
//!
//! * [`zbus::fdo::IntrospectableProxy`]
//! * [`zbus::fdo::ObjectManagerProxy`]
//! * [`zbus::fdo::PropertiesProxy`]
//!
//! Consequently `zbus-xmlgen` did not generate code for the above interfaces.
//!
//! [Writing a client proxy]: https://dbus2.github.io/zbus/client.html
//! [D-Bus standard interfaces]: https://dbus.freedesktop.org/doc/dbus-specification.html#standard-interfaces,
use zbus::proxy;
#[proxy(interface = "org.opensuse.Agama1.Progress", assume_defaults = true)]
pub trait Progress {
    /// ProgressChanged signal
    #[zbus(signal)]
    fn progress_changed(
        &self,
        total_steps: u32,
        current_step: (u32, &str),
        finished: bool,
        steps: Vec<&str>,
    ) -> zbus::Result<()>;

    /// CurrentStep property
    #[zbus(property)]
    fn current_step(&self) -> zbus::Result<(u32, String)>;

    /// Finished property
    #[zbus(property)]
    fn finished(&self) -> zbus::Result<bool>;

    /// TotalSteps property
    #[zbus(property)]
    fn total_steps(&self) -> zbus::Result<u32>;

    /// Steps property
    #[zbus(property)]
    fn steps(&self) -> zbus::Result<Vec<String>>;
}
