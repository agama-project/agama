// Copyright (c) [2026] SUSE LLC
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

//! UI rendering modules for the monitor TUI

mod content;
mod hints;
mod issues;
mod layout;
mod product;
mod progress;
mod separator;
mod status_bar;

use agama_utils::api::Scope;
pub use content::Content;
use gettextrs::gettext;
pub use hints::Hints;
pub use layout::create_layout;
pub use product::Product;
pub use separator::Separator;
pub use status_bar::StatusBar;

/// Converts a Scope to a human-readable string
pub fn scope_to_string(scope: &Scope) -> String {
    match scope {
        Scope::Manager => gettext("Manager"),
        Scope::Network => gettext("Network"),
        Scope::Ntp => gettext("NTP"),
        Scope::Hostname => gettext("Hostname"),
        Scope::L10n => gettext("Localization"),
        Scope::Product => gettext("Product"),
        Scope::Software => gettext("Software"),
        Scope::Storage => gettext("Storage"),
        Scope::Files => gettext("Files"),
        Scope::ISCSI => gettext("iSCSI"),
        Scope::DASD => gettext("DASD"),
        Scope::ZFCP => gettext("zFCP"),
        Scope::Users => gettext("Users"),
    }
}
