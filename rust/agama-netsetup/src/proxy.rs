// Copyright (c) [2026] SUSE LLC
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

//! Reads and writes the `proxy=` boot parameter.
//!
//! The proxy is stored as a dracut command line snippet, the same way the previous
//! `initrd-network-setup.sh` script and the `98dracut-menu` module do, so the rest of the boot
//! process (e.g. the live self-update) picks it up.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

/// Default file where the proxy setting is written.
pub const DEFAULT_PROXY_FILE: &str = "/etc/cmdline.d/99-proxy-setup.conf";

/// Proxy settings storage.
pub struct ProxyStore {
    /// Files to read the boot parameters from, the later ones take precedence.
    sources: Vec<PathBuf>,
    /// File to write the setting to.
    target: PathBuf,
}

impl ProxyStore {
    pub fn new(sources: Vec<PathBuf>, target: PathBuf) -> Self {
        Self { sources, target }
    }

    /// Uses `/proc/cmdline` and the files in `/etc/cmdline.d` as sources.
    pub fn from_system(target: PathBuf) -> Self {
        let mut sources = vec![PathBuf::from("/proc/cmdline")];
        if let Ok(entries) = fs::read_dir("/etc/cmdline.d") {
            let mut files: Vec<PathBuf> = entries.flatten().map(|e| e.path()).collect();
            files.sort();
            sources.extend(files);
        }
        // the target file must be read even if it was not there when the list was built
        if !sources.contains(&target) {
            sources.push(target.clone());
        }
        Self::new(sources, target)
    }

    /// Returns the proxy URL, `None` if it is not configured.
    pub fn read(&self) -> Option<String> {
        let mut proxy = None;
        for source in &self.sources {
            if let Ok(content) = fs::read_to_string(source) {
                if let Some(value) = find_proxy(&content) {
                    proxy = Some(value);
                }
            }
        }
        proxy.filter(|p| !p.is_empty())
    }

    /// Stores the proxy URL, removes the setting when `None` or empty.
    ///
    /// If the proxy still comes from another source (e.g. the boot command line), an empty
    /// `proxy=` option is written to override it.
    pub fn write(&self, proxy: Option<&str>) -> io::Result<()> {
        if let Some(proxy) = proxy.map(str::trim).filter(|p| !p.is_empty()) {
            return self.write_target(proxy);
        }

        match fs::remove_file(&self.target) {
            Err(e) if e.kind() != io::ErrorKind::NotFound => return Err(e),
            _ => {}
        }

        if self.read().is_some() {
            self.write_target("")?;
        }
        Ok(())
    }

    fn write_target(&self, proxy: &str) -> io::Result<()> {
        if let Some(dir) = self.target.parent() {
            fs::create_dir_all(dir)?;
        }
        fs::write(&self.target, format!("proxy={proxy}\n"))
    }

    pub fn target(&self) -> &Path {
        &self.target
    }
}

/// Finds the last `proxy=` option in a boot command line.
fn find_proxy(cmdline: &str) -> Option<String> {
    cmdline
        .split_whitespace()
        .rev()
        .find_map(|opt| opt.strip_prefix("proxy="))
        .map(|p| p.trim_matches('"').to_string())
}

/// Hides the password of a proxy URL.
pub fn mask_password(url: &str) -> String {
    let Some((scheme, rest)) = url.split_once("://") else {
        return url.to_string();
    };
    match rest.rsplit_once('@') {
        Some((_, host)) => format!("{scheme}://*****@{host}"),
        None => url.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_proxy() {
        assert_eq!(find_proxy("root=live:CDLABEL=x quiet"), None);
        assert_eq!(
            find_proxy("proxy=http://a:1 rd.proxy=no proxy=\"http://b:2\""),
            Some("http://b:2".to_string())
        );
    }

    #[test]
    fn test_mask_password() {
        assert_eq!(
            mask_password("http://user:secret@proxy:3128"),
            "http://*****@proxy:3128"
        );
        assert_eq!(mask_password("http://proxy:3128"), "http://proxy:3128");
    }

    #[test]
    fn test_read_and_write() {
        let dir = tempfile::tempdir().unwrap();
        let cmdline = dir.path().join("cmdline");
        let target = dir.path().join("cmdline.d/99-proxy.conf");
        fs::write(&cmdline, "quiet proxy=http://boot:3128\n").unwrap();

        let store = ProxyStore::new(vec![cmdline, target.clone()], target.clone());
        assert_eq!(store.read(), Some("http://boot:3128".to_string()));

        store.write(Some("http://new:8080")).unwrap();
        assert_eq!(store.read(), Some("http://new:8080".to_string()));

        // the boot value is overridden, not restored
        store.write(None).unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "proxy=\n");
        assert_eq!(store.read(), None);
    }

    #[test]
    fn test_remove_without_other_sources() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("99-proxy.conf");
        let store = ProxyStore::new(vec![target.clone()], target.clone());

        store.write(Some("http://new:8080")).unwrap();
        store.write(Some(" ")).unwrap();
        assert!(!target.exists());
        // removing it again is not an error
        store.write(None).unwrap();
    }
}
