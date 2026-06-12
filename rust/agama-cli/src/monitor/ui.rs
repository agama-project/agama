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
mod issues;
mod layout;
mod progress;
mod question;
mod summary;

use agama_utils::api::Scope;
pub use content::Content;
use gettextrs::gettext;
pub use layout::create_layout;
pub use question::{QuestionUiState, QuestionWidget};
pub use summary::Summary;

/// Converts a Scope to a human-readable string
pub fn scope_to_string(scope: &Scope) -> String {
    match scope {
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Bootloader => gettext("Bootloader"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Manager => gettext("Manager"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Network => gettext("Network"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Ntp => gettext("NTP"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Hostname => gettext("Hostname"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::L10n => gettext("Localization"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Product => gettext("Product"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Access => gettext("Remote Access"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Software => gettext("Software"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Storage => gettext("Storage"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Files => gettext("Files"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::ISCSI => gettext("iSCSI"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::DASD => gettext("DASD"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::ZFCP => gettext("zFCP"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Users => gettext("Users"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Proxy => gettext("Proxy"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Questions => gettext("Questions"),
        // TRANSLATORS: an installation "scope", used in the "agama monitor" command
        Scope::Security => gettext("Security"),
    }
}
