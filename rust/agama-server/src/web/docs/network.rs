use serde_json::json;
use utoipa::openapi::{Components, ComponentsBuilder, ObjectBuilder, Paths, PathsBuilder};

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
            .path_from::<crate::network::web::__path_connections>()
            .path_from::<crate::network::web::__path_delete_connection>()
            .path_from::<crate::network::web::__path_devices>()
            .path_from::<crate::network::web::__path_disconnect>()
            .path_from::<crate::network::web::__path_update_connection>()
            .path_from::<crate::network::web::__path_apply>()
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
            .schema_from::<agama_lib::network::types::DeviceState>()
            .schema_from::<agama_lib::network::types::DeviceType>()
            .schema_from::<agama_lib::network::types::SSID>()
            .schema_from::<agama_lib::network::types::Status>()
            .schema_from::<crate::network::model::BondConfig>()
            .schema_from::<crate::network::model::BondOptions>()
            .schema_from::<crate::network::model::BridgeConfig>()
            .schema_from::<crate::network::model::BridgePortConfig>()
            .schema_from::<crate::network::model::Connection>()
            .schema_from::<crate::network::model::ConnectionConfig>()
            .schema_from::<crate::network::model::Device>()
            .schema_from::<crate::network::model::EAPMethod>()
            .schema_from::<crate::network::model::GroupAlgorithm>()
            .schema_from::<crate::network::model::IEEE8021XConfig>()
            .schema_from::<crate::network::model::InfinibandConfig>()
            .schema_from::<crate::network::model::InfinibandTransportMode>()
            .schema_from::<crate::network::model::IpConfig>()
            .schema_from::<crate::network::model::IpRoute>()
            .schema_from::<crate::network::model::Ipv4Method>()
            .schema_from::<crate::network::model::Ipv6Method>()
            .schema_from::<crate::network::model::MacAddress>()
            .schema_from::<crate::network::model::MatchConfig>()
            .schema_from::<crate::network::model::PairwiseAlgorithm>()
            .schema_from::<crate::network::model::Phase2AuthMethod>()
            .schema_from::<crate::network::model::PortConfig>()
            .schema_from::<crate::network::model::SecurityProtocol>()
            .schema_from::<crate::network::model::TunConfig>()
            .schema_from::<crate::network::model::TunMode>()
            .schema_from::<crate::network::model::VlanConfig>()
            .schema_from::<crate::network::model::VlanProtocol>()
            .schema_from::<crate::network::model::WEPAuthAlg>()
            .schema_from::<crate::network::model::WEPKeyType>()
            .schema_from::<crate::network::model::WEPSecurity>()
            .schema_from::<crate::network::model::WPAProtocolVersion>()
            .schema_from::<crate::network::model::WirelessBand>()
            .schema_from::<crate::network::model::WirelessConfig>()
            .schema_from::<crate::network::model::WirelessMode>()
            .schema(
                "IpAddr",
                ObjectBuilder::new()
                    .schema_type(utoipa::openapi::SchemaType::String)
                    .description(Some("An IP address (IPv4 or IPv6)".to_string()))
                    .example(Some(json!("192.168.1.100")))
                    .build(),
            )
            .schema(
                "IpInet",
                ObjectBuilder::new()
                    .schema_type(utoipa::openapi::SchemaType::String)
                    .description(Some(
                        "An IP address (IPv4 or IPv6) including the prefix".to_string(),
                    ))
                    .example(Some(json!("192.168.1.254/24")))
                    .build(),
            )
            .schema(
                "macaddr.MacAddr6",
                ObjectBuilder::new()
                    .schema_type(utoipa::openapi::SchemaType::String)
                    .description(Some("MAC address in EUI-48 format".to_string()))
                    .build(),
            )
            .build()
    }
}
