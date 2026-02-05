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

use agama_locale_data::get_localectl_keymaps;
use agama_locale_data::keyboard::XkbConfigRegistry;
use agama_locale_data::KeymapId;
use agama_utils::api::l10n::Keymap;
use std::collections::HashMap;

/// Represents the keymaps database.
///
/// The list of supported keymaps is read from `systemd-localed` and the
/// descriptions from the X Keyboard Configuraiton Database (see
/// `agama_locale_data::XkbConfigRegistry`).
#[derive(Default)]
pub struct KeymapsDatabase {
    keymaps: Vec<Keymap>,
}

impl KeymapsDatabase {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_entries(data: &[Keymap]) -> Self {
        let mut database = Self::new();
        database.set_entries(data.to_vec());
        database
    }

    /// Reads the list of keymaps.
    pub fn read(&mut self) -> anyhow::Result<()> {
        self.set_entries(get_keymaps()?);
        Ok(())
    }

    pub fn exists(&self, id: &KeymapId) -> bool {
        self.keymaps.iter().any(|k| &k.id == id)
    }

    /// Returns the list of keymaps.
    pub fn entries(&self) -> &Vec<Keymap> {
        &self.keymaps
    }

    // Set the locales entries.
    fn set_entries(&mut self, keymaps: Vec<Keymap>) {
        self.keymaps = keymaps;
        self.keymaps.sort();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sorting_keymaps() {
        let entries = vec![
            Keymap::new("es".parse().unwrap(), "Spanish"),
            Keymap::new("us".parse().unwrap(), "English (US)"),
            Keymap::new("de".parse().unwrap(), "German"),
        ];

        let db = KeymapsDatabase::with_entries(&entries);
        let keymaps = db.entries();

        assert_eq!(keymaps[0].description.to_string(), "English (US)");
        assert_eq!(keymaps[1].description.to_string(), "German");
        assert_eq!(keymaps[2].description.to_string(), "Spanish");
    }
}

/// Returns the list of keymaps to offer.
///
/// It only includes the keyboards supported by `localectl` but getting
/// the description from the X Keyboard Configuration Database.
fn get_keymaps() -> anyhow::Result<Vec<Keymap>> {
    let mut keymaps: Vec<Keymap> = vec![];
    let xkb_descriptions = get_keymap_descriptions();
    let keymap_ids = get_localectl_keymaps()?;
    for keymap_id in keymap_ids {
        let keymap_id_str = keymap_id.to_string();
        if let Some(description) = xkb_descriptions.get(&keymap_id_str) {
            keymaps.push(Keymap::new(keymap_id, description));
        } else {
            tracing::debug!("Keyboard '{}' not found in xkb database", keymap_id_str);
        }
    }

    Ok(keymaps)
}

/// Returns a map of keymaps ids and its descriptions from the X Keyboard
/// Configuration Database.
fn get_keymap_descriptions() -> HashMap<String, String> {
    let layouts = XkbConfigRegistry::from_system().unwrap();
    let mut keymaps = HashMap::new();

    for layout in layouts.layout_list.layouts {
        let name = layout.config_item.name;
        keymaps.insert(name.to_string(), layout.config_item.description.to_string());

        for variant in layout.variants_list.variants {
            let id = format!("{}({})", &name, &variant.config_item.name);
            keymaps.insert(id, variant.config_item.description);
        }
    }

    keymaps
}
