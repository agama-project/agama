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

//! Checks the network part of the profile schema, generated from the types of the API.

pub mod common;
use agama_lib::profile::{ProfileValidator, ValidationOutcome};
use serde_json::json;
use std::path::PathBuf;

async fn validator() -> ProfileValidator {
    common::build_test_validator("Config").await
}

fn share_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../share")
}

async fn validate(profile: serde_json::Value) -> ValidationOutcome {
    validator()
        .await
        .validate_str(&profile.to_string())
        .unwrap()
}

fn connections(connections: serde_json::Value) -> serde_json::Value {
    json!({ "network": { "connections": connections } })
}

#[tokio::test]
async fn test_network_examples_are_valid() {
    let validator = validator().await;
    let dir = share_dir().join("examples/network");
    for example in ["bond.json", "bridge.json", "stacked.json"] {
        let outcome = validator.validate_file(&dir.join(example)).unwrap();
        assert!(
            matches!(outcome, ValidationOutcome::Valid),
            "{example}: {outcome:?}"
        );
    }
}

#[tokio::test]
async fn test_nested_ports_do_not_need_an_id() {
    let profile = connections(json!([{
        "id": "bond0",
        "bond": { "mode": "active-backup", "portConnections": [{ "interface": "eth0" }, "eth1"] }
    }]));
    assert!(matches!(validate(profile).await, ValidationOutcome::Valid));
}

#[tokio::test]
async fn test_top_level_connections_need_an_id() {
    let profile = connections(json!([{ "interface": "eth0" }]));
    assert!(matches!(
        validate(profile).await,
        ValidationOutcome::NotValid(_)
    ));
}

#[tokio::test]
async fn test_bridge_port_settings_are_rejected_on_a_bond_port() {
    let profile = connections(json!([{
        "id": "bond0",
        "bond": {
            "mode": "active-backup",
            "portConnections": [{ "interface": "eth0", "port": { "priority": 32 } }]
        }
    }]));
    assert!(matches!(
        validate(profile).await,
        ValidationOutcome::NotValid(_)
    ));

    let profile = connections(json!([{
        "id": "br0",
        "bridge": { "portConnections": [{ "interface": "eth0", "port": { "priority": 32 } }] }
    }]));
    assert!(matches!(validate(profile).await, ValidationOutcome::Valid));
}

#[tokio::test]
async fn test_nested_ports_can_be_any_kind_of_connection() {
    // NetworkManager does not restrict the kind of the ports, so neither does the schema.
    let vlan = json!({ "parent": "eth0", "id": 100 });
    let wireless = json!({ "ssid": "agama", "security": "wpa-psk", "mode": "infrastructure" });
    let bond = json!({ "mode": "active-backup" });
    let bridge = json!({ "stp": false });

    let validator = validator().await;
    let port_of = |kind: &str, port: &serde_json::Value| {
        let mut settings = if kind == "bond" {
            bond.clone()
        } else {
            bridge.clone()
        };
        settings["portConnections"] = json!([port]);
        let profile = connections(json!([{ "id": "controller", kind: settings }]));
        validator.validate_str(&profile.to_string()).unwrap()
    };
    for kind in ["bond", "bridge"] {
        for port in [
            json!({ "interface": "eth0" }),
            json!({ "bond": bond }),
            json!({ "bridge": bridge }),
            json!({ "vlan": vlan }),
            json!({ "wireless": wireless }),
        ] {
            assert!(
                matches!(port_of(kind, &port), ValidationOutcome::Valid),
                "{port} in a {kind}"
            );
        }

        // A port is a single kind of connection.
        let port = json!({ "bond": bond, "vlan": vlan });
        assert!(
            matches!(port_of(kind, &port), ValidationOutcome::NotValid(_)),
            "{port} in a {kind}"
        );
    }
}

#[tokio::test]
async fn test_nested_ports_are_validated_as_connections() {
    let profile = connections(json!([{
        "id": "br0",
        "bridge": {
            "portConnections": [{
                "id": "bond0",
                "bond": { "mode": "active-backup", "portConnections": [{ "mtu": "big" }] }
            }]
        }
    }]));
    assert!(matches!(
        validate(profile).await,
        ValidationOutcome::NotValid(_)
    ));
}

#[tokio::test]
async fn test_nested_ports_do_not_accept_ip_settings() {
    for setting in [
        json!({ "method4": "disabled" }),
        json!({ "method6": "disabled" }),
        json!({ "addresses": ["192.168.1.2/24"] }),
        json!({ "gateway4": "192.168.1.1" }),
        json!({ "gateway6": "::1" }),
        json!({ "nameservers": ["192.168.1.1"] }),
        json!({ "dnsSearchList": ["example.lan"] }),
        json!({ "dnsSearchlist": ["example.lan"] }),
        json!({ "ignoreAutoDns": false }),
    ] {
        let mut port = json!({ "interface": "eth0" });
        port.as_object_mut()
            .unwrap()
            .extend(setting.as_object().unwrap().clone());
        let profile = connections(json!([{
            "id": "bond0",
            "bond": { "mode": "active-backup", "portConnections": [port] }
        }]));
        assert!(
            matches!(validate(profile).await, ValidationOutcome::NotValid(_)),
            "{setting}"
        );
    }
}

#[tokio::test]
async fn test_ports_only_take_names() {
    let profile = connections(json!([{
        "id": "bond0",
        "bond": { "mode": "active-backup", "ports": [{ "interface": "eth0" }] }
    }]));
    assert!(matches!(
        validate(profile).await,
        ValidationOutcome::NotValid(_)
    ));
}

#[tokio::test]
async fn test_ports_and_port_connections_can_be_given_together() {
    for (controller, settings) in [
        ("bond", json!({ "mode": "active-backup" })),
        ("bridge", json!({})),
    ] {
        let mut settings = settings;
        settings["ports"] = json!(["eth0"]);
        settings["portConnections"] = json!(["eth0"]);
        let profile = connections(json!([{ "id": "ctl0", controller: settings }]));
        assert!(
            matches!(validate(profile).await, ValidationOutcome::Valid),
            "{controller}"
        );
    }
}

#[tokio::test]
async fn test_only_nested_ports_can_have_port_settings() {
    let port = json!({ "priority": 16, "pathCost": 50 });

    let profile = connections(json!([{ "id": "eth0", "port": port }]));
    assert!(matches!(
        validate(profile).await,
        ValidationOutcome::NotValid(_)
    ));

    let profile = connections(json!([
        { "id": "eth0", "port": port },
        { "id": "br0", "bridge": { "ports": ["eth0"] } }
    ]));
    assert!(matches!(
        validate(profile).await,
        ValidationOutcome::NotValid(_)
    ));

    let profile = connections(json!([{
        "id": "br0",
        "bridge": { "portConnections": [{ "interface": "eth0", "port": port }] }
    }]));
    assert!(matches!(validate(profile).await, ValidationOutcome::Valid));
}

/// Before the ports were nested, the profiles gave them at the top level and disabled their IP
/// methods. The backend ignores those settings, so the profile is still valid.
#[tokio::test]
async fn test_ports_given_at_the_top_level_can_have_ip_settings() {
    let profile = connections(json!([
        { "id": "eth0", "interface": "eth0", "method4": "disabled", "method6": "disabled" },
        { "id": "eth1", "interface": "eth1", "method4": "disabled", "method6": "disabled" },
        { "id": "bond0", "bond": { "mode": "active-backup", "ports": ["eth0", "eth1"] } }
    ]));
    assert!(matches!(validate(profile).await, ValidationOutcome::Valid));
}

#[tokio::test]
async fn test_link_local_is_the_documented_ip_method() {
    let profile = connections(json!([{
        "id": "eth0",
        "method4": "link-local",
        "method6": "link-local"
    }]));
    assert!(matches!(validate(profile).await, ValidationOutcome::Valid));
}

#[tokio::test]
async fn test_connections_do_not_accept_the_state() {
    let profile = connections(json!([{ "id": "eth0", "state": "activated" }]));
    assert!(matches!(
        validate(profile).await,
        ValidationOutcome::NotValid(_)
    ));
}

#[tokio::test]
async fn test_controller_is_not_accepted_anymore() {
    let profile = connections(json!([{ "id": "eth0", "controller": "bond0" }]));
    assert!(matches!(
        validate(profile).await,
        ValidationOutcome::NotValid(_)
    ));
}
