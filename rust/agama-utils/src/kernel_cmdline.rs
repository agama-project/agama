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

const AGAMA_CMDLINE_FILE: &str = "/run/agama/cmdline.d/agama.conf";
const KERNEL_CMDLINE_FILE: &str = "/run/agama/cmdline.d/kernel.conf";

/// Implements a mechanism to read the kernel's command-line arguments.
///
/// It supports multiple values for a single key. Keys are case-insensitive.
#[derive(Default)]
pub struct KernelCmdline(HashMap<String, Vec<String>>);

impl KernelCmdline {
    /// Parses the command-line.
    ///
    /// The content of the command-line is stored, by default it is combination of agama and kernel cmdline args.
    pub fn parse() -> std::io::Result<Self> {
        let agama = Self::parse_file(AGAMA_CMDLINE_FILE).inspect_err(|e| {
            tracing::warn!("Could not parse the agama kernel command-line: {e}")
        })?;
        let kernel = Self::parse_file(KERNEL_CMDLINE_FILE).inspect_err(|e| {
            tracing::warn!("Could not parse the filtered kernel command-line: {e}")
        })?;

        Ok(agama.merge(kernel))
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

            args.entry(key.to_lowercase())
                .and_modify(|v| v.push(value.to_string()))
                .or_insert(vec![value.to_string()]);
        }
        Self(args)
    }

    pub fn merge(self, other: Self) -> Self {
        let mut args = self.0;
        for (key, value) in other.0 {
            args.entry(key)
                // this modify is just for theoreticall correctness as in reality we are merging kernel and agama
                // args and they are exclusive
                .and_modify(|v| v.extend(value.clone()))
                .or_insert(value);
        }
        Self(args)
    }

    /// Returns the values for the argument.
    ///
    /// * `name`: argument name.
    pub fn get(&self, name: &str) -> Vec<String> {
        self.0.get(&name.to_lowercase()).cloned().unwrap_or(vec![])
    }

    /// Returns the last value for the argument
    pub fn get_last(&self, name: &str) -> Option<String> {
        let values = self.0.get(&name.to_lowercase())?;
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

    #[test]
    fn test_cmdline_args_case_insensitive() {
        let args_str = r"Inst.Auto=file:///profile.json RD.NEEDNET";
        let args = KernelCmdline::parse_str(args_str);

        assert_eq!(
            args.get_last("inst.auto"),
            Some("file:///profile.json".to_string())
        );
        assert_eq!(
            args.get_last("INST.AUTO"),
            Some("file:///profile.json".to_string())
        );
        assert_eq!(args.get("rd.neednet"), vec!["1".to_string()]);
    }

    #[test]
    fn test_merge() {
        let cmdline1 = KernelCmdline::parse_str("key1=val1 key2=val2");
        let cmdline2 = KernelCmdline::parse_str("key2=val3 key3=val4");

        let merged = cmdline1.merge(cmdline2);

        assert_eq!(merged.get("key1"), vec!["val1".to_string()]);
        assert_eq!(
            merged.get("key2"),
            vec!["val2".to_string(), "val3".to_string()]
        );
        assert_eq!(merged.get("key3"), vec!["val4".to_string()]);
    }
}
