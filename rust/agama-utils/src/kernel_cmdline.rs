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

use std::{collections::HashMap, path::Path};

const CMDLINE_FILE: &str = "/run/agama/cmdline.d/agama.conf";

/// Implements a mechanism to read the kernel's command-line arguments.
///
/// It supports multiple values for a single key.
#[derive(Default)]
pub struct KernelCmdline(HashMap<String, Vec<String>>);

impl KernelCmdline {
    /// Parses the command-line.
    ///
    /// The content of the command-line is stored, by default, in the {CMDLINE_FILE}.
    pub fn parse() -> std::io::Result<Self> {
        Self::parse_file(CMDLINE_FILE)
            .inspect_err(|e| tracing::warn!("Could not parse the kernel command-line: {e}"))
    }

    /// Builds an instance from the given file.
    ///
    /// * `content`: file containing the kernel's cmdline arguments.
    pub fn parse_file<P: std::fmt::Display + AsRef<Path>>(file: P) -> std::io::Result<Self> {
        let content = std::fs::read_to_string(&file)
            .inspect_err(|e| tracing::warn!("Could not read cmdline args file {e}",))?;
        Ok(Self::parse_str(&content))
    }

    /// Builds an instance from the given string.
    ///
    /// * `content`: string containing the kernel's cmdline arguments.
    pub fn parse_str(content: &str) -> Self {
        let mut args: HashMap<String, Vec<String>> = HashMap::default();
        for param in content.split_whitespace() {
            let (key, value) = param
                .split_once("=")
                .map(|(k, v)| (k, v))
                .unwrap_or_else(|| (param, "1"));

            args.entry(key.to_string())
                .and_modify(|v| v.push(value.to_string()))
                .or_insert(vec![value.to_string()]);
        }
        Self(args)
    }

    /// Returns the values for the argument.
    ///
    /// * `name`: argument name.
    pub fn get(&self, name: &str) -> Vec<String> {
        self.0.get(name).cloned().unwrap_or(vec![])
    }

    /// Returns the last value for the argument
    pub fn get_last(&self, name: &str) -> Option<String> {
        let values = self.0.get(name)?;
        values.last().cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::KernelCmdline;

    #[test]
    fn test_cmdline_args() {
        let args_str = r"rd.neednet inst.auto=file:///profile.json";
        let args = KernelCmdline::parse_str(args_str);

        assert_eq!(
            args.get("inst.auto"),
            vec!["file:///profile.json".to_string()]
        );
        assert_eq!(args.get("rd.neednet"), vec!["1".to_string()]);
        assert!(args.get("unknown").is_empty());
    }

    #[test]
    fn test_cmdline_args_last() {
        let args_str = r"inst.auto_insecure=1 inst.auto_insecure=0";
        let args = KernelCmdline::parse_str(args_str);

        assert_eq!(args.get_last("inst.auto_insecure"), Some("0".to_string()));
    }
}
