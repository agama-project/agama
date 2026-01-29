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

use std::{collections::HashMap, fs::File, io::Write, path::Path, process::Command};

use agama_utils::api::security::SSLFingerprint;
use openssl::{
    hash::MessageDigest,
    nid::Nid,
    x509::{X509NameRef, X509},
};

/// Wrapper around a X509 certificate.
///
/// It extracts the relevant information from a certificate (fingerprint, issuer name, etc.).
pub struct Certificate {
    x509: X509,
}

impl Certificate {
    pub fn new(x509: X509) -> Self {
        Self { x509 }
    }

    pub fn not_before(&self) -> String {
        self.x509.not_before().to_string()
    }

    pub fn not_after(&self) -> String {
        self.x509.not_after().to_string()
    }

    pub fn fingerprint(&self) -> Option<SSLFingerprint> {
        self.sha256().or_else(|| self.sha1())
    }

    pub fn sha1(&self) -> Option<SSLFingerprint> {
        match self.x509.digest(MessageDigest::sha1()) {
            Ok(digest) => {
                let fingerprint = digest
                    .iter()
                    .map(|b| format!("{:02x}", b))
                    .collect::<Vec<String>>()
                    .join(":");
                SSLFingerprint::sha1(&fingerprint).into()
            }
            Err(_) => None,
        }
    }

    pub fn sha256(&self) -> Option<SSLFingerprint> {
        match self.x509.digest(MessageDigest::sha256()) {
            Ok(digest) => {
                let fingerprint = digest
                    .iter()
                    .map(|b| format!("{:02x}", b))
                    .collect::<Vec<String>>()
                    .join(":");
                SSLFingerprint::sha256(&fingerprint).into()
            }
            Err(_) => None,
        }
    }

    pub fn import<P: AsRef<Path>>(&self, path: P) -> std::io::Result<()> {
        let mut file = File::create(path)?;
        let pem = self.x509.to_pem().unwrap();
        file.write_all(&pem)?;
        Command::new("update-ca-certificates").output()?;
        Ok(())
    }

    pub fn to_data(&self) -> HashMap<String, String> {
        let issuer_name = self.x509.issuer_name();
        let mut data = HashMap::from([
            ("issueDate".to_string(), self.not_before()),
            ("expirationDate".to_string(), self.not_after()),
        ]);

        if let Some(common_name) = Self::extract_entry(issuer_name, Nid::COMMONNAME) {
            data.insert("issuer".to_string(), common_name);
        }

        if let Some(o) = Self::extract_entry(issuer_name, Nid::ORGANIZATIONNAME) {
            data.insert("organization".to_string(), o);
        }

        if let Some(sha1) = self.sha1() {
            data.insert("sha1".to_string(), sha1.to_string());
        }

        if let Some(sha256) = self.sha256() {
            data.insert("sha256".to_string(), sha256.to_string());
        }

        data
    }

    /// Extract an entry from the X509 names.
    ///
    /// It only extracts the first value.
    ///
    /// * `name`: X509 names.
    /// * `nid`: entry identifier.
    fn extract_entry(name: &X509NameRef, nid: Nid) -> Option<String> {
        let Some(entry) = name.entries_by_nid(nid).next() else {
            return None;
        };

        entry.data().as_utf8().map(|l| l.to_string()).ok()
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use openssl::x509::X509;

    use crate::certificate::Certificate;

    #[test]
    fn test_read_certificate() {
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        let path = fixtures.join("test.pem");
        let content = std::fs::read_to_string(path).unwrap();

        let x509 = X509::from_pem(content.as_bytes()).unwrap();
        let certificate = Certificate::new(x509);

        let data = certificate.to_data();
        assert_eq!(
            data.get("organization").unwrap(),
            &"Example Company Ltd".to_string()
        );
        assert_eq!(
            data.get("issueDate").unwrap(),
            &"Jan 19 10:49:57 2026 GMT".to_string()
        );
        assert_eq!(
            data.get("expirationDate").unwrap(),
            &"Jan 19 10:49:57 2027 GMT".to_string()
        );
        assert_eq!(
            data.get("sha1").unwrap(),
            &"5D:F7:68:CE:DE:96:4C:DC:EA:84:E0:35:09:7A:9D:5F:AF:B3:25:F4".to_string()
        );
        assert_eq!(
            data.get("sha256").unwrap(),
            &"18:C0:D9:DC:9D:A9:93:6B:52:79:39:62:39:49:17:9F:0B:9F:AD:95:83:A5:D6:5B:02:16:62:F4:4B:18:1A:79".to_string()
        );
    }
}
