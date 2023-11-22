use std::collections::HashMap;

use agama_locale_data::{get_xkeyboards, keyboard::XkbConfigRegistry};
use gettextrs::*;

// Minimal representation of a keymap
pub struct Keymap {
    pub id: String,
    description: String,
}

impl Keymap {
    pub fn new(layout: &str, description: &str) -> Self {
        Self {
            id: layout.to_string(),
            description: description.to_string(),
        }
    }

    pub fn localized_description(&self) -> String {
        gettext(&self.description)
    }
}

/// Returns the list of keymaps to offer.
///
/// It only includes the keyboards that are listed in langtable but getting the
/// description from the X Keyboard Configuration Database.
pub fn get_keymaps() -> Vec<Keymap> {
    let mut keymaps: Vec<Keymap> = vec![];
    let xkb_descriptions= get_keymap_descriptions();
    let xkeyboards = get_xkeyboards().unwrap();
    for keyboard in xkeyboards.keyboard {
        if let Some(description) = xkb_descriptions.get(&keyboard.id) {
            keymaps.push(Keymap::new(
                &keyboard.id, description
            ));
        } else {
            log::debug!("Keyboard '{}' not found in xkb database", keyboard.id);
        }
    }

    keymaps
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
