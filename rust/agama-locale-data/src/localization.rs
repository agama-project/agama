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

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Localization {
    pub name: Vec<LocalizationEntry>,
}

impl Localization {
    pub fn name_for(&self, language: &str) -> Option<String> {
        let entry = self.name.iter().find(|n| n.language == language)?;
        Some(entry.value.clone())
    }
}

#[derive(Debug, Deserialize)]
pub struct LocalizationEntry {
    #[serde(rename(deserialize = "languageId"))]
    pub language: String,
    #[serde(rename(deserialize = "trName"))]
    pub value: String,
}
