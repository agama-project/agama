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

use agama_utils::openapi::schemas;
use utoipa::openapi::{Components, ComponentsBuilder, Paths, PathsBuilder};

use super::ApiDocBuilder;
pub struct ConfigApiDocBuilder;

impl ApiDocBuilder for ConfigApiDocBuilder {
    fn title(&self) -> String {
        "Config HTTP API".to_string()
    }

    fn paths(&self) -> Paths {
        PathsBuilder::new()
            .path_from::<crate::server::web::__path_get_system>()
            .path_from::<crate::server::web::__path_get_extended_config>()
            .path_from::<crate::server::web::__path_get_config>()
            .path_from::<crate::server::web::__path_put_config>()
            .path_from::<crate::server::web::__path_patch_config>()
            .path_from::<crate::server::web::__path_get_proposal>()
            .path_from::<crate::server::web::__path_run_action>()
            .build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new()
            .schema("IpAddr", schemas::ip_addr())
            .schema("IpInet", schemas::ip_inet())
            .schema("macaddr.MacAddr6", schemas::mac_addr6())
            .schema_from::<agama_l10n::Config>()
            .schema_from::<agama_l10n::message::SystemConfig>()
            .schema_from::<agama_lib::bootloader::model::BootloaderSettings>()
            .schema_from::<agama_lib::file_source::FileSource>()
            .schema_from::<agama_lib::files::model::UserFile>()
            .schema_from::<agama_lib::hostname::model::HostnameSettings>()
            .schema_from::<agama_lib::install_settings::InstallSettings>()
            .schema_from::<agama_lib::issue::Issue>()
            .schema_from::<agama_lib::issue::IssueSeverity>()
            .schema_from::<agama_lib::issue::IssueSource>()
            .schema_from::<agama_lib::network::NetworkSettings>()
            .schema_from::<agama_lib::network::model::AccessPoint>()
            .schema_from::<agama_lib::network::model::BondConfig>()
            .schema_from::<agama_lib::network::model::BondOptions>()
            .schema_from::<agama_lib::network::model::BridgeConfig>()
            .schema_from::<agama_lib::network::model::BridgePortConfig>()
            .schema_from::<agama_lib::network::model::Connection>()
            .schema_from::<agama_lib::network::model::ConnectionConfig>()
            .schema_from::<agama_lib::network::model::Device>()
            .schema_from::<agama_lib::network::model::Dhcp4Settings>()
            .schema_from::<agama_lib::network::model::Dhcp6Settings>()
            .schema_from::<agama_lib::network::model::DhcpClientId>()
            .schema_from::<agama_lib::network::model::DhcpDuid>()
            .schema_from::<agama_lib::network::model::DhcpIaid>()
            .schema_from::<agama_lib::network::model::EAPMethod>()
            .schema_from::<agama_lib::network::model::GeneralState>()
            .schema_from::<agama_lib::network::model::GroupAlgorithm>()
            .schema_from::<agama_lib::network::model::IEEE8021XConfig>()
            .schema_from::<agama_lib::network::model::InfinibandConfig>()
            .schema_from::<agama_lib::network::model::InfinibandTransportMode>()
            .schema_from::<agama_lib::network::model::IpConfig>()
            .schema_from::<agama_lib::network::model::IpRoute>()
            .schema_from::<agama_lib::network::model::Ipv4Method>()
            .schema_from::<agama_lib::network::model::Ipv6Method>()
            .schema_from::<agama_lib::network::model::MacAddress>()
            .schema_from::<agama_lib::network::model::MatchConfig>()
            .schema_from::<agama_lib::network::model::OvsBridgeConfig>()
            .schema_from::<agama_lib::network::model::OvsBridgePortConfig>()
            .schema_from::<agama_lib::network::model::OvsInterfaceConfig>()
            .schema_from::<agama_lib::network::model::OvsInterfaceType>()
            .schema_from::<agama_lib::network::model::OvsPortConfig>()
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
            .schema_from::<agama_lib::network::settings::BondSettings>()
            .schema_from::<agama_lib::network::settings::BridgeSettings>()
            .schema_from::<agama_lib::network::settings::IEEE8021XSettings>()
            .schema_from::<agama_lib::network::settings::MatchSettings>()
            .schema_from::<agama_lib::network::settings::NetworkConnection>()
            .schema_from::<agama_lib::network::settings::NetworkConnection>()
            .schema_from::<agama_lib::network::settings::NetworkSettings>()
            .schema_from::<agama_lib::network::settings::NetworkSettings>()
            .schema_from::<agama_lib::network::settings::VlanSettings>()
            .schema_from::<agama_lib::network::settings::WirelessSettings>()
            .schema_from::<agama_lib::network::types::BondMode>()
            .schema_from::<agama_lib::network::types::ConnectionState>()
            .schema_from::<agama_lib::network::types::DeviceState>()
            .schema_from::<agama_lib::network::types::DeviceType>()
            .schema_from::<agama_lib::network::types::SSID>()
            .schema_from::<agama_lib::network::types::Status>()
            .schema_from::<agama_lib::product::AddonSettings>()
            .schema_from::<agama_lib::product::Product>()
            .schema_from::<agama_lib::product::ProductSettings>()
            .schema_from::<agama_lib::questions::config::QuestionsConfig>()
            .schema_from::<agama_lib::questions::config::QuestionsPolicy>()
            .schema_from::<agama_lib::questions::model::Answer>()
            .schema_from::<agama_lib::questions::model::GenericAnswer>()
            .schema_from::<agama_lib::questions::model::PasswordAnswer>()
            .schema_from::<agama_lib::scripts::BaseScript>()
            .schema_from::<agama_lib::scripts::InitScript>()
            .schema_from::<agama_lib::scripts::PostPartitioningScript>()
            .schema_from::<agama_lib::scripts::PostScript>()
            .schema_from::<agama_lib::scripts::PreScript>()
            .schema_from::<agama_lib::scripts::Script>()
            .schema_from::<agama_lib::scripts::ScriptsConfig>()
            .schema_from::<agama_lib::security::SecuritySettings>()
            .schema_from::<agama_lib::security::model::SSLFingerprint>()
            .schema_from::<agama_lib::security::model::SSLFingerprintAlgorithm>()
            .schema_from::<agama_lib::software::Pattern>()
            .schema_from::<agama_lib::software::PatternsMap>()
            .schema_from::<agama_lib::software::PatternsSettings>()
            .schema_from::<agama_lib::software::SelectedBy>()
            .schema_from::<agama_lib::software::SoftwareSettings>()
            .schema_from::<agama_lib::software::model::LanguageTag>()
            .schema_from::<agama_lib::software::model::License>()
            .schema_from::<agama_lib::software::model::LicenseContent>()
            .schema_from::<agama_lib::software::model::RegistrationError>()
            .schema_from::<agama_lib::software::model::RegistrationInfo>()
            .schema_from::<agama_lib::software::model::Repository>()
            .schema_from::<agama_lib::software::model::RepositoryParams>()
            .schema_from::<agama_lib::software::model::ResolvableType>()
            .schema_from::<agama_lib::software::model::SoftwareConfig>()
            .schema_from::<agama_lib::storage::settings::dasd::DASDConfig>()
            .schema_from::<agama_lib::storage::settings::dasd::DASDDeviceConfig>()
            .schema_from::<agama_lib::storage::settings::dasd::DASDDeviceState>()
            .schema_from::<agama_lib::storage::settings::zfcp::ZFCPConfig>()
            .schema_from::<agama_lib::storage::settings::zfcp::ZFCPDeviceConfig>()
            .schema_from::<agama_lib::users::FirstUserSettings>()
            .schema_from::<agama_lib::users::RootUserSettings>()
            .schema_from::<agama_lib::users::UserPassword>()
            .schema_from::<agama_lib::users::UserSettings>()
            .schema_from::<crate::server::types::ConfigPatch>()
            .schema_from::<crate::server::types::IssuesMap>()
            .schema_from::<crate::software::web::SoftwareProposal>()
            .schema_from::<agama_manager::message::Action>()
            .schema_from::<agama_manager::message::Status>()
            .schema_from::<agama_manager::service::State>()
            .schema_from::<agama_utils::types::progress::Progress>()
            .build()
    }
}
