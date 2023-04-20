use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Localization {
    pub name: Vec<LocalizationEntry>
}

impl Localization {
    pub fn name_for(&self, language: &str) -> String {
        self.name.iter()
            .find(|n| n.language == language)
            .expect("Wrong language {language}")
            .value.clone()
    }
}

#[derive(Debug, Deserialize)]
pub struct LocalizationEntry {
    #[serde(rename(deserialize = "languageId"))]
    pub language: String,
    #[serde(rename(deserialize = "trName"))]
    pub value: String
}