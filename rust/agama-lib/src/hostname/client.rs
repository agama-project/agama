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

use crate::{error::ServiceError, hostname::model::HostnameSettings, proxies::Hostname1Proxy};

/// Client to connect to org.freedesktop.hostname1 DBUS API on the system bus for Hostname management.
#[derive(Clone)]
pub struct HostnameClient<'a> {
    hostname_proxy: Hostname1Proxy<'a>,
}

impl<'a> HostnameClient<'a> {
    pub async fn new() -> Result<HostnameClient<'a>, ServiceError> {
        let connection = zbus::Connection::system().await?;
        let hostname_proxy = Hostname1Proxy::new(&connection).await?;

        Ok(Self { hostname_proxy })
    }

    pub async fn get_config(&self) -> Result<HostnameSettings, ServiceError> {
        let hostname = self.hostname_proxy.hostname().await?;
        let static_hostname = self.hostname_proxy.static_hostname().await?;

        let settings = HostnameSettings {
            hostname: Some(hostname),
            static_hostname: Some(static_hostname),
        };

        Ok(settings)
    }

    pub async fn set_config(&self, config: &HostnameSettings) -> Result<(), ServiceError> {
        let settings = self.get_config().await?;

        // order is important as otherwise the transient hostname could not be set in case the
        // static one is not empty
        if let Some(config_static_hostname) = &config.static_hostname {
            if settings.static_hostname != config.static_hostname {
                self.hostname_proxy
                    .set_static_hostname(config_static_hostname.as_str(), false)
                    .await?;
            }
        }

        if let Some(config_hostname) = &config.hostname {
            if settings.hostname != config.hostname {
                self.hostname_proxy
                    .set_hostname(config_hostname.as_str(), false)
                    .await?;
            }
        }

        Ok(())
    }
}
