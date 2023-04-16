use serde::Deserialize;

use crate::keyboard::RankedTerritories;

#[derive(Debug, Deserialize)]
pub struct Language {
    #[serde(rename(deserialize = "languageId"))]
    pub id: String,
    pub territories: RankedTerritories
}

#[derive(Debug, Deserialize)]
pub struct Languages {
    pub language: Vec<Language>
}