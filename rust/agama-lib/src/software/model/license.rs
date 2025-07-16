// Copyright (c) [2024-2025] SUSE LLC
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
use serde_with::{serde_as, DisplayFromStr};
use std::{
    fmt::Display,
    fs::read_dir,
    path::{Path, PathBuf},
};
use thiserror::Error;

/// Represents a product license.
///
/// It contains the license ID and the list of languages that with a translation.
#[serde_as]
#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
pub struct License {
    /// License ID.
    pub id: String,
    /// Languages in which the license is translated.
    #[serde_as(as = "Vec<DisplayFromStr>")]
    pub languages: Vec<LanguageTag>,
}

/// Represents a license content.
///
/// It contains the license ID and the body.
///
/// TODO: in the future it might contain a title, extracted from the text.
#[serde_as]
#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
pub struct LicenseContent {
    /// License ID.
    pub id: String,
    /// License text.
    pub body: String,
    /// License language.
    #[serde_as(as = "DisplayFromStr")]
    pub language: LanguageTag,
}

/// Represents a repository of software licenses.
///
/// The repository consists of a directory in the file system which contains the licenses in
/// different languages.
///
/// Each license is stored on a separate directory (e.g., "/usr/share/agama/eula/license.beta").
/// The license diectory contains the default text (license.txt) and a set of translations (e.g.,
/// "license.es.txt", "license.zh_CH.txt", etc.).
#[derive(Clone)]
pub struct LicensesRepo {
    /// Repository path.
    pub path: std::path::PathBuf,
    /// Licenses in the repository.
    pub licenses: Vec<License>,
}

impl LicensesRepo {
    pub fn new<P: AsRef<Path>>(path: P) -> Self {
        Self {
            path: path.as_ref().to_owned(),
            licenses: vec![],
        }
    }

    /// Reads the licenses from the repository.
    pub fn read(&mut self) -> Result<(), std::io::Error> {
        let entries = read_dir(self.path.as_path())?;

        for entry in entries {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                let Ok(id) = entry.file_name().into_string() else {
                    continue;
                };
                let license = License {
                    id,
                    languages: Self::find_translations(&entry.path())?,
                };
                self.licenses.push(license);
            }
        }
        Ok(())
    }

    /// Finds a license with the given ID and language.
    ///
    /// If a translation is not found for the given language, it returns the default text.
    pub fn find(&self, id: &str, language: &LanguageTag) -> Option<LicenseContent> {
        let license = self.licenses.iter().find(|l| l.id.as_str() == id).unwrap();

        let default_language = LanguageTag::default();
        let language = license
            .languages
            .iter()
            .find(|l| *l == language)
            .or_else(|| {
                license
                    .languages
                    .iter()
                    .find(|l| l.language == language.language)
            })
            .unwrap_or(&default_language);
        self.read_license_content(id, language).ok()
    }

    /// Finds translations in the given directory.
    ///
    /// * `path`: directory to search translations.
    fn find_translations(path: &PathBuf) -> Result<Vec<LanguageTag>, std::io::Error> {
        let entries = read_dir(path).unwrap().filter_map(|entry| entry.ok());

        let files = entries
            .filter(|entry| entry.file_type().is_ok_and(|f| f.is_file()))
            .filter_map(|entry| {
                let path = entry.path();
                let file = path.file_name()?;
                file.to_owned().into_string().ok()
            });

        Ok(files
            .filter_map(|f| Self::language_tag_from_file(&f))
            .collect())
    }

    /// Returns the language tag for the given file.
    ///
    /// The language is inferred from the file name (e.g., "es-ES" for license.es_ES.txt").
    fn language_tag_from_file(name: &str) -> Option<LanguageTag> {
        if !name.starts_with("license") {
            log::warn!("Unexpected file in the licenses directory: {}", &name);
            return None;
        }
        let mut parts = name.split(".");
        let mut code = parts.nth(1)?;

        if code == "txt" {
            code = "en"
        }

        code.try_into().ok()
    }

    fn read_license_content(
        &self,
        id: &str,
        language: &LanguageTag,
    ) -> std::io::Result<LicenseContent> {
        let file_name = if *language == LanguageTag::default() {
            "license.txt".to_string()
        } else if let Some(territory) = &language.territory {
            format!("license.{}_{}.txt", language.language, territory)
        } else {
            format!("license.{}.txt", language.language)
        };

        let license_path = self.path.join(id).join(file_name);
        let body = std::fs::read_to_string(license_path)?;
        Ok(LicenseContent {
            id: id.to_string(),
            body,
            language: language.clone(),
        })
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

/// Simplified representation of the RFC 5646 language code.
///
/// It only considers xx and xx-XX formats.
#[derive(Clone, Debug, Serialize, PartialEq, utoipa::ToSchema)]
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
        let language_regexp: Regex = Regex::new(r"^([[:alpha:]]+)(?:[_-]([A-Z]+))?").unwrap();

        let captures = language_regexp
            .captures(value)
            .ok_or_else(|| InvalidLanguageCode(value.to_string()))?;

        Ok(Self {
            language: captures.get(1).unwrap().as_str().to_string(),
            territory: captures.get(2).map(|e| e.as_str().to_string()),
        })
    }
}

#[cfg(test)]
mod test {
    use super::{LanguageTag, LicensesRepo};
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
        let es_language: LanguageTag = "es".try_into().unwrap();
        let license = repo.find("license.final", &es_language).unwrap();
        assert!(license.body.starts_with("Acuerdo de licencia"));
        assert_eq!(license.language, es_language);

        let language: LanguageTag = "es-ES".try_into().unwrap();
        let license = repo.find("license.final", &language).unwrap();
        assert!(license.body.starts_with("Acuerdo de licencia"));
        assert_eq!(license.language, es_language);

        let language: LanguageTag = "zh-CN".try_into().unwrap();
        let license = repo.find("license.final", &language).unwrap();
        assert!(license.body.starts_with("SUSE 软件"));
        assert_eq!(license.language, language);

        let language: LanguageTag = "xx".try_into().unwrap();
        let license = repo.find("license.final", &language).unwrap();
        assert!(license.body.starts_with("End User License"));
        assert_eq!(license.language, LanguageTag::default());
    }

    #[test]
    fn test_language_tag() {
        let tag: LanguageTag = "zh-CH".try_into().unwrap();
        assert_eq!(tag.language, "zh");
        assert_eq!(tag.territory, Some("CH".to_string()));
    }
}
