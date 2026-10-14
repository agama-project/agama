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

//! Tool argument types and helper functions for the Agama MCP Server.

use crate::error::{SchemaError, ValidationError};
use agama_lib::profile::{ProfileValidator, ValidationOutcome};
use agama_utils::api::status::Task;
use agama_utils::api::{IssueWithScope, Proposal};
use rmcp::model::{CallToolResult, ContentBlock};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;

/// Convenience constructor for a successful single-text tool response.
pub fn tool_success(text: impl Into<String>) -> CallToolResult {
    CallToolResult::success(vec![ContentBlock::text(text.into())])
}

/// Convenience constructor for an error single-text tool response.
pub fn tool_error(text: impl Into<String>) -> CallToolResult {
    CallToolResult::error(vec![ContentBlock::text(text.into())])
}

/// Arguments for the `get_system` tool.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct GetSystemArgs {
    /// Optional resource category to filter by (e.g. 'storage', 'network', 'hardware').
    pub resource: Option<String>,
}

/// Arguments for the `get_config_schema` tool.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct GetConfigSchemaArgs {
    /// Optional section name to retrieve detailed schema for (e.g. 'storage', 'software', 'access', 'network', 'user', 'bootloader'). Omit to get root profile schema overview and available sections.
    pub section: Option<String>,
}

/// Arguments for the `set_config` tool.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SetConfigArgs {
    /// The complete Agama configuration profile in JSON format.
    pub config: Value,
}

/// Arguments for the `get_logs` tool.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct GetLogsArgs {
    /// Log scope: 'installer' for Agama traces (agama* units), 'system' for system-wide journalctl, 'zypp' for package manager logs, or a specific systemd unit name. Defaults to 'installer'.
    pub log_type: Option<String>,
    /// Number of most recent log lines to retrieve (default: 100, max: 1000).
    pub lines: Option<usize>,
}

/// Arguments for the `answer_question` tool.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct AnswerQuestionArgs {
    /// ID of the question to answer.
    pub id: u32,
    /// Action identifier to choose from the question's available actions.
    pub action: String,
    /// Optional value if the question expects input (e.g. password for disk decryption).
    pub value: Option<String>,
}

/// Represents the possible outcomes of computing the installation proposal.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ProposalOutcome {
    ProposalComputing {
        message: &'static str,
        active_tasks: Vec<Task>,
    },
    IssuesDetected {
        message: &'static str,
        issues: Vec<IssueWithScope>,
        proposal: Option<Proposal>,
    },
    ProposalReady {
        proposal: Proposal,
    },
    ProposalPending {
        message: &'static str,
    },
}

impl ProposalOutcome {
    pub fn computing(active_tasks: Vec<Task>) -> Self {
        Self::ProposalComputing {
            message: "Proposal is currently being calculated by Agama solvers. Please wait a few seconds and query get_proposal again.",
            active_tasks,
        }
    }

    pub fn from_results(proposal: Option<Proposal>, issues: Vec<IssueWithScope>) -> Self {
        if !issues.is_empty() {
            Self::IssuesDetected {
                message:
                    "The proposed configuration produced logical issues that must be resolved.",
                issues,
                proposal,
            }
        } else if let Some(proposal) = proposal {
            Self::ProposalReady { proposal }
        } else {
            Self::ProposalPending {
                message: "Proposal is currently not available. Ensure a product is configured.",
            }
        }
    }

    pub fn to_tool_result(&self) -> Result<CallToolResult, crate::error::Error> {
        let formatted = serde_json::to_string_pretty(self)?;
        match self {
            Self::IssuesDetected { .. } => Ok(tool_error(formatted)),
            _ => Ok(tool_success(formatted)),
        }
    }
}

/// Filters system inventory information by resource category.
/// Dynamically matches against top-level keys in the serialized SystemInfo.
pub fn filter_system_resource(system_val: &Value, resource: &str) -> Value {
    if let Some(map) = system_val.as_object() {
        if let Some(val) = map.get(resource) {
            val.clone()
        } else {
            let mut available: Vec<&str> = map.keys().map(|k| k.as_str()).collect();
            available.sort_unstable();
            json!({
                "error": format!("Resource '{resource}' not found in system inventory"),
                "available_resources": available,
            })
        }
    } else {
        system_val.clone()
    }
}

/// Validates configuration against Agama schema.
pub fn validate_config_schema(raw_json: &Value) -> Result<(), ValidationError> {
    let json_str = serde_json::to_string(raw_json)?;

    let validator = ProfileValidator::default_schema()
        .map_err(|e| ValidationError::SchemaUnavailable(e.to_string()))?;

    match validator.validate_str(&json_str) {
        Ok(ValidationOutcome::Valid) => Ok(()),
        Ok(ValidationOutcome::NotValid(reasons)) => Err(ValidationError::NotValid(reasons)),
        Err(e) => Err(ValidationError::Validation(e.to_string())),
    }
}

/// Resolves the file path of the Agama JSON Schema.
pub fn find_schema_path() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev_path = manifest_dir.join("../out/schemas/config.schema.json");
    if dev_path.exists() {
        dev_path
    } else {
        let schema_dir = std::env::var("AGAMA_SCHEMA_DIR")
            .unwrap_or_else(|_| agama_lib::profile::DEFAULT_SCHEMA_DIR.to_string());
        PathBuf::from(schema_dir).join("config.schema.json")
    }
}

/// Loads and parses the raw JSON schema file.
pub fn load_schema_json() -> Result<Value, SchemaError> {
    let path = find_schema_path();
    let contents = std::fs::read_to_string(&path)
        .map_err(|source| SchemaError::Io { path: path.clone(), source })?;
    serde_json::from_str(&contents)
        .map_err(|source| SchemaError::Json { path, source })
}

/// Recursively collects referenced component definitions from the JSON schema.
fn collect_referenced_components(
    val: &Value,
    components: &serde_json::Map<String, Value>,
    collected: &mut serde_json::Map<String, Value>,
) {
    if let Some(r) = val.get("$ref").and_then(|v| v.as_str()) {
        if let Some(name) = r.strip_prefix("#/components/schemas/") {
            if let Some(def) = components.get(name) {
                if collected.insert(name.to_string(), def.clone()).is_none() {
                    collect_referenced_components(def, components, collected);
                }
            }
        }
    }
    match val {
        Value::Object(m) => m.values().for_each(|v| collect_referenced_components(v, components, collected)),
        Value::Array(a) => a.iter().for_each(|v| collect_referenced_components(v, components, collected)),
        _ => {}
    }
}

/// Builds the high-level schema overview listing available configuration sections.
fn schema_overview(props: &serde_json::Map<String, Value>) -> Value {
    let mut available: Vec<_> = props.keys().cloned().collect();
    available.sort_unstable();

    let sections: serde_json::Map<String, Value> = props
        .iter()
        .map(|(k, v)| {
            let desc = v.get("description").and_then(|d| d.as_str()).unwrap_or("");
            (k.clone(), json!({ "description": desc }))
        })
        .collect();

    json!({
        "title": "Agama Installation Profile Schema",
        "description": "Top-level overview of available configuration sections in the Agama profile.",
        "available_sections": available,
        "sections": sections,
        "instructions": "Call get_config_schema with section: \"<name>\" (e.g. \"product\", \"storage\", \"access\") to inspect field constraints and allowed values.",
        "example_minimal_profile": {
            "product": {
                "id": "Tumbleweed"
            },
            "root": {
                "password": "nots3cr3t"
            }
        }
    })
}

/// Returns the schema overview or detailed section schema from Agama's config schema.
pub fn get_schema_for_section(schema_val: &Value, section: Option<&str>) -> Result<Value, SchemaError> {
    let props = schema_val
        .get("properties")
        .and_then(|p| p.as_object())
        .ok_or(SchemaError::MissingProperties)?;

    let Some(sec) = section.map(|s| s.trim()).filter(|s| !s.is_empty()) else {
        return Ok(schema_overview(props));
    };

    let matched_key = props.keys().find(|k| k.eq_ignore_ascii_case(sec)).ok_or_else(|| {
        let mut available: Vec<_> = props.keys().cloned().collect();
        available.sort_unstable();
        SchemaError::SectionNotFound {
            section: sec.to_string(),
            available,
        }
    })?;

    let prop_def = &props[matched_key];
    let components = schema_val
        .get("components")
        .and_then(|c| c.get("schemas"))
        .and_then(|s| s.as_object());

    let mut related = serde_json::Map::new();
    if let Some(comp_map) = components {
        collect_referenced_components(prop_def, comp_map, &mut related);
    }

    Ok(json!({
        "section": matched_key,
        "definition": prop_def,
        "related_definitions": related,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_system_resource() {
        let system_val = json!({
            "storage": { "disks": ["/dev/sda", "/dev/nvme0n1"] },
            "network": { "interfaces": ["eth0"] },
            "software": { "products": ["SLES"] },
            "hardware": { "cpu": "x86_64", "memory": 16000000000u64, "model": "TestVM" }
        });

        let storage = filter_system_resource(&system_val, "storage");
        assert_eq!(storage["disks"][0], "/dev/sda");

        let network = filter_system_resource(&system_val, "network");
        assert_eq!(network["interfaces"][0], "eth0");

        let hardware = filter_system_resource(&system_val, "hardware");
        assert_eq!(hardware["cpu"], "x86_64");

        let unknown = filter_system_resource(&system_val, "unknown_item");
        assert!(unknown.get("error").is_some());
    }

    #[test]
    fn test_get_schema_for_section_errors() {
        let empty_schema = json!({});
        assert!(matches!(
            get_schema_for_section(&empty_schema, None),
            Err(SchemaError::MissingProperties)
        ));

        let valid_schema = json!({
            "properties": {
                "product": { "type": "object" },
                "storage": { "type": "object" }
            }
        });
        let res = get_schema_for_section(&valid_schema, Some("invalid"));
        assert!(matches!(res, Err(SchemaError::SectionNotFound { .. })));
    }
}
