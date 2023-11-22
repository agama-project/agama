//! This module aims to read the information in the X Keyboard Configuration Database.
//!
//! https://freedesktop.org/Software/XKeyboardConfig

use quick_xml::de::from_str;
use serde::Deserialize;
use std::{error::Error, fs};

const DB_PATH: &'static str = "/usr/share/X11/xkb/rules/base.xml";

/// X Keyboard Configuration Database
#[derive(Deserialize, Debug)]
pub struct XkbConfigRegistry {
    #[serde(rename = "layoutList")]
    pub layout_list: LayoutList,
}

impl XkbConfigRegistry {
    /// Reads the database from the given file
    ///
    /// - `path`: database path.
    pub fn from(path: &str) -> Result<Self, Box<dyn Error>> {
        let contents = fs::read_to_string(&path)?;
        Ok(from_str(&contents)?)
    }

    /// Reads the database from the default path.
    pub fn from_system() -> Result<Self, Box<dyn Error>> {
        Self::from(DB_PATH)
    }
}

#[derive(Deserialize, Debug)]
pub struct LayoutList {
    #[serde(rename = "layout")]
    pub layouts: Vec<Layout>,
}

#[derive(Deserialize, Debug)]
pub struct Layout {
    #[serde(rename = "configItem")]
    pub config_item: ConfigItem,
    #[serde(rename = "variantList", default)]
    pub variants_list: VariantList,
}

#[derive(Deserialize, Debug)]
pub struct ConfigItem {
    pub name: String,
    #[serde(rename = "description")]
    pub description: String,
}

#[derive(Deserialize, Debug, Default)]
pub struct VariantList {
    #[serde(rename = "variant", default)]
    pub variants: Vec<Variant>,
}

#[derive(Deserialize, Debug)]
pub struct Variant {
    #[serde(rename = "configItem")]
    pub config_item: VariantConfigItem,
}

#[derive(Deserialize, Debug)]
pub struct VariantConfigItem {
    pub name: String,
    pub description: String,
}
