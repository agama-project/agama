use agama_locale_data::keyboard::XkbConfigRegistry;
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

pub fn get_xkb_keymaps() -> Vec<Keymap> {
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
