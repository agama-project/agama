use serde::Deserialize;

use crate::ranked::{RankedLanguages, RankedTerritories};

#[derive(Debug, Deserialize)]
pub struct XKeyboard {
    #[serde(rename(deserialize = "keyboardId"))]
    /// like "layout(variant)", for example "us" or "ua(phonetic)"
    pub id: String,
    ///  like "Ukrainian (phonetic)"
    pub description: String,
    pub ascii: bool,
    pub comment: Option<String>,
    pub languages: RankedLanguages,
    pub territories: RankedTerritories,
}

#[derive(Debug, Deserialize)]
pub struct XKeyboards {
    pub keyboard: Vec<XKeyboard>,
}
