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

//! Implements a client to access Hostnamed D-Bus API related to hostname management.

use zbus::Connection;

use crate::{error::ServiceError, hostname::model::HostnameSettings, proxies::Hostname1Proxy};

/// Client to connect to Agama's D-Bus API for Hostname management.
#[derive(Clone)]
pub struct HostnameClient<'a> {
    hostname_proxy: Hostname1Proxy<'a>,
}

impl<'a> HostnameClient<'a> {
    pub async fn new(connection: Connection) -> Result<HostnameClient<'a>, ServiceError> {
        let hostname_proxy = Hostname1Proxy::new(&connection).await?;

        Ok(Self { hostname_proxy })
    }

    pub async fn get_config(&self) -> Result<HostnameSettings, ServiceError> {
        let hostname = self.hostname_proxy.hostname().await?;
        let static_hostname = self.hostname_proxy.static_hostname().await?;

        let settings = HostnameSettings {
            hostname,
            static_hostname,
            ..Default::default()
        };

        Ok(settings)
    }

    pub async fn set_config(&self, config: &HostnameSettings) -> Result<(), ServiceError> {
        let settings = self.get_config().await?;
        if settings.hostname != config.hostname {
            self.hostname_proxy
                .set_hostname(config.hostname.as_str(), false)
                .await?;
        }

        if settings.static_hostname != config.static_hostname {
            self.hostname_proxy
                .set_static_hostname(config.static_hostname.as_str(), false)
                .await?;
        }

        Ok(())
    }
}
