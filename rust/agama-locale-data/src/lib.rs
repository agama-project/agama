use serde::Deserialize;
use std::fs::File;
use std::io::BufReader;
use quick_xml::de::Deserializer;
use flate2::bufread::GzDecoder;

pub mod keyboard;

pub fn get_keyboards() -> keyboard::Keyboards {
    const FILE_PATH: &str = "/usr/share/langtable/data/keyboards.xml.gz";
    let file = File::open(FILE_PATH).expect("Failed to read langtable-data.");
    let reader = BufReader::new(GzDecoder::new(BufReader::new(&file)));
    let mut deserializer = Deserializer::from_reader(reader);
    keyboard::Keyboards::deserialize(&mut deserializer).expect("Failed to deserialize keyboard entry")
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
