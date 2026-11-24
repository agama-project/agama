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

//! Runs the network scenarios in `rust/test/network_tests` against the network model.
//!
//! Each step of a scenario is checked against the profile schema, applied to the network state
//! as `agama config load` would do it (unless the schema rejects it), and the resulting proposal
//! is compared with the expectations of the step. See the README of that directory.
//!
//! To see the report, run it with `--nocapture`. Set `NETWORK_SCENARIO` to run only the
//! scenarios whose path contains the given text:
//!
//! ```text
//! NETWORK_SCENARIO=new/07 cargo test -p agama-network --test network_scenarios -- --nocapture
//! ```

use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use agama_lib::profile::{ProfileValidator, ValidationOutcome};
use agama_network::NetworkState;
use agama_utils::api::network::{
    Config, NetworkConnection, NetworkConnectionsCollection, Proposal,
};
use serde::Deserialize;
use serde_json::{Map, Value};

#[derive(Deserialize)]
struct Scenario {
    title: String,
    description: String,
    steps: Vec<Step>,
}

#[derive(Deserialize)]
struct Step {
    profile: String,
    description: String,
    expect: Expectation,
}

#[derive(Deserialize)]
struct Expectation {
    /// "invalid" when the schema must reject the profile. Then it is not applied, as on a live
    /// system.
    schema: Option<String>,
    /// Error the network service must reject the profile with, for a profile that the schema
    /// accepts.
    error: Option<String>,
    /// Connection ID -> expected values. `controller` and `removed` are special, any other key is
    /// compared with the field of the reported connection (`null` meaning "not set").
    #[serde(default)]
    connections: BTreeMap<String, Map<String, Value>>,
}

/// A reported connection and the ID of the controller it is nested in.
struct Reported {
    controller: Value,
    fields: Map<String, Value>,
}

fn base_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn scenario_dirs(root: &Path) -> Vec<PathBuf> {
    let filter = std::env::var("NETWORK_SCENARIO").unwrap_or_default();
    let mut dirs = vec![];
    for format in ["old", "new"] {
        let mut found: Vec<PathBuf> = fs::read_dir(root.join(format))
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .filter(|path| path.join("scenario.json").exists())
            .filter(|path| path.to_string_lossy().contains(&filter))
            .collect();
        found.sort();
        dirs.extend(found);
    }
    dirs
}

/// Flattens the reported connections, ports included, by ID.
fn flatten(conns: &[Value], controller: Value, out: &mut BTreeMap<String, Reported>) {
    for conn in conns {
        let Some(fields) = conn.as_object() else {
            continue;
        };
        let id = fields["id"].as_str().unwrap_or_default().to_string();
        for kind in ["bond", "bridge"] {
            if let Some(ports) = conn[kind]["portConnections"].as_array() {
                flatten(ports, Value::String(id.clone()), out);
            }
        }
        out.insert(
            id,
            Reported {
                controller: controller.clone(),
                fields: fields.clone(),
            },
        );
    }
}

fn reported(state: &NetworkState) -> BTreeMap<String, Reported> {
    let proposal = Proposal::try_from(state.clone()).expect("the proposal cannot be built");
    let conns = serde_json::to_value(&proposal.connections).unwrap();
    let mut out = BTreeMap::new();
    flatten(conns.as_array().unwrap(), Value::Null, &mut out);
    out
}

fn variant(error: &impl std::fmt::Debug) -> String {
    let debug = format!("{error:?}");
    debug.split(['(', ' ', '{']).next().unwrap().to_string()
}

/// Collects the results of the checks and prints them.
#[derive(Default)]
struct Report {
    checks: usize,
    failures: Vec<String>,
}

impl Report {
    fn check(&mut self, context: &str, ok: bool, text: String) {
        self.checks += 1;
        println!("      {} {}", if ok { "✓" } else { "✗" }, text);
        if !ok {
            self.failures.push(format!("{context}: {text}"));
        }
    }
}

fn compact(value: &Value) -> String {
    serde_json::to_string(value).unwrap()
}

fn check_connections(
    report: &mut Report,
    context: &str,
    state: &NetworkState,
    expected: &BTreeMap<String, Map<String, Value>>,
) {
    let actual = reported(state);

    for (id, fields) in expected {
        let found = actual
            .get(id)
            .filter(|c| c.fields.get("status") != Some(&"removed".into()));

        if fields.get("removed") == Some(&Value::Bool(true)) {
            report.check(context, found.is_none(), format!("{id}: removed"));
            continue;
        }

        let Some(conn) = found else {
            report.check(
                context,
                false,
                format!("{id}: expected, but it is not there"),
            );
            continue;
        };

        let mut wrong = vec![];
        let mut right = vec![];
        for (key, value) in fields {
            let got = match key.as_str() {
                "controller" => &conn.controller,
                _ => conn.fields.get(key).unwrap_or(&Value::Null),
            };
            if got == value {
                right.push(format!("{key}={}", compact(value)));
            } else {
                wrong.push(format!(
                    "{key}: expected {}, got {}",
                    compact(value),
                    compact(got)
                ));
            }
        }

        if wrong.is_empty() {
            report.check(context, true, format!("{id}: {}", right.join(", ")));
        } else {
            for problem in wrong {
                report.check(context, false, format!("{id}: {problem}"));
            }
        }
    }
}

fn run_step(
    report: &mut Report,
    validator: &ProfileValidator,
    state: &mut NetworkState,
    dir: &Path,
    context: &str,
    step: &Step,
) {
    let path = dir.join(&step.profile);
    let expect = &step.expect;

    let schema_invalid = expect.schema.as_deref() == Some("invalid");
    match validator.validate_file(&path).unwrap() {
        ValidationOutcome::Valid => report.check(
            context,
            !schema_invalid,
            "schema: the profile is valid".to_string(),
        ),
        ValidationOutcome::NotValid(problems) => report.check(
            context,
            schema_invalid,
            format!("schema: the profile is not valid ({})", problems.join("; ")),
        ),
    }

    // agama config load stops there, so the profile does not reach the network service.
    if schema_invalid {
        check_connections(report, context, state, &expect.connections);
        return;
    }

    let profile: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
    let conns: Vec<NetworkConnection> =
        match serde_json::from_value(profile["network"]["connections"].clone()) {
            Ok(conns) => conns,
            Err(error) => {
                report.check(
                    context,
                    false,
                    format!("the profile cannot be read: {error}"),
                );
                return;
            }
        };

    let result = state.update_state(Config {
        connections: Some(NetworkConnectionsCollection(conns)),
        ..Default::default()
    });

    match (&expect.error, result) {
        (None, Ok(())) => report.check(context, true, "network: applied".to_string()),
        (None, Err(error)) => report.check(context, false, format!("network: rejected: {error}")),
        (Some(expected), Ok(())) => report.check(
            context,
            false,
            format!("network: applied, but {expected} was expected"),
        ),
        (Some(expected), Err(error)) => {
            let got = variant(&error);
            report.check(
                context,
                &got == expected,
                format!("network: rejected with {got}: {error}"),
            )
        }
    }

    check_connections(report, context, state, &expect.connections);
}

#[test]
fn test_network_scenarios() {
    let root = base_dir().join("test/network_tests");
    let validator = ProfileValidator::new(base_dir().join("share/profile.schema.json")).unwrap();
    let mut report = Report::default();
    let mut steps = 0;

    let dirs = scenario_dirs(&root);
    assert!(!dirs.is_empty(), "no scenario matches NETWORK_SCENARIO");

    for dir in &dirs {
        let name = dir.strip_prefix(&root).unwrap().display().to_string();
        let scenario: Scenario =
            serde_json::from_str(&fs::read_to_string(dir.join("scenario.json")).unwrap())
                .unwrap_or_else(|e| panic!("{name}/scenario.json: {e}"));

        println!("\n▶ {name}: {}", scenario.title);
        println!("  {}", scenario.description);

        let mut state = NetworkState::default();
        for (index, step) in scenario.steps.iter().enumerate() {
            println!(
                "  [{}/{}] {}: {}",
                index + 1,
                scenario.steps.len(),
                step.profile,
                step.description
            );
            let context = format!("{name}/{}", step.profile);
            run_step(&mut report, &validator, &mut state, dir, &context, step);
            steps += 1;
        }
    }

    println!(
        "\n{} scenarios, {} steps, {} checks, {} failed",
        dirs.len(),
        steps,
        report.checks,
        report.failures.len()
    );
    assert!(
        report.failures.is_empty(),
        "failed checks:\n{}",
        report.failures.join("\n")
    );
}
