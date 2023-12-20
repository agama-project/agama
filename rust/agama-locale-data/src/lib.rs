use anyhow::Context;
use flate2::bufread::GzDecoder;
use quick_xml::de::Deserializer;
use serde::Deserialize;
use std::fs::File;
use std::io::BufRead;
use std::io::BufReader;
use std::process::Command;

pub mod deprecated_timezones;
pub mod keyboard;
pub mod language;
mod locale;
pub mod localization;
pub mod ranked;
pub mod territory;
pub mod timezone_part;

use keyboard::xkeyboard;

pub use locale::{InvalidLocaleCode, KeymapId, LocaleCode};

fn file_reader(file_path: &str) -> anyhow::Result<impl BufRead> {
    let file = File::open(file_path)
        .with_context(|| format!("Failed to read langtable-data ({})", file_path))?;
    let reader = BufReader::new(GzDecoder::new(BufReader::new(file)));
    Ok(reader)
}

/// Gets list of X11 keyboards structs
pub fn get_xkeyboards() -> anyhow::Result<xkeyboard::XKeyboards> {
    const FILE_PATH: &str = "/usr/share/langtable/data/keyboards.xml.gz";
    let reader = file_reader(FILE_PATH)?;
    let mut deserializer = Deserializer::from_reader(reader);
    let ret = xkeyboard::XKeyboards::deserialize(&mut deserializer)
        .context("Failed to deserialize keyboard entry")?;
    Ok(ret)
}

/// Gets list of available keymaps
///
/// ## Examples
/// Requires working localectl.
///
/// ```no_run
/// use agama_locale_data::KeymapId;
///
/// let key_maps = agama_locale_data::get_localectl_keymaps().unwrap();
/// let us: KeymapId = "us".parse().unwrap();
/// assert!(key_maps.contains(&us));
/// ```
pub fn get_localectl_keymaps() -> anyhow::Result<Vec<KeymapId>> {
    const BINARY: &str = "/usr/bin/localectl";
    let output = Command::new(BINARY)
        .arg("list-keymaps")
        .output()
        .context("failed to execute localectl list-maps")?
        .stdout;
    let output = String::from_utf8(output).context("Strange localectl output formatting")?;
    let ret: Vec<_> = output.lines().flat_map(|l| l.parse().ok()).collect();

    Ok(ret)
}

/// Returns struct which contain list of known languages
pub fn get_languages() -> anyhow::Result<language::Languages> {
    const FILE_PATH: &str = "/usr/share/langtable/data/languages.xml.gz";
    let reader = file_reader(FILE_PATH)?;
    let mut deserializer = Deserializer::from_reader(reader);
    let ret = language::Languages::deserialize(&mut deserializer)
        .context("Failed to deserialize language entry")?;
    Ok(ret)
}

/// Returns struct which contain list of known territories
pub fn get_territories() -> anyhow::Result<territory::Territories> {
    const FILE_PATH: &str = "/usr/share/langtable/data/territories.xml.gz";
    let reader = file_reader(FILE_PATH)?;
    let mut deserializer = Deserializer::from_reader(reader);
    let ret = territory::Territories::deserialize(&mut deserializer)
        .context("Failed to deserialize territory entry")?;
    Ok(ret)
}

/// Returns struct which contain list of known parts of timezones. Useful for translation
pub fn get_timezone_parts() -> anyhow::Result<timezone_part::TimezoneIdParts> {
    const FILE_PATH: &str = "/usr/share/langtable/data/timezoneidparts.xml.gz";
    let reader = file_reader(FILE_PATH)?;
    let mut deserializer = Deserializer::from_reader(reader);
    let ret = timezone_part::TimezoneIdParts::deserialize(&mut deserializer)
        .context("Failed to deserialize timezone part entry")?;
    Ok(ret)
}

/// Gets list of non-deprecated timezones
pub fn get_timezones() -> Vec<String> {
    chrono_tz::TZ_VARIANTS
        .iter()
        .filter(|&tz| !crate::deprecated_timezones::DEPRECATED_TIMEZONES.contains(&tz.name())) // Filter out deprecated asmera
        .map(|e| e.name().to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_keyboards() {
        let result = get_xkeyboards().unwrap();
        let first = result.keyboard.first().expect("no keyboards");
        assert_eq!(first.id, "ad")
    }

    #[test]
    fn test_get_languages() {
        let result = get_languages().unwrap();
        let first = result.language.first().expect("no languages");
        assert_eq!(first.id, "aa")
    }

    #[test]
    fn test_get_territories() {
        let result = get_territories().unwrap();
        let first = result.territory.first().expect("no territories");
        assert_eq!(first.id, "001") // looks strange, but it is meta id for whole world
    }

    #[test]
    fn test_get_timezone_parts() {
        let result = get_timezone_parts().unwrap();
        let first = result.timezone_part.first().expect("no timezone parts");
        assert_eq!(first.id, "Abidjan")
    }

    #[test]
    fn test_get_timezones() {
        let result = get_timezones();
        assert_eq!(result.len(), 430);
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
        let localized = get_timezone_parts()
            .unwrap()
            .localize_timezones("de", &timezones);
        let _res: Vec<(String, String)> = timezones.into_iter().zip(localized).collect();
    }
}
