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

//! Implements support for reading software licenses.

use regex::Regex;
use serde::Serialize;
use std::{
    fmt::Display,
    fs::read_dir,
    path::{Path, PathBuf},
};
use thiserror::Error;

/// Represents a product license.
///
/// It contains the license ID and the list of languages that with a translation.
#[derive(Clone, Debug, Serialize)]
pub struct License {
    pub id: String,
    pub languages: Vec<LanguageTag>,
}

/// Represents a license content.
///
/// It contains the license ID and the body.
///
/// TODO: in the future it might contain a title, extracted from the text.
#[derive(Clone, Debug, Serialize)]
pub struct LicenseContent {
    pub id: String,
    pub body: String,
}

/// Simplified representation of the RFC 5646 language code.
#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct LanguageTag {
    // ISO-639
    pub language: String,
    // ISO-3166
    pub territory: Option<String>,
}

impl Default for LanguageTag {
    fn default() -> Self {
        LanguageTag {
            language: "en".to_string(),
            territory: None,
        }
    }
}

impl Display for LanguageTag {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if let Some(territory) = &self.territory {
            write!(f, "{}-{}", &self.language, territory)
        } else {
            write!(f, "{}", &self.language)
        }
    }
}

#[derive(Error, Debug)]
#[error("Not a valid language code: {0}")]
pub struct InvalidLanguageCode(String);

impl TryFrom<&str> for LanguageTag {
    type Error = InvalidLanguageCode;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        let language_regexp: Regex = Regex::new(r"^([[:alpha:]]+)(?:-([A-Z]+))?").unwrap();

        let captures = language_regexp
            .captures(value)
            .ok_or_else(|| InvalidLanguageCode(value.to_string()))?;

        Ok(Self {
            language: captures.get(1).unwrap().as_str().to_string(),
            territory: captures.get(2).map(|e| e.as_str().to_string()),
        })
    }
}

#[derive(Clone)]
pub struct LicensesRepo {
    pub path: std::path::PathBuf,
    pub licenses: Vec<License>,
}

impl LicensesRepo {
    pub fn new<P: AsRef<Path>>(path: P) -> Self {
        Self {
            path: path.as_ref().to_owned(),
            licenses: vec![],
        }
    }
    pub fn read(&mut self) -> Result<(), std::io::Error> {
        let entries = read_dir(self.path.as_path())?;

        for entry in entries {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                let license = License {
                    id: entry.file_name().into_string().unwrap(),
                    languages: Self::find_locales(&entry.path()),
                };
                self.licenses.push(license);
            }
        }
        Ok(())
    }

    /// Finds a license with the given ID and language.
    ///
    /// If the license is not found for the given language, it returns the default one.
    pub fn find(&self, id: &str, language: &LanguageTag) -> Option<LicenseContent> {
        let mut names: Vec<String> = vec![];
        if let Some(territory) = &language.territory {
            names.push(format!("license.{}_{}.txt", language.language, territory));
        }
        names.push(format!("license.{}.txt", language.language));
        names.push("license.txt".to_string());

        let license_path = names
            .into_iter()
            .map(|p| self.path.join(id).join(p))
            .find(|p| p.exists())?;

        let body: String = std::fs::read_to_string(license_path).unwrap();

        Some(LicenseContent {
            id: id.to_string(),
            body,
        })
    }

    fn find_locales(path: &PathBuf) -> Vec<LanguageTag> {
        let entries = read_dir(path).unwrap().filter_map(|entry| entry.ok());

        let files = entries
            .filter(|entry| entry.file_type().is_ok_and(|f| f.is_file()))
            .filter_map(|entry| {
                let path = entry.path();
                let file = path.file_name()?;
                file.to_owned().into_string().ok()
            });

        files.filter_map(|f| Self::file_to_locale(&f)).collect()
    }

    fn file_to_locale(name: &str) -> Option<LanguageTag> {
        if !name.starts_with("license") {
            return None;
        }
        let mut parts = name.split(".");
        let mut code = parts.nth(1)?;

        if code == "txt" {
            code = "en"
        }

        code.try_into().ok()
    }
}

impl Default for LicensesRepo {
    fn default() -> Self {
        let relative_path = Path::new("share/eula");
        let path = if relative_path.exists() {
            relative_path
        } else {
            Path::new("/usr/share/agama/eula")
        };
        Self::new(path)
    }
}

#[cfg(test)]
mod test {
    use super::LicensesRepo;
    use crate::software::license::LanguageTag;
    use std::path::Path;

    fn build_repo() -> LicensesRepo {
        let mut repo = LicensesRepo::new(Path::new("../share/eula"));
        repo.read().unwrap();
        repo
    }

    #[test]
    fn test_read_licenses_repository() {
        let repo = build_repo();
        let license = repo.licenses.first().unwrap();
        assert_eq!(&license.id, "license.final");
    }

    #[test]
    fn test_find_license() {
        let repo = build_repo();
        let language: LanguageTag = "es".try_into().unwrap();
        let license = repo.find("license.final", &language).unwrap();
        assert!(license.body.starts_with("Acuerdo de licencia"));

        let language: LanguageTag = "es-ES".try_into().unwrap();
        let license = repo.find("license.final", &language).unwrap();
        assert!(license.body.starts_with("Acuerdo de licencia"));

        let language: LanguageTag = "xx".try_into().unwrap();
        let license = repo.find("license.final", &language).unwrap();
        assert!(license.body.starts_with("End User License"));
    }
}
