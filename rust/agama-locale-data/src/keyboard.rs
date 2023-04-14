use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct RankedLanguage {
    #[serde(rename(deserialize = "languageId"))]
    pub id: String,
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
    pub rank: u16
}

#[derive(Debug, Deserialize)]
pub struct RankedTerritories {
    pub territory: Option<Vec<RankedTerritory>>
}

#[derive(Debug, Deserialize)]
pub struct Keyboard {
    #[serde(rename(deserialize = "keyboardId"))]
    pub id: String,
    pub description: String,
    pub ascii: bool,
    pub comment: Option<String>,
    pub languages: RankedLanguages,
    pub territories: RankedTerritories
}

#[derive(Debug, Deserialize)]
pub struct Keyboards {
    pub keyboard: Vec<Keyboard>
}
