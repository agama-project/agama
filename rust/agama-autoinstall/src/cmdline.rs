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

use anyhow::Context;

/// Implements a mechanism to read the kernel's command-line arguments.
pub struct CmdlineArgs(HashMap<String, String>);

impl CmdlineArgs {
    /// Builds an instance from the given file.
    ///
    /// * `content`: file containing the kernel's cmdline arguments.
    pub fn parse_file<P: std::fmt::Display + AsRef<Path>>(file: P) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(&file).context(format!(
            "Could not read cmdline args file {}",
            file.to_string()
        ))?;
        Ok(Self::parse_str(&content))
    }

    /// Builds an instance from the given string.
    ///
    /// * `content`: string containing the kernel's cmdline arguments.
    pub fn parse_str(content: &str) -> Self {
        let mut args: HashMap<String, String> = HashMap::default();
        for param in content.split_whitespace() {
            if let Some((key, value)) = param.split_once("=") {
                args.insert(key.to_string(), value.to_string());
            } else {
                args.insert(param.to_string(), "1".to_string());
            }
        }
        Self(args)
    }

    /// Returns the value for the argument.
    ///
    /// * `name`: argument name.
    pub fn get(&self, name: &str) -> Option<&str> {
        self.0.get(name).map(|x| x.as_str())
    }
}

#[cfg(test)]
mod tests {
    use crate::CmdlineArgs;

    #[test]
    fn test_cmdline_args() {
        let args_str = r"rd.neednet inst.auto=file:///profile.json";
        let args = CmdlineArgs::parse_str(args_str);

        assert_eq!(args.get("inst.auto"), Some("file:///profile.json"));
        assert_eq!(args.get("rd.neednet"), Some("1"));
        assert!(args.get("unknown").is_none());
    }
}
