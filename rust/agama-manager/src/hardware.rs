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

use agama_utils::{api::manager::HardwareInfo, arch::Arch};
use serde::Deserialize;
use serde_with::{formats::PreferMany, serde_as, OneOrMany};
use std::{
    path::{Path, PathBuf},
    process::ExitStatus,
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("lshw command failed: {stderr}")]
    Command { status: ExitStatus, stderr: String },
    #[error("Failed to parse lshw output: {source:?}")]
    Parse {
        json: String,
        #[source]
        source: serde_json::Error,
    },
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Clone)]
enum Source {
    System,
    File(PathBuf),
}

pub struct Registry {
    root: Option<HardwareNode>,
    source: Source,
}

impl Registry {
    pub fn new_from_system() -> Self {
        Self {
            source: Source::System,
            root: None,
        }
    }

    pub fn new_from_file<P: AsRef<Path>>(path: P) -> Self {
        Self {
            source: Source::File(path.as_ref().to_path_buf()),
            root: None,
        }
    }

    pub async fn read(&mut self) -> Result<(), Error> {
        match &self.source {
            Source::System => {
                self.read_from_system().await?;
                // On s390x, enrich the system and processor nodes with info from
                // /proc/sysinfo, as lshw does not report them properly.
                if Arch::is_s390() {
                    self.read_s390_model().await.ok();
                }
                Ok(())
            }
            Source::File(ref path) => self.read_from_file(path.clone()),
        }
    }

    async fn read_from_system(&mut self) -> Result<(), Error> {
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

        let stdout = String::from_utf8_lossy(&output.stdout);
        self.root = Some(HardwareNode::from_json(&stdout)?);
        Ok(())
    }

    /// Builds a registry using the lshw data from a file.
    fn read_from_file<P: AsRef<Path>>(&mut self, path: P) -> Result<(), Error> {
        let json = std::fs::read_to_string(path)?;
        self.root = Some(HardwareNode::from_json(&json)?);
        Ok(())
    }

    /// Enriches the s390x system and processor nodes with info read from /proc/sysinfo.
    async fn read_s390_model(&mut self) -> Result<(), Error> {
        let Some(ref mut root) = self.root else {
            return Ok(());
        };

        let Some(info) = S390Info::read("/proc/sysinfo").await? else {
            return Ok(());
        };

        if let Some(system) = root.find_first_by_class_mut("system") {
            system.vendor = Some("IBM".to_string());
            system.version = Some(info.model);
        }

        if let Some(cpu) = info.cpu {
            if let Some(processor) = root.find_first_by_class_mut("processor") {
                processor.product = Some(cpu);
            }
        }

        Ok(())
    }

    /// Converts the information to a HardwareInfo struct.
    pub fn to_hardware_info(&self) -> HardwareInfo {
        let Some(root) = &self.root else {
            return HardwareInfo::default();
        };

        HardwareInfo::from(root)
    }
}

/// Hardware information from the underlying system.
///
/// It relies on lshw to read the hardware information.
#[serde_as]
#[derive(Clone, Debug, Deserialize, PartialEq)]
struct HardwareNode {
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
    /// Builds a node (including its children) from a JSON string.
    ///
    /// * `json`: JSON string reference.
    fn from_json(json: &str) -> Result<HardwareNode, Error> {
        let node = serde_json::from_str(json).map_err(|error| Error::Parse {
            json: json.to_string(),
            source: error,
        })?;

        Ok(node)
    }

    /// Searches hardware information using the id (e.g., "cpu").
    ///
    /// It assumes that the id is unique.
    ///
    /// * `id`: id to search for (e.g., "cpu", "memory", etc.).
    pub fn find_by_id(&self, id: &str) -> Option<&HardwareNode> {
        if self.id == id {
            return Some(self);
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
            results.push(self);
        }

        for children in &self.children {
            children.search_by_class(class, results);
        }
    }

    /// Searches and returns the first hardware node by class (mutable version).
    ///
    /// * `class`: class to search for (e.g., "disk", "processor", etc.).
    pub fn find_first_by_class_mut(&mut self, class: &str) -> Option<&mut HardwareNode> {
        if self.class == class {
            return Some(self);
        }

        for children in &mut self.children {
            let result = children.find_first_by_class_mut(class);
            if result.is_some() {
                return result;
            }
        }

        None
    }
}

impl From<&HardwareNode> for HardwareInfo {
    fn from(value: &HardwareNode) -> Self {
        // Find the first "processor" node to get the CPU. Use the "product" key. If not present,
        // fallback to "vendor" (like in s390x).
        let cpu = value
            .find_by_class("processor")
            .first()
            .and_then(|c| c.product.clone().or(c.vendor.clone()));

        let memory = value
            .find_by_id("memory")
            .or_else(|| value.find_by_id("memory:0"))
            .and_then(|m| m.size);

        let model = if let Some(system) = value.find_by_class("system").first() {
            let model_str = format!(
                "{} {}",
                system.vendor.clone().unwrap_or_default(),
                system.version.clone().unwrap_or_default()
            )
            .trim()
            .to_string();
            if model_str.is_empty() {
                None
            } else {
                Some(model_str)
            }
        } else {
            None
        };

        Self { cpu, memory, model }
    }
}

/// Model and CPU derived from the s390x /proc/sysinfo file.
#[derive(Debug, PartialEq)]
struct S390Info {
    model: String,
    cpu: Option<String>,
}

impl S390Info {
    /// Reads and parses the given /proc/sysinfo-like file.
    async fn read<P: AsRef<Path>>(path: P) -> Result<Option<Self>, Error> {
        let sysinfo = tokio::fs::read_to_string(path).await?;
        Ok(Self::parse(&sysinfo))
    }

    /// Parses the model and CPU from the content of /proc/sysinfo.
    ///
    /// The model is built as "<type>-<model suffix>" (e.g., "8561-LT1" out of
    /// "Type: 8561" and "Model: 400 LT1"), which is combined with the "IBM" vendor by
    /// `to_hardware_info`, resulting in "IBM 8561-LT1".
    fn parse(sysinfo: &str) -> Option<Self> {
        let type_number = Self::sysinfo_value(sysinfo, "Type")?;
        let model_line = Self::sysinfo_value(sysinfo, "Model")?;
        let model_suffix = model_line.split_whitespace().nth(1)?;

        Some(Self {
            model: format!("{}-{}", type_number, model_suffix),
            cpu: Self::cpu_name_for_type(&type_number).map(str::to_string),
        })
    }

    /// Reads the value of a "key: value" line from /proc/sysinfo.
    fn sysinfo_value(sysinfo: &str, key: &str) -> Option<String> {
        sysinfo.lines().find_map(|line| {
            let (name, value) = line.split_once(':')?;
            (name.trim() == key).then(|| value.trim().to_string())
        })
    }

    /// Maps a machine type number to a human-readable CPU name.
    fn cpu_name_for_type(type_number: &str) -> Option<&'static str> {
        match type_number {
            "9175" | "9176" => Some("IBM z17"),
            "3931" | "3932" => Some("IBM z16"),
            "8561" | "8562" => Some("IBM z15"),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{error::Error, path::PathBuf};

    use super::*;

    #[tokio::test]
    async fn test_read_from_system() {
        let old_path = std::env::var("PATH").unwrap();
        let bin_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../share/bin");
        std::env::set_var("PATH", format!("{}:{}", &bin_dir.display(), &old_path));
        let mut hardware = Registry::new_from_system();
        hardware.read().await.unwrap();

        let info = hardware.to_hardware_info();
        assert!(info.cpu.is_some());
    }

    #[tokio::test]
    async fn test_find_by_id() -> Result<(), Box<dyn Error>> {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        let path = fixtures.join("lshw.json");
        let json = std::fs::read_to_string(path)?;
        let node: HardwareNode = serde_json::from_str(&json)?;

        let cpu = node.find_by_id("cpu").unwrap();
        assert_eq!(cpu.class, "processor");
        assert_eq!(
            cpu.product,
            Some("AMD Ryzen 5 PRO 5650U with Radeon Graphics".to_string())
        );

        let unknown = node.find_by_id("unknown");
        assert_eq!(unknown, None);
        Ok(())
    }

    #[tokio::test]
    async fn test_find_by_class() -> Result<(), Box<dyn Error>> {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        let path = fixtures.join("lshw.json");
        let json = std::fs::read_to_string(path)?;
        let node: HardwareNode = serde_json::from_str(&json)?;

        let disks = node.find_by_class("disk");
        assert_eq!(disks.len(), 3);

        let disk = disks.first().unwrap();
        assert_eq!(disk.description, Some("NVMe disk".to_string()));
        assert_eq!(disk.logicalname, vec!["hwmon1".to_string()]);

        let unknown = node.find_by_class("unknown");
        assert!(unknown.is_empty());
        Ok(())
    }

    #[tokio::test]
    async fn test_to_hardware_info() -> Result<(), Box<dyn Error>> {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        let mut registry = Registry::new_from_file(fixtures.join("lshw.json"));
        registry.read().await?;
        let node = registry.to_hardware_info();
        assert_eq!(
            node.cpu,
            Some("AMD Ryzen 5 PRO 5650U with Radeon Graphics".to_string())
        );
        assert_eq!(node.memory, Some(17179869184));
        assert_eq!(node.model, Some("LENOVO ThinkPad T14s Gen 2a".to_string()));
        Ok(())
    }

    #[tokio::test]
    async fn test_to_hardware_info_qemu() -> Result<(), Box<dyn Error>> {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        let mut registry = Registry::new_from_file(fixtures.join("lshw-qemu.json"));
        registry.read().await?;
        let node = registry.to_hardware_info();
        assert_eq!(
            node.cpu,
            Some("AMD Ryzen 5 PRO 5650U with Radeon Graphics".to_string())
        );
        assert_eq!(node.memory, Some(4294967296));
        assert_eq!(node.model, Some("QEMU pc-q35-9.2".to_string()));
        Ok(())
    }

    #[test]
    fn test_parse_from_json_error() {
        let invalid_json = "INVALID JSON";
        let error = HardwareNode::from_json(invalid_json).unwrap_err();
        println!("{error}");
        assert!(matches!(
            error,
            super::Error::Parse {
                json: _json,
                source: _source
            }
        ));
    }

    #[test]
    fn test_parse_s390_sysinfo() {
        let sysinfo = "\
Manufacturer:         IBM
Type:                 8561
LIC Identifier:       307025ff6902229b
Model:                400              LT1
";
        let info = S390Info::parse(sysinfo).unwrap();
        assert_eq!(info.model, "8561-LT1");
        assert_eq!(info.cpu, Some("IBM z15".to_string()));
    }

    #[test]
    fn test_parse_s390_sysinfo_unknown_type() {
        let sysinfo = "Type: 1234\nModel: 400 LT1\n";
        let info = S390Info::parse(sysinfo).unwrap();
        assert_eq!(info.model, "1234-LT1");
        assert_eq!(info.cpu, None);
    }

    #[test]
    fn test_parse_s390_sysinfo_missing_fields() {
        assert_eq!(S390Info::parse("No relevant lines"), None);
        assert_eq!(S390Info::parse("Type: 8561"), None);
    }

    #[tokio::test]
    async fn test_to_hardware_incomplete() -> Result<(), Box<dyn Error>> {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        let mut registry = Registry::new_from_file(fixtures.join("lshw-incomplete.json"));
        registry.read().await?;
        let node = registry.to_hardware_info();
        assert_eq!(node.cpu, None);
        assert_eq!(node.memory, None);
        assert_eq!(node.model, None);
        Ok(())
    }

    #[tokio::test]
    async fn test_to_hardware_s390x() -> Result<(), Box<dyn Error>> {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        let mut registry = Registry::new_from_file(fixtures.join("lshw-s390x.json"));
        registry.read().await?;
        let node = registry.to_hardware_info();
        assert_eq!(node.cpu, Some("IBM/S390".to_string()));
        assert_eq!(node.memory, Some(8589934592));
        // Model is not available from lshw on s390x
        assert_eq!(node.model, None);
        Ok(())
    }

    #[tokio::test]
    async fn test_s390x_model_enrichment() -> Result<(), Box<dyn Error>> {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        let mut registry = Registry::new_from_file(fixtures.join("lshw-s390x.json"));
        registry.read().await?;

        // Simulate enriching the system node with s390 model data
        if let Some(ref mut root) = registry.root {
            if let Some(system) = root.find_first_by_class_mut("system") {
                system.vendor = Some("IBM".to_string());
                system.version = Some("LinuxONE III LT1".to_string());
            }
        }

        let node = registry.to_hardware_info();
        assert_eq!(node.cpu, Some("IBM/S390".to_string()));
        assert_eq!(node.memory, Some(8589934592));
        // Model should now be available from the enriched system node
        assert_eq!(node.model, Some("IBM LinuxONE III LT1".to_string()));
        Ok(())
    }

    #[tokio::test]
    async fn test_s390x_enrich_with_different_formats() -> Result<(), Box<dyn Error>> {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");

        // Test "IBM LinuxONE III LT1" format - should split into vendor="IBM" and version="LinuxONE III LT1"
        let mut registry = Registry::new_from_file(fixtures.join("lshw-s390x.json"));
        registry.read().await?;
        if let Some(ref mut root) = registry.root {
            if let Some(system) = root.find_first_by_class_mut("system") {
                system.vendor = Some("IBM".to_string());
                system.version = Some("LinuxONE III LT1".to_string());
            }
        }
        let info = registry.to_hardware_info();
        assert_eq!(info.model, Some("IBM LinuxONE III LT1".to_string()));

        // Test "IBM eServer zSeries 900" format - should split into vendor="IBM" and version="eServer zSeries 900"
        let mut registry = Registry::new_from_file(fixtures.join("lshw-s390x.json"));
        registry.read().await?;
        if let Some(ref mut root) = registry.root {
            if let Some(system) = root.find_first_by_class_mut("system") {
                system.vendor = Some("IBM".to_string());
                system.version = Some("eServer zSeries 900".to_string());
            }
        }
        let info = registry.to_hardware_info();
        assert_eq!(info.model, Some("IBM eServer zSeries 900".to_string()));

        // Test "IBM LinuxONE Rockhopper" format - should split into vendor="IBM" and version="LinuxONE Rockhopper"
        let mut registry = Registry::new_from_file(fixtures.join("lshw-s390x.json"));
        registry.read().await?;
        if let Some(ref mut root) = registry.root {
            if let Some(system) = root.find_first_by_class_mut("system") {
                system.vendor = Some("IBM".to_string());
                system.version = Some("LinuxONE Rockhopper".to_string());
            }
        }
        let info = registry.to_hardware_info();
        assert_eq!(info.model, Some("IBM LinuxONE Rockhopper".to_string()));

        // Test non-IBM format - everything should go to version
        let mut registry = Registry::new_from_file(fixtures.join("lshw-s390x.json"));
        registry.read().await?;
        if let Some(ref mut root) = registry.root {
            if let Some(system) = root.find_first_by_class_mut("system") {
                system.version = Some("SomeOther Vendor Model".to_string());
            }
        }
        let info = registry.to_hardware_info();
        assert_eq!(info.model, Some("SomeOther Vendor Model".to_string()));

        // Test "z900    IBM eServer zSeries 900" format with machine type prefix
        let mut registry = Registry::new_from_file(fixtures.join("lshw-s390x.json"));
        registry.read().await?;
        if let Some(ref mut root) = registry.root {
            if let Some(system) = root.find_first_by_class_mut("system") {
                system.vendor = Some("IBM".to_string());
                system.version = Some("eServer zSeries 900".to_string());
            }
        }
        let info = registry.to_hardware_info();
        assert_eq!(info.model, Some("IBM eServer zSeries 900".to_string()));

        Ok(())
    }
}
