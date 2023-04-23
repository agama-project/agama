//! Bigger rank means it is more important

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct RankedLanguage {
    #[serde(rename(deserialize = "languageId"))]
    pub id: String,
    /// Bigger rank means it is more important
    pub rank: u16
}

#[derive(Debug, Deserialize)]
pub struct RankedLanguages {
    pub language: Option<Vec<RankedLanguage>>
}

#[derive(Debug, Deserialize)]
pub struct RankedTerritory {
    #[serde(rename(deserialize = "territoryId"))]
    pub id: String,
    /// Bigger rank means it is more important
    pub rank: u16
}

#[derive(Debug, Deserialize)]
pub struct RankedTerritories {
    pub territory: Option<Vec<RankedTerritory>>
}