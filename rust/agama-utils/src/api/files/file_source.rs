// Copyright (c) [2025] SUSE LLC
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

use agama_transfer::{Error as TransferError, Transfer};
use fluent_uri::{resolve::ResolveError, Uri, UriRef};
use serde::{Deserialize, Serialize};
use std::{fs::OpenOptions, io::Write, os::unix::fs::OpenOptionsExt, path::Path};

#[derive(Debug, thiserror::Error)]
pub enum FileSourceError {
    #[error("Could not resolve the URL: {0}")]
    ResolveUrlError(String, #[source] ResolveError),
    #[error("Transfer error: {0}")]
    TransferFailed(#[from] TransferError),
    #[error("I/O error: {0}")]
    IO(#[from] std::io::Error),
}

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema, PartialEq)]
#[serde(untagged)]
/// Text or URL Reference of a config file or a script
pub enum FileSource {
    /// File content.
    Text { content: String },
    /// URI or relative reference to get the script from.
    Remote {
        #[schema(value_type = String, examples("http://example.com/script.sh", "/file.txt"))]
        url: UriRef<String>,
    },
}

impl FileSource {
    /// Returns a new source using an absolute URL if it was using a relative one.
    ///
    /// If it was not using a relative URL, it just returns a clone.
    ///
    /// * `base`: base URL.
    pub fn resolve_url(&self, base: &Uri<String>) -> Result<FileSource, FileSourceError> {
        let resolved = match self {
            Self::Text { content } => Self::Text {
                content: content.clone(),
            },
            Self::Remote { url } => {
                let resolved_url = if url.has_scheme() {
                    url.clone()
                } else {
                    let resolved = url
                        .resolve_against(base)
                        .map_err(|e| FileSourceError::ResolveUrlError(url.to_string(), e))?;
                    UriRef::from(resolved)
                };
                Self::Remote { url: resolved_url }
            }
        };
        Ok(resolved)
    }

    /// Writes the file to the given writer.
    ///
    /// * `file`: where to write the data.
    pub fn write<P: AsRef<Path>>(&self, path: P, mode: u32) -> Result<(), FileSourceError> {
        let mut file = OpenOptions::new()
            .mode(mode)
            .write(true)
            .create(true)
            .open(path)?;

        match &self {
            FileSource::Text { content } => file.write_all(content.as_bytes())?,
            // Transfer::get will fail if the URL is relative.
            FileSource::Remote { url } => Transfer::get(&url.to_string(), &mut file, false)?,
        }

        file.flush()?;
        Ok(())
    }
}

/// Implements an API to work with a file source.
pub trait WithFileSource: Clone {
    /// File source.
    fn file_source(&self) -> &FileSource;

    /// Mutable file source.
    fn file_source_mut(&mut self) -> &mut FileSource;

    /// Returns a clone using an absolute URL for the file source.
    ///
    /// * `base`: base URL.
    fn resolve_url(&mut self, base: &Uri<String>) -> Result<(), FileSourceError> {
        let source = self.file_source_mut();
        *source = source.resolve_url(base)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::{fs::File, io::Write};

    use fluent_uri::{Uri, UriRef};

    use super::FileSource;

    #[test]
    fn test_write_content() {
        let file = FileSource::Text {
            content: "foobar".to_string(),
        };

        let tmpdir = tempfile::TempDir::with_prefix("agama-tests-").unwrap();
        let target = tmpdir.path().join("foobar.txt");
        file.write(&target, 0o400).unwrap();

        let written = std::fs::read_to_string(&target).unwrap();
        assert_eq!(written.as_str(), "foobar");
    }

    #[test]
    fn test_write_from_url() {
        let tmpdir = tempfile::TempDir::with_prefix("agama-tests-").unwrap();
        let source = tmpdir.path().join("source.txt");
        let mut file = File::create(&source).unwrap();
        file.write_all(b"foobar").unwrap();

        let url = format!("file://{}", source.display());
        let file = FileSource::Remote {
            url: UriRef::parse(url).unwrap(),
        };
        let target = tmpdir.path().join("foobar.txt");
        file.write(&target, 0o400).unwrap();

        let written = std::fs::read_to_string(&target).unwrap();
        assert_eq!(written.as_str(), "foobar");
    }

    #[test]
    fn test_resolve_url_relative() {
        let file = FileSource::Remote {
            url: UriRef::parse("file.txt").unwrap().to_owned(),
        };

        let base_url = Uri::parse("http://example.lan/sles").unwrap().to_owned();
        let resolved = file.resolve_url(&base_url).unwrap();
        let expected_url = "http://example.lan/file.txt";

        assert!(matches!(
            resolved,
            FileSource::Remote { url } if url.as_str() == expected_url
        ));
    }

    #[test]
    fn test_resolve_url_absolute() {
        let file = FileSource::Remote {
            url: UriRef::parse("http://example.lan/agama/file.txt")
                .unwrap()
                .to_owned(),
        };

        let base_url = Uri::parse("http://example.lan/sles").unwrap().to_owned();
        let resolved = file.resolve_url(&base_url).unwrap();
        let expected_url = "http://example.lan/agama/file.txt";

        assert!(matches!(
            resolved,
            FileSource::Remote { url } if url.as_str() == expected_url
        ));
    }
}
