use serde::Deserialize;
use std::fs::File;
use std::io::BufReader;
use quick_xml::de::Deserializer;
use flate2::bufread::GzDecoder;

pub mod keyboard;
pub mod language;
pub mod localization;
pub mod territory;
pub mod timezone_part;
pub mod ranked;
pub mod deprecated_timezones;

pub fn get_keyboards() -> keyboard::Keyboards {
    const FILE_PATH: &str = "/usr/share/langtable/data/keyboards.xml.gz";
    let file = File::open(FILE_PATH).expect("Failed to read langtable-data.");
    let reader = BufReader::new(GzDecoder::new(BufReader::new(&file)));
    let mut deserializer = Deserializer::from_reader(reader);
    keyboard::Keyboards::deserialize(&mut deserializer).expect("Failed to deserialize keyboard entry")
}

pub fn get_languages() -> language::Languages {
    const FILE_PATH: &str = "/usr/share/langtable/data/languages.xml.gz";
    let file = File::open(FILE_PATH).expect("Failed to read langtable-data.");
    let reader = BufReader::new(GzDecoder::new(BufReader::new(&file)));
    let mut deserializer = Deserializer::from_reader(reader);
    language::Languages::deserialize(&mut deserializer).expect("Failed to deserialize language entry")
}

pub fn get_territories() -> territory::Territories {
    const FILE_PATH: &str = "/usr/share/langtable/data/territories.xml.gz";
    let file = File::open(FILE_PATH).expect("Failed to read langtable-data.");
    let reader = BufReader::new(GzDecoder::new(BufReader::new(&file)));
    let mut deserializer = Deserializer::from_reader(reader);
    territory::Territories::deserialize(&mut deserializer).expect("Failed to deserialize territory entry")
}

pub fn get_timezone_parts() -> timezone_part::TimezoneIdParts {
    const FILE_PATH: &str = "/usr/share/langtable/data/timezoneidparts.xml.gz";
    let file = File::open(FILE_PATH).expect("Failed to read langtable-data.");
    let reader = BufReader::new(GzDecoder::new(BufReader::new(&file)));
    let mut deserializer = Deserializer::from_reader(reader);
    timezone_part::TimezoneIdParts::deserialize(&mut deserializer).expect("Failed to deserialize timezone part entry")
}

pub fn get_timezones() -> Vec<String> {
    chrono_tz::TZ_VARIANTS.iter()
    .filter(|&tz| !crate::deprecated_timezones::DEPRECATED_TIMEZONES.contains(&tz.name())) // Filter out deprecated asmera
    .map(|e| e.name().to_string())
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_keyboards() {
        let result = get_keyboards();
        assert_eq!(result.keyboard.len(), 247);
        let first = result.keyboard.first().expect("no keyboards");
        assert_eq!(first.id, "ad")
    }

    #[test]
    fn test_get_languages() {
        let result = get_languages();
        assert_eq!(result.language.len(), 356);
        let first = result.language.first().expect("no keyboards");
        assert_eq!(first.id, "aa")
    }

    #[test]
    fn test_get_territories() {
        let result = get_territories();
        assert_eq!(result.territory.len(), 257);
        let first = result.territory.first().expect("no keyboards");
        assert_eq!(first.id, "001") // looks strange, but it is meta id for whole world
    }

    #[test]
    fn test_get_timezone_parts() {
        let result = get_timezone_parts();
        assert_eq!(result.timezone_part.len(), 441);
        let first = result.timezone_part.first().expect("no keyboards");
        assert_eq!(first.id, "Abidjan")
    }

    #[test]
    fn test_get_timezones() {
        let result = get_timezones();
        //assert_eq!(result.len(), 574);
        let first = result.first().expect("no keyboards");
        assert_eq!(first, "Africa/Abidjan");
        // test that we filter out deprecates Asmera ( there is already recent Asmara)
        let asmera = result.iter().find(|&t| *t == "Africa/Asmera".to_string());
        assert_eq!(asmera, None);
        let asmara = result.iter().find(|&t| *t == "Africa/Asmara".to_string());
        assert_eq!(asmara, Some(&"Africa/Asmara".to_string()));
        // here test that timezones from timezones matches ones in langtable ( as timezones can contain deprecated ones)
        // so this test catch if there is new zone that is not translated or if a zone is become deprecated
        let timezones = get_timezones();
        let localized = get_timezone_parts().localize_timezones("de", &timezones);
        let _res : Vec<(String, String)> = timezones.into_iter().zip(localized.into_iter()).collect();
    }
}