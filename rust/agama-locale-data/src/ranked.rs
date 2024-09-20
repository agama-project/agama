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

//! Bigger rank means it is more important
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct RankedLanguage {
    #[serde(rename(deserialize = "languageId"))]
    pub id: String,
    /// Bigger rank means it is more important
    pub rank: u16,
}

#[derive(Debug, Deserialize)]
pub struct RankedLanguages {
    #[serde(default)]
    pub language: Vec<RankedLanguage>,
}

#[derive(Debug, Deserialize)]
pub struct RankedTerritory {
    #[serde(rename(deserialize = "territoryId"))]
    pub id: String,
    /// Bigger rank means it is more important
    pub rank: u16,
}

#[derive(Debug, Deserialize)]
pub struct RankedTerritories {
    #[serde(default)]
    pub territory: Vec<RankedTerritory>,
}

#[derive(Debug, Deserialize)]
pub struct RankedLocale {
    #[serde(rename(deserialize = "localeId"))]
    pub id: String,
    pub rank: u16,
}

#[derive(Debug, Deserialize)]
pub struct RankedLocales {
    #[serde(default)]
    pub locale: Vec<RankedLocale>,
}
