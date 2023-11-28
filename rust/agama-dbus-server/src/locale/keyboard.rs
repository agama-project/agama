use agama_locale_data::{get_localectl_keymaps, keyboard::XkbConfigRegistry, KeymapId};
use gettextrs::*;
use std::collections::HashMap;

// Minimal representation of a keymap
pub struct Keymap {
    pub id: KeymapId,
    description: String,
}

impl Keymap {
    pub fn new(id: KeymapId, description: &str) -> Self {
        Self {
            id,
            description: description.to_string(),
        }
    }

    pub fn localized_description(&self) -> String {
        gettext(&self.description)
    }
}

/// Returns the list of keymaps to offer.
///
/// It only includes the keyboards supported by `localectl` but getting
/// the description from the X Keyboard Configuration Database.
pub fn get_keymaps() -> anyhow::Result<Vec<Keymap>> {
    let mut keymaps: Vec<Keymap> = vec![];
    let xkb_descriptions = get_keymap_descriptions();
    let keymap_ids = get_localectl_keymaps()?;
    for keymap_id in keymap_ids {
        let keymap_id_str = keymap_id.to_string();
        if let Some(description) = xkb_descriptions.get(&keymap_id_str) {
            keymaps.push(Keymap::new(keymap_id, description));
        } else {
            log::debug!("Keyboard '{}' not found in xkb database", keymap_id_str);
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
