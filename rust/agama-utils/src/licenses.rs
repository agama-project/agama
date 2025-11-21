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

use crate::api::manager::{InvalidLanguageCode, LanguageTag, License, LicenseContent};
use agama_locale_data::get_territories;
use fs_err::read_dir;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Not a valid language code: {0}")]
    InvalidLanguageCode(#[from] InvalidLanguageCode),
    #[error("I/O error: {0}")]
    IO(#[from] std::io::Error),
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
pub struct Registry {
    /// Repository path.
    path: std::path::PathBuf,
    /// Licenses in the repository.
    licenses: Vec<License>,
    /// Fallback languages per territory.
    fallback: HashMap<String, LanguageTag>,
}

impl Registry {
    pub fn new<P: AsRef<Path>>(path: P) -> Self {
        Self {
            path: path.as_ref().to_owned(),
            licenses: vec![],
            fallback: HashMap::new(),
        }
    }

    /// Reads the licenses from the repository.
    pub fn read(&mut self) -> Result<(), Error> {
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

        self.fallback.clear();

        let territories = get_territories().map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Cannot read the territories list: {}", e),
            )
        })?;

        for territory in territories.territory {
            if let Some(language) = territory.languages.language.first() {
                let fallback = LanguageTag {
                    language: language.id.to_string(),
                    territory: None,
                };
                self.fallback.insert(territory.id, fallback);
            }
        }

        Ok(())
    }

    /// Finds a license with the given ID and language.
    ///
    /// If a translation is not found for the given language, it returns the default text.
    pub fn find(&self, id: &str, language: &LanguageTag) -> Option<LicenseContent> {
        let license = self.licenses.iter().find(|l| l.id.as_str() == id)?;
        let license_language = self.find_language(&license, &language).unwrap_or_default();
        self.read_license_content(id, &license_language).ok()
    }

    /// Finds translations in the given directory.
    ///
    /// * `path`: directory to search translations.
    fn find_translations(path: &PathBuf) -> Result<Vec<LanguageTag>, std::io::Error> {
        let entries = read_dir(path)?.filter_map(|entry| entry.ok());

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
            tracing::warn!("Unexpected file in the licenses directory: {}", &name);
            return None;
        }
        let mut parts = name.split(".");
        let mut code = parts.nth(1)?;

        if code == "txt" {
            code = "en"
        }

        code.try_into().ok()
    }

    /// Read a license content for a given language.
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

    /// It search for an available language for the translation.
    ///
    /// If translated to the given language, it returns that language. If that's
    /// not the case, it searches for a "compatible" language (the main language
    /// on the same territory, if given).
    fn find_language(&self, license: &License, candidate: &LanguageTag) -> Option<LanguageTag> {
        let mut candidates: Vec<LanguageTag> = vec![candidate.clone()];
        candidates.push(LanguageTag {
            language: candidate.language.clone(),
            territory: None,
        });

        if let Some(territory) = &candidate.territory {
            if let Some(fallback) = self.fallback.get(territory) {
                candidates.push(fallback.clone());
            }
        }

        candidates
            .into_iter()
            .find(|c| license.languages.contains(&c))
    }

    /// Returns a vector with the licenses from the repository.
    pub fn licenses(&self) -> Vec<&License> {
        self.licenses.iter().collect()
    }
}

impl Default for Registry {
    fn default() -> Self {
        let relative_path = PathBuf::from("share/eula");
        let path = if relative_path.exists() {
            relative_path
        } else {
            let share_dir =
                std::env::var("AGAMA_SHARE_DIR").unwrap_or("/usr/share/agama".to_string());
            PathBuf::from(share_dir).join("eula")
        };
        Self::new(path)
    }
}

#[cfg(test)]
mod test {
    use super::{LanguageTag, Registry};
    use std::path::Path;

    fn build_registry() -> Registry {
        let mut repo = Registry::new(Path::new("../share/eula"));
        repo.read().unwrap();
        repo
    }

    #[test]
    fn test_read_licenses_repository() {
        let repo = build_registry();
        let license = repo.licenses.first().unwrap();
        assert_eq!(&license.id, "license.final");
    }

    #[test]
    fn test_find_license() {
        let repo = build_registry();
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
    fn test_find_alternate_license() {
        let repo = build_registry();

        // Tries to use the main language for the territory.
        let ca_language: LanguageTag = "ca-ES".try_into().unwrap();
        let es_language: LanguageTag = "es".try_into().unwrap();
        let license = repo.find("license.final", &ca_language).unwrap();
        assert_eq!(license.language, es_language);
    }

    #[test]
    fn test_language_tag() {
        let tag: LanguageTag = "zh-CH".try_into().unwrap();
        assert_eq!(tag.language, "zh");
        assert_eq!(tag.territory, Some("CH".to_string()));
    }
}
