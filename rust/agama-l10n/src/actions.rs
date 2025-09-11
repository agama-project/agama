// Copyright (c) [2025] SUSE LLC
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

use crate::{model::L10n, LocaleError};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub enum L10nAction {
    #[serde(rename = "configureL10n")]
    ConfigureSystem(ConfigureSystemAction),
    ApplyConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigureSystemAction {
    pub language: Option<String>,
    pub keyboard: Option<String>,
}

impl ConfigureSystemAction {
    // FIXME: return an action error instead of using anyhow.
    pub fn run(self, model: &mut L10n) -> anyhow::Result<()> {
        if let Some(language) = self.language {
            let locale = &language.as_str().try_into()?;
            model.translate(locale)?;
        }

        if let Some(keyboard) = self.keyboard {
            let keymap = (&keyboard).parse().map_err(LocaleError::InvalidKeymap)?;
            model.set_ui_keymap(keymap)?;
        };

        Ok(())
    }
}
