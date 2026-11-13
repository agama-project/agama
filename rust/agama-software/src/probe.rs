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
    #[error("curl error: {0}")]
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

/// Parsed repository URL components.
#[derive(Debug, PartialEq, Eq)]
struct ParsedUrl<'a> {
    url_str: &'a str,
    scheme: &'a str,
    host: Option<&'a str>,
    port: Option<u16>,
}

impl<'a> ParsedUrl<'a> {
    /// Parses a repository URL into scheme, optional host, and optional port.
    ///
    /// Uses string splitting rather than `url` / `fluent_uri` crates (which fail on libzypp
    /// URLs with unencoded spaces or custom schemes) or libzypp FFI (to avoid unsafe overhead).
    fn parse(url_str: &'a str) -> Option<Self> {
        let (scheme, rest) = url_str.split_once(':')?;
        let (host, port) = if let Some(after_slashes) = rest.strip_prefix("//") {
            let authority = after_slashes.split('/').next().unwrap_or("");
            let host_port = authority.split('@').next_back().unwrap_or("");
            if host_port.is_empty() {
                (None, None)
            } else {
                match host_port.split_once(':') {
                    Some((h, p)) if !h.is_empty() => (Some(h), p.parse::<u16>().ok()),
                    _ if !host_port.is_empty() => (Some(host_port), None),
                    _ => (None, None),
                }
            }
        } else {
            (None, None)
        };

        Some(Self {
            url_str,
            scheme,
            host,
            port,
        })
    }
}

async fn try_probe_url(url_str: &str) -> Result<(), ProbeError> {
    let Some(parsed) = ParsedUrl::parse(url_str) else {
        return Ok(());
    };

    let scheme = parsed.scheme.to_ascii_lowercase();
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
        "nfs" | "nfs4" => probe_network_filesystem(&parsed, NFS_DEFAULT_PORT).await,
        "smb" | "cifs" => probe_network_filesystem(&parsed, SMB_DEFAULT_PORT).await,

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
async fn probe_network_filesystem(
    parsed: &ParsedUrl<'_>,
    default_port: u16,
) -> Result<(), ProbeError> {
    let host = parsed
        .host
        .ok_or_else(|| ProbeError::MissingHost(parsed.url_str.to_string()))?;
    let port = parsed.port.unwrap_or(default_port);
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

/// Concurrently probes a list of URLs with Tokio, filtering and returning only reachable ones.
/// Total wait time is bounded by PROBE_TIMEOUT_SECS (10s) regardless of URL count.
pub async fn filter_reachable_urls<S: AsRef<str> + Send, P: RepoProber + ?Sized>(
    urls: Vec<S>,
    prober: &P,
) -> Vec<S> {
    let futures: Vec<_> = urls
        .into_iter()
        .map(|url| async move {
            let reachable = prober.is_reachable(url.as_ref()).await;
            (url, reachable)
        })
        .collect();

    let results = futures_util::future::join_all(futures).await;
    results
        .into_iter()
        .filter_map(|(url, reachable)| {
            if reachable {
                Some(url)
            } else {
                tracing::info!(
                    "Repository URL '{}' is unreachable; skipping silently",
                    url.as_ref()
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
        let urls = vec![
            "http://example.com/repo1".to_string(),
            "http://example.com/repo2".to_string(),
            "http://example.com/repo3".to_string(),
        ];
        let prober = MockRepoProber::with_reachable(&[
            "http://example.com/repo1",
            "http://example.com/repo3",
        ]);

        let filtered = filter_reachable_urls(urls, &prober).await;
        assert_eq!(filtered.len(), 2);
        assert_eq!(filtered[0], "http://example.com/repo1");
        assert_eq!(filtered[1], "http://example.com/repo3");
    }

    #[test]
    fn test_parsed_url() {
        let p1 = ParsedUrl::parse("hd:/install").unwrap();
        assert_eq!(p1.scheme, "hd");
        assert_eq!(p1.host, None);
        assert_eq!(p1.port, None);

        let p2 = ParsedUrl::parse("nfs://127.0.0.1:2049/exports/repo").unwrap();
        assert_eq!(p2.scheme, "nfs");
        assert_eq!(p2.host, Some("127.0.0.1"));
        assert_eq!(p2.port, Some(2049));

        let p3 = ParsedUrl::parse("smb://DOMAIN;user:pass@fileserver/share").unwrap();
        assert_eq!(p3.scheme, "smb");
        assert_eq!(p3.host, Some("fileserver"));
        assert_eq!(p3.port, None);

        assert!(ParsedUrl::parse("invalid-url-without-colon").is_none());
    }
}
