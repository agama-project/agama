use agama_locale_data::{get_xkeyboards, keyboard::XkbConfigRegistry};
use gettextrs::*;

// Minimal representation of a keymap
pub struct Keymap {
    layout: String,
    variant: Option<String>,
    description: String,
}

impl Keymap {
    pub fn new(layout: &str, variant: Option<&str>, description: &str) -> Self {
        Self {
            layout: layout.to_string(),
            variant: variant.map(|v| v.to_string()),
            description: description.to_string(),
        }
    }

    /// Returns the ID in the form "layout(variant)"
    ///
    /// TODO: should we store this ID instead of using separate fields?
    pub fn id(&self) -> String {
        if let Some(var) = &self.variant {
            format!("{}({})", &self.layout, &var)
        } else {
            format!("{}", &self.layout)
        }
    }

    pub fn localized_description(&self) -> String {
        gettext(&self.description)
    }
}

/// Returns the list of keymaps to offer.
///
/// It only includes the keyboards that are listed in langtable but getting the description
/// from the xkb database.
pub fn get_keymaps() -> Vec<Keymap> {
    let xkb_keymaps = get_xkb_keymaps();
    let xkeyboards = get_xkeyboards().unwrap();
    let known_ids: Vec<String> = xkeyboards.keyboard.into_iter().map(|k| k.id).collect();
    xkb_keymaps
        .into_iter()
        .filter(|k| known_ids.contains(&k.id()))
        .collect()
}

/// Returns the list of keymaps
fn get_xkb_keymaps() -> Vec<Keymap> {
    let layouts = XkbConfigRegistry::from_system().unwrap();
    let mut keymaps = vec![];

    for layout in layouts.layout_list.layouts {
        let name = layout.config_item.name;
        keymaps.push(Keymap::new(&name, None, &layout.config_item.description));

        for variant in layout.variants_list.variants {
            keymaps.push(Keymap::new(
                &name,
                Some(&variant.config_item.name),
                &variant.config_item.description,
            ));
        }
    }

    keymaps
}
