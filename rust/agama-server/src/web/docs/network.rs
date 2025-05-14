// Copyright (c) [2024] SUSE LLC
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

use agama_utils::openapi::schemas;
use utoipa::openapi::{Components, ComponentsBuilder, Paths, PathsBuilder};

use super::ApiDocBuilder;

pub struct NetworkApiDocBuilder;

impl ApiDocBuilder for NetworkApiDocBuilder {
    fn title(&self) -> String {
        "Network HTTP API".to_string()
    }

    fn paths(&self) -> Paths {
        PathsBuilder::new()
            .path_from::<crate::network::web::__path_add_connection>()
            .path_from::<crate::network::web::__path_apply>()
            .path_from::<crate::network::web::__path_connect>()
            .path_from::<crate::network::web::__path_connection>()
            .path_from::<crate::network::web::__path_connections>()
            .path_from::<crate::network::web::__path_delete_connection>()
            .path_from::<crate::network::web::__path_devices>()
            .path_from::<crate::network::web::__path_disconnect>()
            .path_from::<crate::network::web::__path_general_state>()
            .path_from::<crate::network::web::__path_update_connection>()
            .path_from::<crate::network::web::__path_update_general_state>()
            .path_from::<crate::network::web::__path_wifi_networks>()
            .build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new()
            .schema_from::<agama_lib::network::settings::BondSettings>()
            .schema_from::<agama_lib::network::settings::IEEE8021XSettings>()
            .schema_from::<agama_lib::network::settings::MatchSettings>()
            .schema_from::<agama_lib::network::settings::NetworkConnection>()
            .schema_from::<agama_lib::network::settings::NetworkSettings>()
            .schema_from::<agama_lib::network::settings::NetworkSettings>()
            .schema_from::<agama_lib::network::settings::WirelessSettings>()
            .schema_from::<agama_lib::network::types::BondMode>()
            .schema_from::<agama_lib::network::types::ConnectionState>()
            .schema_from::<agama_lib::network::types::DeviceState>()
            .schema_from::<agama_lib::network::types::DeviceType>()
            .schema_from::<agama_lib::network::types::SSID>()
            .schema_from::<agama_lib::network::types::Status>()
            .schema_from::<agama_lib::network::model::AccessPoint>()
            .schema_from::<agama_lib::network::model::BondConfig>()
            .schema_from::<agama_lib::network::model::BondOptions>()
            .schema_from::<agama_lib::network::model::BridgeConfig>()
            .schema_from::<agama_lib::network::model::BridgePortConfig>()
            .schema_from::<agama_lib::network::model::Connection>()
            .schema_from::<agama_lib::network::model::ConnectionConfig>()
            .schema_from::<agama_lib::network::model::Device>()
            .schema_from::<agama_lib::network::model::EAPMethod>()
            .schema_from::<agama_lib::network::model::GroupAlgorithm>()
            .schema_from::<agama_lib::network::model::GeneralState>()
            .schema_from::<agama_lib::network::model::IEEE8021XConfig>()
            .schema_from::<agama_lib::network::model::InfinibandConfig>()
            .schema_from::<agama_lib::network::model::InfinibandTransportMode>()
            .schema_from::<agama_lib::network::model::IpConfig>()
            .schema_from::<agama_lib::network::model::IpRoute>()
            .schema_from::<agama_lib::network::model::Ipv4Method>()
            .schema_from::<agama_lib::network::model::Ipv6Method>()
            .schema_from::<agama_lib::network::model::MacAddress>()
            .schema_from::<agama_lib::network::model::MatchConfig>()
            .schema_from::<agama_lib::network::model::PairwiseAlgorithm>()
            .schema_from::<agama_lib::network::model::Phase2AuthMethod>()
            .schema_from::<agama_lib::network::model::PortConfig>()
            .schema_from::<agama_lib::network::model::SecurityProtocol>()
            .schema_from::<agama_lib::network::model::TunConfig>()
            .schema_from::<agama_lib::network::model::TunMode>()
            .schema_from::<agama_lib::network::model::VlanConfig>()
            .schema_from::<agama_lib::network::model::VlanProtocol>()
            .schema_from::<agama_lib::network::model::WEPAuthAlg>()
            .schema_from::<agama_lib::network::model::WEPKeyType>()
            .schema_from::<agama_lib::network::model::WEPSecurity>()
            .schema_from::<agama_lib::network::model::WPAProtocolVersion>()
            .schema_from::<agama_lib::network::model::WirelessBand>()
            .schema_from::<agama_lib::network::model::WirelessConfig>()
            .schema_from::<agama_lib::network::model::WirelessMode>()
            .schema_from::<agama_lib::network::model::Dhcp4Settings>()
            .schema_from::<agama_lib::network::model::DhcpClientId>()
            .schema_from::<agama_lib::network::model::DhcpIaid>()
            .schema_from::<agama_lib::network::model::Dhcp6Settings>()
            .schema_from::<agama_lib::network::model::DhcpDuid>()
            .schema("IpAddr", schemas::ip_addr())
            .schema("IpInet", schemas::ip_inet())
            .schema("macaddr.MacAddr6", schemas::mac_addr6())
            .build()
    }
}
