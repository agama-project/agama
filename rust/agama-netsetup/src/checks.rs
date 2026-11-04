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

//! Connectivity checks, run one after the other so the user can see where it breaks.

use std::{net::IpAddr, process::Stdio, time::Duration};
use tokio::{net::lookup_host, process::Command, time::timeout};

/// A single connectivity check.
#[derive(Clone, Debug, PartialEq)]
pub enum Check {
    /// Ping the default gateway.
    Gateway(Option<IpAddr>),
    /// Resolve a host name.
    Dns(String),
    /// HTTP HEAD request to the URL, through the proxy if any.
    Http { url: String, proxy: Option<String> },
}

impl Check {
    /// Returns the list of checks for the given gateway, URL and proxy.
    pub fn plan(gateway: Option<IpAddr>, url: &str, proxy: Option<&str>) -> Vec<Check> {
        // With a proxy, the target host is resolved by the proxy, not locally.
        let dns_host = host_of(proxy.unwrap_or(url));
        vec![
            Check::Gateway(gateway),
            Check::Dns(dns_host.to_string()),
            Check::Http {
                url: url.to_string(),
                proxy: proxy.map(str::to_string),
            },
        ]
    }

    pub fn label(&self) -> String {
        match self {
            Check::Gateway(Some(gw)) => format!("Gateway {gw} reachable"),
            Check::Gateway(None) => "Gateway reachable".to_string(),
            Check::Dns(host) => format!("Name resolution of {host}"),
            Check::Http { url, proxy: None } => format!("Connection to {url}"),
            Check::Http {
                url,
                proxy: Some(_),
            } => format!("Connection to {url} via proxy"),
        }
    }

    /// Runs the check.
    pub async fn run(&self) -> Outcome {
        match self {
            Check::Gateway(None) => Outcome::Skipped("no default gateway configured".to_string()),
            Check::Gateway(Some(gw)) => ping(*gw).await,
            Check::Dns(host) => resolve(host).await,
            Check::Http { url, proxy } => http_head(url, proxy.as_deref()).await,
        }
    }
}

/// Result of a check.
#[derive(Clone, Debug, PartialEq)]
pub enum Outcome {
    Ok(String),
    Failed(String),
    Skipped(String),
}

impl Outcome {
    pub fn is_failed(&self) -> bool {
        matches!(self, Outcome::Failed(_))
    }
}

async fn ping(gateway: IpAddr) -> Outcome {
    let output = Command::new("ping")
        .args(["-c", "3", "-W", "2", "-q", &gateway.to_string()])
        .stdin(Stdio::null())
        .output()
        .await;
    match output {
        Ok(out) if out.status.success() => Outcome::Ok(String::new()),
        Ok(out) => Outcome::Failed(last_line(&out.stdout, &out.stderr)),
        Err(e) => Outcome::Skipped(format!("cannot run ping: {e}")),
    }
}

async fn resolve(host: &str) -> Outcome {
    if host.is_empty() {
        return Outcome::Skipped("no host name".to_string());
    }
    if host.parse::<IpAddr>().is_ok() {
        return Outcome::Skipped("the host is an IP address".to_string());
    }
    match timeout(Duration::from_secs(10), lookup_host((host, 0))).await {
        Ok(Ok(mut addrs)) => match addrs.next() {
            Some(addr) => Outcome::Ok(addr.ip().to_string()),
            None => Outcome::Failed("no address found".to_string()),
        },
        Ok(Err(e)) => Outcome::Failed(e.to_string()),
        Err(_) => Outcome::Failed("timed out".to_string()),
    }
}

async fn http_head(url: &str, proxy: Option<&str>) -> Outcome {
    let mut cmd = Command::new("curl");
    cmd.args([
        "--head",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "10",
        "--max-time",
        "20",
        "--output",
        "/dev/null",
        "--write-out",
        "%{http_code}",
    ]);
    // An explicit empty --proxy disables any proxy coming from the environment.
    cmd.args(["--proxy", proxy.unwrap_or("")]);
    cmd.arg(url).stdin(Stdio::null());

    match cmd.output().await {
        Ok(out) if out.status.success() => {
            let code = String::from_utf8_lossy(&out.stdout).trim().to_string();
            Outcome::Ok(format!("HTTP {code}"))
        }
        Ok(out) => Outcome::Failed(last_line(&[], &out.stderr)),
        Err(e) => Outcome::Skipped(format!("cannot run curl: {e}")),
    }
}

/// Returns the last non-empty line of stderr, or of stdout if stderr is empty.
fn last_line(stdout: &[u8], stderr: &[u8]) -> String {
    let pick = |bytes: &[u8]| {
        String::from_utf8_lossy(bytes)
            .lines()
            .rev()
            .find(|l| !l.trim().is_empty())
            .map(|l| l.trim().to_string())
    };
    pick(stderr).or_else(|| pick(stdout)).unwrap_or_default()
}

/// Extracts the host from a URL.
pub fn host_of(url: &str) -> &str {
    let rest = url.split_once("://").map_or(url, |(_, rest)| rest);
    let authority = rest.split(['/', '?', '#']).next().unwrap_or_default();
    let host_port = authority.rsplit_once('@').map_or(authority, |(_, h)| h);
    if let Some(v6) = host_port.strip_prefix('[') {
        return v6.split(']').next().unwrap_or_default();
    }
    host_port.split(':').next().unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_host_of() {
        assert_eq!(host_of("http://www.suse.com"), "www.suse.com");
        assert_eq!(
            host_of("https://u:p@proxy.example.com:3128/x"),
            "proxy.example.com"
        );
        assert_eq!(host_of("http://[2001:db8::1]:8080/"), "2001:db8::1");
        assert_eq!(host_of("proxy:3128"), "proxy");
    }

    #[test]
    fn test_plan_with_proxy_resolves_the_proxy() {
        let checks = Check::plan(None, "http://www.suse.com", Some("http://proxy:3128"));
        assert_eq!(checks[1], Check::Dns("proxy".to_string()));
    }

    #[tokio::test]
    async fn test_gateway_without_address_is_skipped() {
        assert!(matches!(
            Check::Gateway(None).run().await,
            Outcome::Skipped(_)
        ));
    }

    #[tokio::test]
    async fn test_resolve_ip_is_skipped() {
        assert!(matches!(
            Check::Dns("10.0.0.1".to_string()).run().await,
            Outcome::Skipped(_)
        ));
    }
}
