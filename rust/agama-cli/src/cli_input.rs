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

use agama_lib::utils::Transfer;
use anyhow::Context;
use std::{
    io,
    io::Read,
    path::{Path, PathBuf},
};
use url::Url;

/// Represents the ways user can specify the input on the command line
/// and passes appropriate representations to the web API
#[derive(Clone, Debug)]
pub enum CliInput {
    // TODO: Url(Url) would be nice here
    // but telling clap to deal with parse errors is harder than expected
    Url(String),
    Path(PathBuf),
    Stdin,
    /// The full text as String.
    // Not parsed from CLI but used when validating as part of `config generate`.
    Full(String),
}

impl From<String> for CliInput {
    fn from(url_or_path: String) -> Self {
        if url_or_path == "-" {
            Self::Stdin
        } else {
            // unwrap OK: known good regex will compile
            let url_like = regex::Regex::new("^[A-Za-z]+:").unwrap();
            if url_like.is_match(&url_or_path) {
                Self::Url(url_or_path)
            } else {
                Self::Path(url_or_path.into())
            }
        }
    }
}

impl CliInput {
    /// If *self* has a path or URL value, append a `path=...` or `url=...`
    /// query parameter to *url*, properly escaped. The path is made absolute
    /// so that it works (on localhost) even if server's working directory is different.
    /// See also: [`body_for_web`](Self::body_for_web).
    pub fn add_query(&self, base_url: &mut Url) -> io::Result<()> {
        if let Some(pair) = self.get_query() {
            base_url.query_pairs_mut().append_pair(&pair.0, &pair.1);
        }

        Ok(())
    }

    /// Prepares *self* for use as an url query. So in case of "url" or "path" it
    /// returns ("url", url_value) resp ("path", absolute_path) tuplle
    pub fn get_query(&self) -> Option<(String, String)> {
        match self {
            Self::Url(url) => Some((String::from("url"), url.clone())),
            Self::Path(path) => Some((
                String::from("path"),
                Self::absolute(path).unwrap().display().to_string(),
            )),
            Self::Stdin => None,
            Self::Full(_) => None,
        }
    }

    /// Make *path* absolute by prepending the current directory
    fn absolute(path: &Path) -> std::io::Result<PathBuf> {
        // we avoid Path.canonicalize because it would resolve away symlinks
        // that we need for testing
        if path.is_absolute() {
            Ok(path.to_path_buf())
        } else {
            let current_dir = std::env::current_dir()?;
            Ok(current_dir.join(path))
        }
    }

    /// If *self* is stdin or the full text, provide it as String.
    /// See also: `add_query`
    ///
    /// NOTE that this will consume the standard input
    /// if self is `Stdin`
    pub fn body_for_web(self) -> std::io::Result<String> {
        match self {
            Self::Stdin => Self::stdin_to_string(),
            Self::Full(s) => Ok(s),
            _ => Ok("".to_owned()),
        }
    }

    /// Consume standard input and return it as String.
    fn stdin_to_string() -> std::io::Result<String> {
        let mut slurp = String::new();
        let stdin = std::io::stdin();
        {
            let mut handle = stdin.lock();
            handle.read_to_string(&mut slurp)?;
        }
        Ok(slurp)
    }

    /// Read the specified input (stdin, path, or URL) and return a String
    // Does it belong here?
    // vs the downloading code in web ProfileQuery::retrieve_profile
    // put it in agama-lib?
    pub fn read_to_string(self, insecure: bool) -> anyhow::Result<String> {
        match self {
            Self::Full(s) => Ok(s),
            Self::Stdin => Self::stdin_to_string().map_err(|e| e.into()),
            Self::Path(pathbuf) => {
                let s = std::fs::read_to_string(&pathbuf)
                    .context(format!("Reading from file {:?}", pathbuf))?;
                Ok(s)
            }
            Self::Url(url_string) => {
                let mut bytebuf = Vec::new();
                Transfer::get(&url_string, &mut bytebuf, insecure)
                    .context(format!("Retrieving data from URL {}", url_string))?;
                let s = String::from_utf8(bytebuf)
                    .context(format!("Invalid UTF-8 data at URL {}", url_string))?;
                Ok(s)
            }
        }
    }
}
