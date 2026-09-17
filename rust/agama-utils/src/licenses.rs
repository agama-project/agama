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
///
/// The registry only keeps the content of the licenses for a single language in memory (the
/// language given to the constructor or to the last call to [Registry::read]).
#[derive(Clone)]
pub struct Registry {
    /// Repository path.
    path: std::path::PathBuf,
    /// Licenses metadata.
    licenses: Vec<License>,
    /// Licenses content for the current language.
    content: Vec<LicenseContent>,
    /// Fallback languages per territory.
    fallback: HashMap<String, LanguageTag>,
}

impl Registry {
    /// Builds a registry, reading the licenses from the given path for the given language.
    pub fn new<P: AsRef<Path>>(path: P, language: LanguageTag) -> Result<Self, Error> {
        let mut registry = Self {
            path: path.as_ref().to_owned(),
            licenses: vec![],
            content: vec![],
            fallback: HashMap::new(),
        };
        registry.read(&language)?;
        Ok(registry)
    }

    /// Builds a registry, reading the licenses from the default path for the given language.
    pub fn from_default_path(language: LanguageTag) -> Result<Self, Error> {
        Self::new(Self::default_path(), language)
    }

    /// Default location: a local test override, or `$AGAMA_SHARE_DIR/eula`.
    pub fn default_path() -> PathBuf {
        let relative_path = PathBuf::from("test/share/eula");
        if relative_path.exists() {
            relative_path
        } else {
            let share_dir =
                std::env::var("AGAMA_SHARE_DIR").unwrap_or("/usr/share/agama".to_string());
            PathBuf::from(share_dir).join("eula")
        }
    }

    /// Reads the licenses content from the repository for the given language.
    ///
    /// It should be called again whenever the language changes (e.g., as a reaction to a
    /// ConfigureL10n action).
    pub fn read(&mut self, language: &LanguageTag) -> Result<(), Error> {
        let mut licenses = vec![];
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
                licenses.push(license);
            }
        }

        self.fallback = Self::read_fallback_languages()?;

        let mut content = vec![];
        for license in &licenses {
            if let Some(license_content) = self.read_best_content(&license.id, language) {
                content.push(license_content);
            }
        }

        self.licenses = licenses;
        self.content = content;

        Ok(())
    }

    /// Builds the fallback languages map (main language per territory).
    fn read_fallback_languages() -> Result<HashMap<String, LanguageTag>, Error> {
        let mut fallback = HashMap::new();

        let territories = get_territories().map_err(|e| {
            std::io::Error::other(format!("Cannot read the territories list: {}", e))
        })?;

        for territory in territories.territory {
            if let Some(language) = territory.languages.language.first() {
                let fallback_language = LanguageTag {
                    language: language.id.to_string(),
                    territory: None,
                };
                fallback.insert(territory.id, fallback_language);
            }
        }

        Ok(fallback)
    }

    /// Finds a license with the given ID in the current language.
    pub fn find(&self, id: &str) -> Option<LicenseContent> {
        self.content.iter().find(|l| l.id.as_str() == id).cloned()
    }

    /// Reads the content of a license, trying the given language and falling back to more
    /// generic languages (and finally English) if a translation is not found.
    fn read_best_content(&self, id: &str, language: &LanguageTag) -> Option<LicenseContent> {
        for candidate in self.language_candidates(language) {
            if let Ok(content) = self.read_license_content(id, &candidate) {
                return Some(content);
            }
        }
        None
    }

    /// Builds an ordered list of language candidates to try when reading a license.
    ///
    /// It tries, in order: the given language and territory, the language alone, the main
    /// language of the territory (if any) and, finally, English.
    fn language_candidates(&self, language: &LanguageTag) -> Vec<LanguageTag> {
        let mut candidates: Vec<LanguageTag> = vec![language.clone()];

        if language.territory.is_some() {
            candidates.push(LanguageTag {
                language: language.language.clone(),
                territory: None,
            });
        }

        if let Some(territory) = &language.territory {
            if let Some(fallback) = self.fallback.get(territory) {
                candidates.push(fallback.clone());
            }
        }

        if *language != LanguageTag::default() {
            candidates.push(LanguageTag::default());
        }

        candidates
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

    /// Returns a vector with the licenses from the repository.
    pub fn licenses(&self) -> Vec<&License> {
        self.licenses.iter().collect()
    }
}

#[cfg(test)]
mod test {
    use super::{LanguageTag, Registry};
    use std::path::Path;

    fn build_registry(language: LanguageTag) -> Registry {
        Registry::new(Path::new("../test/share/eula"), language).unwrap()
    }

    #[test]
    fn test_read_licenses_repository() {
        let repo = build_registry(LanguageTag::default());
        let license = repo.licenses.first().unwrap();
        assert_eq!(&license.id, "license.final");
    }

    #[test]
    fn test_find_license() {
        let es_language: LanguageTag = "es".try_into().unwrap();
        let repo = build_registry(es_language.clone());
        let license = repo.find("license.final").unwrap();
        assert!(license.body.starts_with("Acuerdo de licencia"));
        assert_eq!(license.language, es_language);

        let language: LanguageTag = "es-ES".try_into().unwrap();
        let repo = build_registry(language);
        let license = repo.find("license.final").unwrap();
        assert!(license.body.starts_with("Acuerdo de licencia"));
        assert_eq!(license.language, es_language);

        let language: LanguageTag = "zh-CN".try_into().unwrap();
        let repo = build_registry(language.clone());
        let license = repo.find("license.final").unwrap();
        assert!(license.body.starts_with("SUSE 软件"));
        assert_eq!(license.language, language);

        let language: LanguageTag = "xx".try_into().unwrap();
        let repo = build_registry(language);
        let license = repo.find("license.final").unwrap();
        assert!(license.body.starts_with("End User License"));
        assert_eq!(license.language, LanguageTag::default());
    }

    #[test]
    fn test_find_alternate_license() {
        // Tries to use the main language for the territory.
        let ca_language: LanguageTag = "ca-ES".try_into().unwrap();
        let es_language: LanguageTag = "es".try_into().unwrap();
        let repo = build_registry(ca_language);
        let license = repo.find("license.final").unwrap();
        assert_eq!(license.language, es_language);
    }

    #[test]
    fn test_read_updates_content_for_new_language() {
        let mut repo = build_registry(LanguageTag::default());
        let license = repo.find("license.final").unwrap();
        assert!(license.body.starts_with("End User License"));

        let es_language: LanguageTag = "es".try_into().unwrap();
        repo.read(&es_language).unwrap();
        let license = repo.find("license.final").unwrap();
        assert!(license.body.starts_with("Acuerdo de licencia"));
    }

    #[test]
    fn test_language_tag() {
        let tag: LanguageTag = "zh-CH".try_into().unwrap();
        assert_eq!(tag.language, "zh");
        assert_eq!(tag.territory, Some("CH".to_string()));
    }
}
