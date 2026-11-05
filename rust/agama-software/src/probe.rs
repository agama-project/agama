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

//! Probing of repository reachability according to protocol schemes.

use std::time::Duration;

use async_trait::async_trait;
use curl::easy::Easy;
use url::Url;

use crate::state::Repository;

pub const PROBE_TIMEOUT_SECS: u64 = 10;
const NFS_DEFAULT_PORT: u16 = 2049;
const SMB_DEFAULT_PORT: u16 = 445;

/// Trait to check whether a repository URL is reachable.
#[async_trait]
pub trait RepoProber: Send + Sync {
    async fn is_reachable(&self, url: &str) -> bool;
}

/// Default implementation that performs concurrent network and filesystem probes.
#[derive(Clone, Default, Debug)]
pub struct DefaultRepoProber;

#[async_trait]
impl RepoProber for DefaultRepoProber {
    async fn is_reachable(&self, url: &str) -> bool {
        probe_url(url).await
    }
}

/// Detailed error encountered while probing a repository URL.
#[derive(thiserror::Error, Debug)]
pub enum ProbeError {
    #[error("Could not determine the host in the URL: {0}")]
    MissingHost(String),
    #[error("Curl error: {0}")]
    Curl(#[from] curl::Error),
    #[error("Blocking task join error: {0}")]
    Task(#[from] tokio::task::JoinError),
    #[error("Connection error to {addr}: {source}")]
    Io {
        addr: String,
        #[source]
        source: std::io::Error,
    },
    #[error("Connection to {0} timed out")]
    Timeout(String),
}

/// Probes a single URL according to its protocol scheme.
/// Returns true if reachable; logs the exact failure error and returns false if unreachable.
pub async fn probe_url(url_str: &str) -> bool {
    match try_probe_url(url_str).await {
        Ok(()) => {
            tracing::info!("Repository probe success for '{url_str}'.");
            true
        }
        Err(err) => {
            tracing::info!("Repository probe failed for '{url_str}': {err}");
            false
        }
    }
}

async fn try_probe_url(url_str: &str) -> Result<(), ProbeError> {
    // Uses split_once instead of Url::parse because libzypp supports custom schemes (e.g. hd:/, cd:/, dir:/) that fail strict WHATWG URL parsing.
    let scheme = match url_str.split_once(':').map(|(s, _)| s.to_ascii_lowercase()) {
        Some(s) => s,
        None => return Ok(()),
    };

    if scheme.starts_with("plugin") {
        // Plugin schemes (e.g. plugin:susecloud) handle authentication and metadata themselves.
        return Ok(());
    }

    match scheme.as_str() {
        // Local media is expected to exist; if it does not, libzypp should raise an error rather than silently skipping it.
        "file" | "dir" | "cd" | "dvd" | "hd" | "iso" | "device" | "usb" | "label" => Ok(()),

        // Download protocols
        "http" | "https" | "ftp" | "ftps" | "tftp" | "sftp" => {
            let url_owned = url_str.to_string();
            tokio::task::spawn_blocking(move || probe_download_url(&url_owned)).await?
        }

        // Shared network filesystems
        "nfs" | "nfs4" | "smb" | "cifs" => probe_network_filesystem(url_str, &scheme).await,

        // Pass any other scheme directly
        _ => Ok(()),
    }
}

/// Probes download protocols (HTTP, HTTPS, FTP, etc.) using a curl HEAD request.
/// Any HTTP status response (including 200, 30x, 401, 403, 404, 500) confirms network reachability.
fn probe_download_url(url: &str) -> Result<(), ProbeError> {
    let mut easy = Easy::new();
    easy.url(url)?;

    // CURLOPT_NOBODY = 1 (causes HEAD request for HTTP/HTTPS)
    easy.nobody(true)?;
    easy.timeout(Duration::from_secs(PROBE_TIMEOUT_SECS))?;
    easy.connect_timeout(Duration::from_secs(PROBE_TIMEOUT_SECS))?;
    easy.follow_location(true)?;

    // Disable peer/host TLS verification during reachability probing to ensure private mirrors
    // or self-signed internal certificates are recognized as reachable over the network.
    easy.ssl_verify_peer(false)?;
    easy.ssl_verify_host(false)?;

    // In libcurl, fail_on_error is false by default.
    // easy.perform() returns Ok(()) for any HTTP status (200, 30x, 401, 403, 404, 500, etc.).
    easy.perform()?;
    Ok(())
}

/// Probes shared network filesystems (NFS, SMB, CIFS) using async non-blocking TCP connect.
async fn probe_network_filesystem(url_str: &str, scheme: &str) -> Result<(), ProbeError> {
    let default_port = match scheme {
        "nfs" | "nfs4" => NFS_DEFAULT_PORT,
        "smb" | "cifs" => SMB_DEFAULT_PORT,
        _ => return Ok(()),
    };

    let (host, port) = if let Ok(parsed) = Url::parse(url_str) {
        let host = match parsed.host_str() {
            Some(h) => h.to_string(),
            None => return Err(ProbeError::MissingHost(url_str.to_string())),
        };
        let port = parsed.port().unwrap_or(default_port);
        (host, port)
    } else {
        let after_scheme = match url_str.split_once("://") {
            Some((_, rest)) => rest,
            None => return Err(ProbeError::MissingHost(url_str.to_string())),
        };
        let authority = after_scheme.split('/').next().unwrap_or("");
        if authority.is_empty() {
            return Err(ProbeError::MissingHost(url_str.to_string()));
        }
        match authority.split_once(':') {
            Some((h, p)) => (h.to_string(), p.parse::<u16>().unwrap_or(default_port)),
            None => (authority.to_string(), default_port),
        }
    };

    let addr = format!("{host}:{port}");
    match tokio::time::timeout(
        Duration::from_secs(PROBE_TIMEOUT_SECS),
        tokio::net::TcpStream::connect(&addr),
    )
    .await
    {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(source)) => Err(ProbeError::Io { addr, source }),
        Err(_) => Err(ProbeError::Timeout(addr)),
    }
}

/// Probes candidate repositories concurrently via Tokio, filtering only reachable ones.
/// Total wait time is bounded by PROBE_TIMEOUT_SECS (10s) regardless of repository count.
pub async fn probe_reachable_repositories<P: RepoProber + ?Sized>(
    repos: Vec<Repository>,
    prober: &P,
) -> Vec<Repository> {
    let futures: Vec<_> = repos
        .into_iter()
        .map(|repo| async move {
            let reachable = prober.is_reachable(&repo.url).await;
            (repo, reachable)
        })
        .collect();

    let results = futures_util::future::join_all(futures).await;
    results
        .into_iter()
        .filter_map(|(repo, reachable)| {
            if reachable {
                Some(repo)
            } else {
                tracing::info!(
                    "Repository '{}' ({}) is unreachable; skipping silently",
                    repo.alias,
                    repo.url
                );
                None
            }
        })
        .collect()
}

#[cfg(test)]
#[derive(Clone, Debug)]
pub struct MockRepoProber {
    reachable_urls: Vec<String>,
    default_reachable: bool,
}

#[cfg(test)]
impl MockRepoProber {
    pub fn all_reachable() -> Self {
        Self {
            reachable_urls: vec![],
            default_reachable: true,
        }
    }

    pub fn all_unreachable() -> Self {
        Self {
            reachable_urls: vec![],
            default_reachable: false,
        }
    }

    pub fn with_reachable(urls: &[&str]) -> Self {
        Self {
            reachable_urls: urls.iter().map(|s| s.to_string()).collect(),
            default_reachable: false,
        }
    }
}

#[cfg(test)]
#[async_trait]
impl RepoProber for MockRepoProber {
    async fn is_reachable(&self, url: &str) -> bool {
        if self
            .reachable_urls
            .iter()
            .any(|u| u == url || url.contains(u))
        {
            true
        } else {
            self.default_reachable
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_local_path_schemes() {
        assert!(probe_url("dir:/some/path").await);
        assert!(probe_url("file:/some/path").await);
    }

    #[tokio::test]
    async fn test_volatile_media_schemes() {
        assert!(probe_url("cd:/").await);
        assert!(probe_url("dvd:/").await);
        assert!(probe_url("hd:/install").await);
        assert!(probe_url("iso:/install.iso").await);
        assert!(probe_url("device:/dev/sr0").await);
        assert!(probe_url("usb:/install").await);
        assert!(probe_url("label://OEMDRV/repo").await);
    }

    #[tokio::test]
    async fn test_plugin_schemes() {
        assert!(probe_url("plugin:susecloud?credentials=...").await);
    }

    #[tokio::test]
    async fn test_network_filesystem_schemes() {
        // Start a mock TCP listener on a loopback port
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        assert!(probe_url(&format!("nfs://127.0.0.1:{port}/exports/repo")).await);
        assert!(probe_url(&format!("smb://127.0.0.1:{port}/share/repo")).await);

        // A port that nothing listens to should fail
        assert!(!probe_url("nfs://127.0.0.1:1/exports/repo").await);
    }

    #[tokio::test]
    async fn test_concurrent_probing_filters_unreachable() {
        let repo1 = Repository {
            alias: "agama-0".to_string(),
            name: "agama-0".to_string(),
            url: "http://example.com/repo1".to_string(),
            enabled: true,
            priority: None,
        };
        let repo2 = Repository {
            alias: "agama-1".to_string(),
            name: "agama-1".to_string(),
            url: "http://example.com/repo2".to_string(),
            enabled: true,
            priority: None,
        };
        let repo3 = Repository {
            alias: "agama-2".to_string(),
            name: "agama-2".to_string(),
            url: "http://example.com/repo3".to_string(),
            enabled: true,
            priority: None,
        };

        let repos = vec![repo1, repo2, repo3];
        let prober = MockRepoProber::with_reachable(&[
            "http://example.com/repo1",
            "http://example.com/repo3",
        ]);

        let filtered = probe_reachable_repositories(repos, &prober).await;
        assert_eq!(filtered.len(), 2);
        assert_eq!(filtered[0].alias, "agama-0");
        assert_eq!(filtered[1].alias, "agama-2");
    }
}
