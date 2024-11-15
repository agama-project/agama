// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

//! # D-Bus interface proxy for: `org.opensuse.Agama.Storage1.ISCSI.Node`
//!
//! This code was generated by `zbus-xmlgen` `5.0.0` from D-Bus introspection data.
//! Source: `org.opensuse.Agama.Storage1.ISCSI.Node.bus.xml`.
//!
//! You may prefer to adapt it, instead of using it verbatim.
//!
//! More information can be found in the [Writing a client proxy] section of the zbus
//! documentation.
//!
//! This type implements the [D-Bus standard interfaces], (`org.freedesktop.DBus.*`) for which the
//! following zbus API can be used:
//!
//! * [`zbus::fdo::PropertiesProxy`]
//! * [`zbus::fdo::IntrospectableProxy`]
//!
//! Consequently `zbus-xmlgen` did not generate code for the above interfaces.
//!
//! [Writing a client proxy]: https://dbus2.github.io/zbus/client.html
//! [D-Bus standard interfaces]: https://dbus.freedesktop.org/doc/dbus-specification.html#standard-interfaces,
use zbus::proxy;
#[proxy(
    default_service = "org.opensuse.Agama.Storage1",
    interface = "org.opensuse.Agama.Storage1.ISCSI.Node",
    assume_defaults = true
)]
pub trait Node {
    /// Login method
    fn login(
        &self,
        options: std::collections::HashMap<&str, &zbus::zvariant::Value<'_>>,
    ) -> zbus::Result<u32>;

    /// Logout method
    fn logout(&self) -> zbus::Result<u32>;

    /// Address property
    #[zbus(property)]
    fn address(&self) -> zbus::Result<String>;

    /// Connected property
    #[zbus(property)]
    fn connected(&self) -> zbus::Result<bool>;

    /// IBFT property
    #[zbus(property, name = "IBFT")]
    fn ibft(&self) -> zbus::Result<bool>;

    /// Interface property
    #[zbus(property)]
    fn interface(&self) -> zbus::Result<String>;

    /// Port property
    #[zbus(property)]
    fn port(&self) -> zbus::Result<u32>;

    /// Startup property
    #[zbus(property)]
    fn startup(&self) -> zbus::Result<String>;
    #[zbus(property)]
    fn set_startup(&self, value: &str) -> zbus::Result<()>;

    /// Target property
    #[zbus(property)]
    fn target(&self) -> zbus::Result<String>;
}