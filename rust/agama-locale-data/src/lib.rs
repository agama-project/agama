// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

use flate2::bufread::GzDecoder;
use keyboard::xkeyboard;
use quick_xml::de::Deserializer;
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::fs::File;
use std::io::BufRead;
use std::io::BufReader;
use std::process::Command;

pub mod deprecated_timezones;
mod error;
pub mod keyboard;
pub mod language;
mod locale;
pub mod localization;
pub mod ranked;
pub mod territory;
pub mod timezone_part;

pub use error::LocaleDataError;

pub type LocaleDataResult<T> = Result<T, LocaleDataError>;

pub use locale::{
    InvalidKeymapId, InvalidLocaleId, InvalidTimezoneId, KeymapId, LocaleId, TimezoneId,
};

fn file_reader(file_path: &str) -> LocaleDataResult<impl BufRead> {
    let file = File::open(file_path).map_err(|e| LocaleDataError::IO(file_path.to_string(), e))?;
    let reader = BufReader::new(GzDecoder::new(BufReader::new(file)));
    Ok(reader)
}

fn get_xml_data<T>(file_path: &str) -> LocaleDataResult<T>
where
    T: DeserializeOwned,
{
    let reader = file_reader(file_path)?;
    let mut deserializer = Deserializer::from_reader(reader);
    let ret = T::deserialize(&mut deserializer)
        .map_err(|e| LocaleDataError::Deserialize(file_path.to_string(), e))?;
    Ok(ret)
}

/// Gets list of X11 keyboards structs
pub fn get_xkeyboards() -> LocaleDataResult<xkeyboard::XKeyboards> {
    get_xml_data::<xkeyboard::XKeyboards>("/usr/share/langtable/data/keyboards.xml.gz")
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
pub fn get_localectl_keymaps() -> LocaleDataResult<Vec<KeymapId>> {
    let output = Command::new("localectl")
        .arg("list-keymaps")
        .output()
        .map_err(LocaleDataError::CouldNotReadKeymaps)?
        .stdout;
    let output = String::from_utf8_lossy(&output);
    let ret: Vec<_> = output.lines().flat_map(|l| l.parse().ok()).collect();

    Ok(ret)
}

/// Returns struct which contain list of known languages
pub fn get_languages() -> LocaleDataResult<language::Languages> {
    get_xml_data::<language::Languages>("/usr/share/langtable/data/languages.xml.gz")
}

/// Returns struct which contain list of known territories
pub fn get_territories() -> LocaleDataResult<territory::Territories> {
    get_xml_data::<territory::Territories>("/usr/share/langtable/data/territories.xml.gz")
}

/// Returns struct which contain list of known parts of timezones. Useful for translation
pub fn get_timezone_parts() -> LocaleDataResult<timezone_part::TimezoneIdParts> {
    get_xml_data::<timezone_part::TimezoneIdParts>(
        "/usr/share/langtable/data/timezoneidparts.xml.gz",
    )
}

/// Returns a hash mapping timezones to its main country (typically, the country of
/// the city that is used to name the timezone). The information is read from the
/// file /usr/share/zoneinfo/zone.tab.
pub fn get_timezone_countries() -> LocaleDataResult<HashMap<String, String>> {
    const FILE_PATH: &str = "/usr/share/zoneinfo/zone.tab";
    let content = std::fs::read_to_string(FILE_PATH)
        .map_err(|e| LocaleDataError::IO(FILE_PATH.to_string(), e))?;

    let countries = content
        .lines()
        .filter_map(|line| {
            if line.starts_with('#') {
                return None;
            }
            let fields: Vec<&str> = line.split('\t').collect();
            Some((fields.get(2)?.to_string(), fields.first()?.to_string()))
        })
        .collect();
    Ok(countries)
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
        assert_eq!(result.len(), 431);
        let first = result.first().expect("no keyboards");
        assert_eq!(first, "Africa/Abidjan");
        // test that we filter out deprecates Asmera ( there is already recent Asmara)
        let asmera = result.iter().find(|&t| t == "Africa/Asmera");
        assert_eq!(asmera, None);
        let asmara = result.iter().find(|&t| t == "Africa/Asmara");
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
