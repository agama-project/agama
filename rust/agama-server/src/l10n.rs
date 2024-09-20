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

mod dbus;
pub mod error;
pub mod helpers;
mod keyboard;
pub mod l10n;
mod locale;
mod timezone;
pub mod web;

pub use agama_lib::localization::model::LocaleConfig;
pub use dbus::export_dbus_objects;
pub use error::LocaleError;
pub use keyboard::Keymap;
pub use l10n::L10n;
pub use locale::LocaleEntry;
pub use timezone::TimezoneEntry;
