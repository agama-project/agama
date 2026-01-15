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

//! Implement support for detecting and converting architeture identifiers.

use std::process::Command;

#[derive(Clone, Copy, Debug, PartialEq, strum::Display, strum::EnumString)]
#[strum(serialize_all = "lowercase")]
pub enum Arch {
    AARCH64,
    PPC64LE,
    S390X,
    X86_64,
}

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Unknown architecture: {0}")]
    Unknown(String),
    #[error("Could not detect the architecture")]
    Detect(#[from] std::io::Error),
}

impl Arch {
    /// Returns the current architecture.
    pub fn current() -> Result<Self, Error> {
        let output = Command::new("uname").arg("-m").output()?;
        let arch_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        arch_str
            .as_str()
            .try_into()
            .map_err(|_| Error::Unknown(arch_str))
    }

    /// Returns the identifier used in the products definition.
    pub fn to_yast_id(&self) -> String {
        match &self {
            Arch::AARCH64 => "aarch64".to_string(),
            Arch::PPC64LE => "ppc".to_string(),
            Arch::S390X => "s390".to_string(),
            Arch::X86_64 => "x86_64".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_arch_from_string() {
        assert_eq!("aarch64".try_into(), Ok(Arch::AARCH64));
        assert_eq!("ppc64le".try_into(), Ok(Arch::PPC64LE));
        assert_eq!("s390x".try_into(), Ok(Arch::S390X));
        assert_eq!("x86_64".try_into(), Ok(Arch::X86_64));
    }

    #[test]
    fn test_arch_to_string() {
        assert_eq!(Arch::AARCH64.to_string(), "aarch64".to_string());
        assert_eq!(Arch::PPC64LE.to_string(), "ppc64le".to_string());
        assert_eq!(Arch::S390X.to_string(), "s390x".to_string());
        assert_eq!(Arch::X86_64.to_string(), "x86_64".to_string());
    }

    #[test]
    fn test_to_product_string() {
        assert_eq!(Arch::AARCH64.to_yast_id(), "aarch64".to_string());
        assert_eq!(Arch::PPC64LE.to_yast_id(), "ppc".to_string());
        assert_eq!(Arch::S390X.to_yast_id(), "s390".to_string());
        assert_eq!(Arch::X86_64.to_yast_id(), "x86_64".to_string());
    }

    #[cfg(target_arch = "aarch64")]
    #[test]
    fn test_current_arch_aarch64() {
        assert_eq!(Arch::current().unwrap(), Arch::AARCH64);
    }

    #[cfg(target_arch = "powerpc64")]
    #[test]
    fn test_current_arch_powerpc64() {
        assert_eq!(Arch::current().unwrap(), Arch::PPC64LE);
    }

    #[cfg(target_arch = "s390x")]
    #[test]
    fn test_current_arch_s390x() {
        assert_eq!(Arch::current().unwrap(), Arch::S390X);
    }

    #[cfg(target_arch = "x86_64")]
    #[test]
    fn test_current_arch_x86_64() {
        assert_eq!(Arch::current().unwrap(), Arch::X86_64);
    }
}
