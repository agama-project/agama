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

use agama_utils::api::manager::HardwareInfo;
use serde::Deserialize;
use serde_with::{formats::PreferMany, serde_as, OneOrMany};
use std::process::ExitStatus;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("lshw command failed")]
    Command { status: ExitStatus, stderr: String },
    #[error("Failed to parse lshw output")]
    Parse(#[from] serde_json::Error),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

/// Hardware information from the underlying system.
///
/// It relies on lshw to read the hardware information.
#[serde_as]
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct HardwareNode {
    pub id: String,
    pub class: String,
    pub claimed: Option<bool>,
    pub description: Option<String>,
    pub vendor: Option<String>,
    pub product: Option<String>,
    pub version: Option<String>,
    pub serial: Option<String>,
    pub businfo: Option<String>,
    pub dev: Option<String>,
    pub driver: Option<String>,
    pub physid: Option<String>,
    pub size: Option<u64>,
    pub capacity: Option<u64>,
    #[serde(default)]
    #[serde_as(as = "OneOrMany<_, PreferMany>")]
    pub logicalname: Vec<String>,
    pub configuration: Option<serde_json::Value>,
    #[serde(default)]
    pub capabilities: Option<serde_json::Value>,
    #[serde(default)]
    pub children: Vec<HardwareNode>,
}

impl HardwareNode {
    pub async fn from_system() -> Result<HardwareNode, Error> {
        let output = tokio::process::Command::new("lshw")
            .arg("-json")
            .output()
            .await?;

        if !output.status.success() {
            return Err(Error::Command {
                status: output.status,
                stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            });
        }

        let hwinfo: HardwareNode = serde_json::from_slice(&output.stdout)?;
        Ok(hwinfo)
    }

    /// Searches hardware information using the id (e.g., "cpu").
    ///
    /// It assumes that the id is unique.
    ///
    /// * `id`: id to search for (e.g., "cpu", "memory", etc.).
    pub fn find_by_id(&self, id: &str) -> Option<&HardwareNode> {
        if self.id == id {
            return Some(&self);
        }

        for children in &self.children {
            let result = children.find_by_id(id);
            if result.is_some() {
                return result;
            }
        }

        None
    }

    /// Searches hardware information by class (e.g., "disk").
    ///
    /// It might be multiple elements of the same class.
    ///
    /// * `class`: class to search for (e.g., "disk", "processor", etc.).
    pub fn find_by_class(&self, class: &str) -> Vec<&HardwareNode> {
        let mut results = vec![];
        self.search_by_class(class, &mut results);
        results
    }

    fn search_by_class<'a>(&'a self, class: &str, results: &mut Vec<&'a HardwareNode>) {
        if self.class == class {
            results.push(&self);
        }

        for children in &self.children {
            children.search_by_class(class, results);
        }
    }
}

impl From<&HardwareNode> for HardwareInfo {
    fn from(value: &HardwareNode) -> Self {
        // let system_info = value.find_by_class("system");
        let cpu = value
            .find_by_class("processor")
            .first()
            .and_then(|c| c.product.clone());

        let memory = value.find_by_id("memory").and_then(|m| m.size);

        let model = value.find_by_class("system").first().map(|s| {
            format!(
                "{} {}",
                s.vendor.clone().unwrap_or_default(),
                s.version.clone().unwrap_or_default()
            )
            .trim()
            .to_string()
        });

        Self { cpu, memory, model }
    }
}

#[cfg(test)]
mod tests {
    use std::{error::Error, path::PathBuf};

    use test_context::{test_context, AsyncTestContext};

    use super::*;

    struct Context {
        hardware: HardwareNode,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let old_path = std::env::var("PATH").unwrap();
            let bin_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../share/bin");
            std::env::set_var("PATH", format!("{}:{}", &bin_dir.display(), &old_path));
            let hardware = HardwareNode::from_system()
                .await
                .expect("Could not read hardware information");
            Context { hardware }
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_find_by_id(ctx: &mut Context) {
        let cpu = ctx.hardware.find_by_id("cpu").unwrap();
        assert_eq!(cpu.class, "processor");
        assert_eq!(
            cpu.product,
            Some("AMD Ryzen 5 PRO 5650U with Radeon Graphics".to_string())
        );

        let unknown = ctx.hardware.find_by_id("unknown");
        assert_eq!(unknown, None);
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_find_by_class(ctx: &mut Context) {
        let disks = ctx.hardware.find_by_class("disk");
        assert_eq!(disks.len(), 3);

        let disk = disks.first().unwrap();
        assert_eq!(disk.description, Some("NVMe disk".to_string()));
        assert_eq!(disk.logicalname, vec!["hwmon1".to_string()]);

        let unknown = ctx.hardware.find_by_class("unknown");
        assert!(unknown.is_empty());
    }

    #[test]
    fn test_to_hardware_info() -> Result<(), Box<dyn Error>> {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        let lshw = std::fs::read_to_string(fixtures.join("lshw.json")).unwrap();
        let node: HardwareNode = serde_json::from_str(&lshw)?;
        let hardware = HardwareInfo::from(&node);
        assert_eq!(
            hardware.cpu,
            Some("AMD Ryzen 5 PRO 5650U with Radeon Graphics".to_string())
        );
        assert_eq!(hardware.memory, Some(17179869184));
        assert_eq!(
            hardware.model,
            Some("LENOVO ThinkPad T14s Gen 2a".to_string())
        );
        Ok(())
    }

    #[test]
    fn test_to_hardware_info_qemu() -> Result<(), Box<dyn Error>> {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        let lshw = std::fs::read_to_string(fixtures.join("lshw-qemu.json")).unwrap();
        let node: HardwareNode = serde_json::from_str(&lshw)?;
        let hardware = HardwareInfo::from(&node);
        assert_eq!(
            hardware.cpu,
            Some("AMD Ryzen 5 PRO 5650U with Radeon Graphics".to_string())
        );
        assert_eq!(hardware.memory, Some(4294967296));
        assert_eq!(hardware.model, Some("QEMU pc-q35-9.2".to_string()));
        Ok(())
    }
}
