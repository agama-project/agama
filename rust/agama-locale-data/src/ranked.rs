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
    #[serde(default)]
    pub language: Vec<RankedLanguage>
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
    #[serde(default)]
    pub territory: Vec<RankedTerritory>
}

#[derive(Debug, Deserialize)]
pub struct RankedLocale {
    #[serde(rename(deserialize = "localeId"))]
    pub id: String,
    pub rank: u16
}

#[derive(Debug, Deserialize)]
pub struct RankedLocales {
    #[serde(default)]
    pub locale: Vec<RankedLocale>
}
