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

//! This module aims to read the information in the X Keyboard Configuration Database.
//!
//! <https://freedesktop.org/Software/XKeyboardConfig>

use quick_xml::de::from_str;
use serde::Deserialize;
use std::{error::Error, fs};

const DB_PATH: &str = "/usr/share/X11/xkb/rules/base.xml";

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
        let contents = fs::read_to_string(path)?;
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
