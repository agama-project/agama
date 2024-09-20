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
    #[dbus_proxy(property, name = "UILocale")]
    fn set_uilocale(&self, value: &str) -> zbus::Result<()>;
}
