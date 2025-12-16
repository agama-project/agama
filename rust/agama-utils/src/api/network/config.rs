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

//! Representation of the network settings

use crate::api::network::{NetworkConnectionsCollection, StateSettings};
use merge::Merge;
use serde::{Deserialize, Serialize};
use std::default::Default;

/// Network config settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
#[merge(strategy = merge::option::recurse)]
pub struct Config {
    /// Connections to use in the installation
    pub connections: Option<NetworkConnectionsCollection>,
    /// Network general settings
    pub state: Option<StateSettings>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::network::settings::{NetworkConnection, WirelessSettings}; // Import necessary types

    #[test]
    fn test_merge_network_config() {
        // The `updated` config that will be merged into
        let mut updated = Config {
            connections: Some(NetworkConnectionsCollection(vec![NetworkConnection {
                id: "eth0".to_string(),
                method4: Some("dhcp".to_string()),
                addresses: vec![],
                nameservers: vec![],
                dns_searchlist: vec![],
                mtu: 1500,
                ..Default::default()
            }])),
            state: Some(StateSettings {
                connectivity: Some(true),
                wireless_enabled: Some(true),
                networking_enabled: Some(true),
                copy_network: None,
            }),
        };

        // The `original` config to merge from
        let original = Config {
            connections: Some(NetworkConnectionsCollection(vec![
                NetworkConnection {
                    id: "eth1".to_string(),
                    method4: Some("static".to_string()),
                    addresses: vec!["192.168.1.10/24".parse().unwrap()],
                    nameservers: vec!["8.8.8.8".parse().unwrap()],
                    dns_searchlist: vec!["example.com".to_string()],
                    mtu: 0, // default
                    ..Default::default()
                },
                NetworkConnection {
                    id: "wifi0".to_string(),
                    method4: Some("dhcp".to_string()),
                    wireless: Some(WirelessSettings {
                        ssid: "MyWiFi".to_string(),
                        security: "wpa2".to_string(),
                        ..Default::default()
                    }),
                    ..Default::default()
                },
            ])),
            state: Some(StateSettings {
                connectivity: Some(false),       // This should NOT overwrite updated's true
                wireless_enabled: None,          // This should NOT overwrite updated's true
                networking_enabled: Some(false), // This should NOT overwrite updated's true
                copy_network: Some(true),        // This SHOULD overwrite updated's None
            }),
        };

        // Perform the merge
        updated.merge(original.clone());

        // Assertions for connections
        // NetworkConnectionsCollection has overwrite_empty strategy.
        // This means the vector is only replaced if the destination vector is empty.
        // Since updated.connections was not empty, it is NOT overwritten.
        assert_eq!(updated.connections.as_ref().unwrap().0.len(), 1);
        assert_eq!(updated.connections.as_ref().unwrap().0[0].id, "eth0");

        // Assertions for state (StateSettings has overwrite_none strategy)
        let merged_state = updated.state.unwrap();
        assert_eq!(merged_state.connectivity, Some(true)); // from updated, not overwritten by original.Some(false)
        assert_eq!(merged_state.wireless_enabled, Some(true)); // from updated, not overwritten by original.None
        assert_eq!(merged_state.networking_enabled, Some(true)); // from updated, not overwritten by original.Some(false)
        assert_eq!(merged_state.copy_network, Some(true)); // from original, overwritten updated.None

        // Test with empty Vec for overwrite_empty strategy
        let mut updated1 = Config {
            connections: Some(NetworkConnectionsCollection(vec![NetworkConnection {
                id: "test_empty".to_string(),
                ..Default::default()
            }])),
            state: None,
        };
        let original1 = Config {
            connections: Some(NetworkConnectionsCollection(vec![])), // empty vec
            state: None,
        };
        updated1.merge(original1);
        assert_eq!(updated1.connections.as_ref().unwrap().0.len(), 1); // should not be overwritten by empty vec

        let mut updated2 = Config {
            connections: None,
            state: None,
        };
        let original2 = Config {
            connections: Some(NetworkConnectionsCollection(vec![])), // empty vec
            state: None,
        };
        updated2.merge(original2);
        assert!(updated2.connections.unwrap().0.is_empty()); // should be empty, as updated was None
    }

    #[test]
    fn test_merge_network_config_with_nones() {
        // Case 1: `updated` has Some, `original` has None -> `updated` should be preserved
        let mut updated = Config {
            connections: Some(NetworkConnectionsCollection(vec![NetworkConnection {
                id: "conn1".to_string(),
                ..Default::default()
            }])),
            state: Some(StateSettings {
                connectivity: Some(true),
                ..Default::default()
            }),
        };
        let updated_clone = updated.clone();
        let original = Config {
            connections: None,
            state: None,
        };

        updated.merge(original);
        assert_eq!(updated.connections, updated_clone.connections);
        assert_eq!(updated.state, updated_clone.state);

        // Case 2: `updated` has None, `original` has Some -> `updated` should be replaced by `original`
        let mut updated1 = Config {
            connections: None,
            state: None,
        };
        let original1 = Config {
            connections: Some(NetworkConnectionsCollection(vec![NetworkConnection {
                id: "conn2".to_string(),
                ..Default::default()
            }])),
            state: Some(StateSettings {
                wireless_enabled: Some(false),
                ..Default::default()
            }),
        };
        let original1_clone = original1.clone();

        updated1.merge(original1);
        assert_eq!(updated1.connections, original1_clone.connections);
        assert_eq!(updated1.state, original1_clone.state);

        // Case 3: Both None -> remains None
        let mut updated2 = Config {
            connections: None,
            state: None,
        };
        let original2 = Config {
            connections: None,
            state: None,
        };
        updated2.merge(original2);
        assert_eq!(updated2.connections, None);
        assert_eq!(updated2.state, None);
    }
}
