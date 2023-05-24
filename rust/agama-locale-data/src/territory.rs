use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Territory {
    #[serde(rename(deserialize = "territoryId"))]
    pub id: String,
    pub languages: crate::ranked::RankedLanguages,
    pub names: crate::localization::Localization
}

#[derive(Debug, Deserialize)]
pub struct Territories {
    pub territory: Vec<Territory>
}

impl Territories {
    pub fn find_by_id(&self, id: &str) -> Option<&Territory> {
        self.territory.iter().find(|t| t.id == id)
    }
}