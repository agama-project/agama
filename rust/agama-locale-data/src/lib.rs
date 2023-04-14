use serde::Deserialize;
use std::fs::File;
use std::io::BufReader;
use quick_xml::de::Deserializer;
use flate2::bufread::GzDecoder;

pub fn add(left: usize, right: usize) -> usize {
    left + right
}

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

pub fn get_keyboards() -> Keyboards {
    const FILE_PATH: &str = "/usr/share/langtable/data/keyboards.xml.gz";
    let file = File::open(FILE_PATH).expect("Failed to read langtable-data.");
    let reader = BufReader::new(GzDecoder::new(BufReader::new(&file)));
    let mut deserializer = Deserializer::from_reader(reader);
    Keyboards::deserialize(&mut deserializer).expect("Failed to deserialize keyboard entry")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = get_keyboards();
        assert_eq!(result.keyboard.len(), 247);
        let first = result.keyboard.first().expect("no keyboards");
        assert_eq!(first.id, "ad")
    }
}
