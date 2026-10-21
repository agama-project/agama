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

//! Defines the operating mode for the Model Context Protocol (MCP) server.

use agama_utils::kernel_cmdline::KernelCmdline;
use std::fmt;
use std::str::FromStr;

/// Operating mode for the Agama Model Context Protocol (MCP) server.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum McpMode {
    /// MCP server is disabled (default). Standard ISO installations remain secure.
    #[default]
    Disabled,
    /// Configuration-only mode: allows inspecting system hardware, retrieving schemas,
    /// injecting configurations, answering prompts, and checking proposals.
    /// `commit_install` is forbidden.
    Config,
    /// Full mode: allows all operations including executing the installation via `commit_install`.
    Full,
}

impl McpMode {
    /// Determines the MCP mode from the kernel command-line arguments.
    ///
    /// Parses the `inst.mcp` argument:
    /// - `inst.mcp=full` -> [`McpMode::Full`]
    /// - `inst.mcp=config` -> [`McpMode::Config`]
    /// - `inst.mcp=disabled` (or omitted) -> [`McpMode::Disabled`]
    pub fn from_kernel_cmdline(cmdline: &KernelCmdline) -> Self {
        match cmdline.get_last("inst.mcp").as_deref() {
            Some("full") => Self::Full,
            Some("config") => Self::Config,
            _ => Self::Disabled,
        }
    }

    /// Determines the MCP mode by parsing the active system kernel command-line.
    pub fn from_cmdline() -> Self {
        KernelCmdline::parse()
            .map(|cmdline| Self::from_kernel_cmdline(&cmdline))
            .unwrap_or(Self::Disabled)
    }

    /// Returns `true` if the MCP server is enabled (`Config` or `Full`).
    pub fn is_enabled(&self) -> bool {
        !matches!(self, Self::Disabled)
    }

    /// Returns `true` if the MCP server is operating in configuration-only mode.
    pub fn is_config(&self) -> bool {
        matches!(self, Self::Config)
    }

    /// Returns `true` if the mode allows triggering destructive installation.
    pub fn allows_install(&self) -> bool {
        matches!(self, Self::Full)
    }

    /// Extracts an optional pre-shared MCP token configured on the kernel command-line.
    ///
    /// Parses `inst.mcp.token`.
    pub fn token_from_kernel_cmdline(cmdline: &KernelCmdline) -> Option<String> {
        cmdline.get_last("inst.mcp.token")
    }

    /// Extracts an optional pre-shared MCP token from the active system kernel command-line.
    pub fn token_from_cmdline() -> Option<String> {
        KernelCmdline::parse()
            .ok()
            .and_then(|cmdline| Self::token_from_kernel_cmdline(&cmdline))
    }
}

/// Error returned when parsing an invalid MCP operating mode string.
#[derive(thiserror::Error, Debug, PartialEq, Eq)]
#[error("Unknown MCP mode: '{0}'. Expected 'full', 'config', or 'disabled'.")]
pub struct ModeParseError(pub String);

impl FromStr for McpMode {
    type Err = ModeParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "full" => Ok(Self::Full),
            "config" => Ok(Self::Config),
            "disabled" => Ok(Self::Disabled),
            other => Err(ModeParseError(other.to_string())),
        }
    }
}

impl fmt::Display for McpMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Disabled => write!(f, "disabled"),
            Self::Config => write!(f, "config"),
            Self::Full => write!(f, "full"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_mode_from_kernel_cmdline() {
        let full = KernelCmdline::parse_str("inst.mcp=full some_other_arg=1");
        assert_eq!(McpMode::from_kernel_cmdline(&full), McpMode::Full);

        let config = KernelCmdline::parse_str("inst.mcp=config");
        assert_eq!(McpMode::from_kernel_cmdline(&config), McpMode::Config);

        let disabled = KernelCmdline::parse_str("inst.mcp=disabled");
        assert_eq!(McpMode::from_kernel_cmdline(&disabled), McpMode::Disabled);

        let other = KernelCmdline::parse_str("console=ttyS0");
        assert_eq!(McpMode::from_kernel_cmdline(&other), McpMode::Disabled);

        let empty = KernelCmdline::parse_str("");
        assert_eq!(McpMode::from_kernel_cmdline(&empty), McpMode::Disabled);

        let token = KernelCmdline::parse_str("inst.mcp=config inst.mcp.token=secret123");
        assert_eq!(
            McpMode::token_from_kernel_cmdline(&token),
            Some("secret123".to_string())
        );
    }

    #[test]
    fn test_mcp_mode_from_str() {
        assert_eq!("full".parse::<McpMode>().unwrap(), McpMode::Full);
        assert_eq!("config".parse::<McpMode>().unwrap(), McpMode::Config);
        assert_eq!("disabled".parse::<McpMode>().unwrap(), McpMode::Disabled);
        assert!("invalid".parse::<McpMode>().is_err());
        assert!("readonly".parse::<McpMode>().is_err());
    }

    #[test]
    fn test_mcp_mode_helpers() {
        assert!(!McpMode::Disabled.is_enabled());
        assert!(!McpMode::Disabled.is_config());
        assert!(!McpMode::Disabled.allows_install());

        assert!(McpMode::Config.is_enabled());
        assert!(McpMode::Config.is_config());
        assert!(!McpMode::Config.allows_install());

        assert!(McpMode::Full.is_enabled());
        assert!(!McpMode::Full.is_config());
        assert!(McpMode::Full.allows_install());
    }
}
