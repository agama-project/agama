use serde::Deserialize;

use crate::ranked::{RankedTerritories, RankedLanguages};

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
