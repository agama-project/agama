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

use merge::Merge;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Proxy config.
#[derive(Clone, Debug, Default, Merge, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "proxy.Config", title = "Proxy settings")]
pub struct Config {
    /// Whether proxy is enabled.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub enabled: Option<bool>,
    /// URL to be used for the HTTP proxy.
    #[schemars(example = &"http://proxy.provider.de:3128/")]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub http: Option<String>,
    /// URL to be used for the HTTPS proxy.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub https: Option<String>,
    /// URL to be used for the FTP proxy.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub ftp: Option<String>,
    /// URL to be used for the Gopher proxy.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub gopher: Option<String>,
    /// URL to be used for the SOCKS proxy.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub socks: Option<String>,
    /// SOCKS5 server address.
    #[schemars(example = &"office-proxy.example.com:8881")]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub socks5: Option<String>,
    /// Comma-separated list of domains/hosts to bypass proxy for.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub no_proxy: Option<String>,
}
