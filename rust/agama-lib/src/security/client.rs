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

use std::str::FromStr;

use zbus::Connection;

use crate::error::ServiceError;

use super::{model::SSLFingerprint, proxies::SecurityProxy};

/// D-Bus client for the security service
#[derive(Clone)]
pub struct SecurityClient<'a> {
    security_proxy: SecurityProxy<'a>,
}

impl SecurityClient<'_> {
    pub async fn new(connection: Connection) -> Result<Self, ServiceError> {
        Ok(Self {
            security_proxy: SecurityProxy::new(&connection).await?,
        })
    }

    pub async fn get_ssl_fingerprints(&self) -> Result<Vec<SSLFingerprint>, ServiceError> {
        let dbus_list = self.security_proxy.ssl_fingerprints().await?;
        dbus_list
            .into_iter()
            .map(|(alg, value)| {
                Ok(SSLFingerprint {
                    fingerprint: value,
                    algorithm: super::model::SSLFingerprintAlgorithm::from_str(&alg)?,
                })
            })
            .collect()
    }

    pub async fn set_ssl_fingerprints(
        &self,
        list: &Vec<SSLFingerprint>,
    ) -> Result<(), ServiceError> {
        let dbus_list: Vec<(&str, &str)> = list
            .iter()
            .map(|s| (s.algorithm.clone().into(), s.fingerprint.as_str()))
            .collect();
        self.security_proxy.set_ssl_fingerprints(&dbus_list).await?;
        Ok(())
    }
}
