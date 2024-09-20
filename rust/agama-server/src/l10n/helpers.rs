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

//! Helpers functions
//!
//! FIXME: find a better place for the localization function

use agama_locale_data::LocaleId;
use gettextrs::{bind_textdomain_codeset, setlocale, textdomain, LocaleCategory};
use std::env;

/// Initializes the service locale.
///
/// It returns the used locale. Defaults to `en_US.UTF-8`.
pub fn init_locale() -> Result<LocaleId, Box<dyn std::error::Error>> {
    let lang = env::var("LANG").unwrap_or("en_US.UTF-8".to_string());
    let locale: LocaleId = lang.as_str().try_into().unwrap_or_default();

    set_service_locale(&locale);
    textdomain("xkeyboard-config")?;
    bind_textdomain_codeset("xkeyboard-config", "UTF-8")?;
    Ok(locale)
}

/// Sets the service locale.
///
pub fn set_service_locale(locale: &LocaleId) {
    if setlocale(LocaleCategory::LcAll, locale.to_string()).is_none() {
        log::warn!("Could not set the locale");
    }
}
