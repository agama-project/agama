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
    /// Read-only mode: allows inspecting system hardware, submitting trial configurations,
    /// and checking proposals, status, and logs. `commit_install` is forbidden.
    ReadOnly,
    /// Full mode: allows all operations including executing the installation via `commit_install`.
    Full,
}

impl McpMode {
    /// Determines the MCP mode from the kernel command-line arguments.
    ///
    /// Parses the `inst.mcp` argument:
    /// - `inst.mcp=full` (or `1`, `true`, `yes`) -> [`McpMode::Full`]
    /// - `inst.mcp=readonly` (or `read-only`) -> [`McpMode::ReadOnly`]
    /// - otherwise -> [`McpMode::Disabled`]
    pub fn from_kernel_cmdline(cmdline: &KernelCmdline) -> Self {
        match cmdline.get_last("inst.mcp").as_deref() {
            Some("full" | "1" | "true" | "yes") => Self::Full,
            Some("readonly" | "read-only") => Self::ReadOnly,
            _ => Self::Disabled,
        }
    }

    /// Determines the MCP mode by parsing the active system kernel command-line.
    pub fn from_cmdline() -> Self {
        KernelCmdline::parse()
            .map(|cmdline| Self::from_kernel_cmdline(&cmdline))
            .unwrap_or(Self::Disabled)
    }

    /// Returns `true` if the MCP server is enabled (`ReadOnly` or `Full`).
    pub fn is_enabled(&self) -> bool {
        !matches!(self, Self::Disabled)
    }

    /// Returns `true` if the MCP server is operating in read-only mode.
    pub fn is_readonly(&self) -> bool {
        matches!(self, Self::ReadOnly)
    }
}

impl FromStr for McpMode {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "full" | "1" | "true" | "yes" => Ok(Self::Full),
            "readonly" | "read-only" => Ok(Self::ReadOnly),
            "disabled" | "0" | "false" | "no" | "none" => Ok(Self::Disabled),
            other => Err(format!(
                "Unknown MCP mode: '{other}'. Expected 'full', 'readonly', or 'disabled'."
            )),
        }
    }
}

impl fmt::Display for McpMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Disabled => write!(f, "disabled"),
            Self::ReadOnly => write!(f, "readonly"),
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

        let readonly = KernelCmdline::parse_str("inst.mcp=readonly");
        assert_eq!(McpMode::from_kernel_cmdline(&readonly), McpMode::ReadOnly);

        let readonly_hyphen = KernelCmdline::parse_str("inst.mcp=read-only");
        assert_eq!(
            McpMode::from_kernel_cmdline(&readonly_hyphen),
            McpMode::ReadOnly
        );

        let disabled = KernelCmdline::parse_str("console=ttyS0");
        assert_eq!(McpMode::from_kernel_cmdline(&disabled), McpMode::Disabled);

        let empty = KernelCmdline::parse_str("");
        assert_eq!(McpMode::from_kernel_cmdline(&empty), McpMode::Disabled);
    }

    #[test]
    fn test_mcp_mode_from_str() {
        assert_eq!("full".parse::<McpMode>().unwrap(), McpMode::Full);
        assert_eq!("readonly".parse::<McpMode>().unwrap(), McpMode::ReadOnly);
        assert_eq!("disabled".parse::<McpMode>().unwrap(), McpMode::Disabled);
        assert!("invalid".parse::<McpMode>().is_err());
    }

    #[test]
    fn test_mcp_mode_helpers() {
        assert!(!McpMode::Disabled.is_enabled());
        assert!(!McpMode::Disabled.is_readonly());

        assert!(McpMode::ReadOnly.is_enabled());
        assert!(McpMode::ReadOnly.is_readonly());

        assert!(McpMode::Full.is_enabled());
        assert!(!McpMode::Full.is_readonly());
    }
}
