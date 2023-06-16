use serde::Deserialize;

use crate::ranked::{RankedLocales, RankedTerritories};

#[derive(Debug, Deserialize)]
pub struct Language {
    #[serde(rename(deserialize = "languageId"))]
    pub id: String,
    pub territories: RankedTerritories,
    pub locales: RankedLocales,
    pub names: crate::localization::Localization,
}

#[derive(Debug, Deserialize)]
pub struct Languages {
    pub language: Vec<Language>,
}

impl Languages {
    pub fn find_by_id(&self, id: &str) -> Option<&Language> {
        self.language.iter().find(|t| t.id == id)
    }
}
