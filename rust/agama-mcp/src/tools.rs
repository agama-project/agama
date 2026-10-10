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

use agama_lib::profile::{ProfileValidator, ValidationOutcome};
use agama_utils::api::status::Task;
use agama_utils::api::{IssueWithScope, Proposal};
use rmcp::model::{CallToolResult, ContentBlock};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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
pub fn validate_config_schema(raw_json: &Value) -> Result<(), Vec<String>> {
    let json_str = match serde_json::to_string(raw_json) {
        Ok(s) => s,
        Err(e) => return Err(vec![format!("Invalid JSON syntax: {e}")]),
    };

    let validator = ProfileValidator::default_schema()
        .map_err(|e| vec![format!("Agama profile schema is not available: {e}")])?;

    match validator.validate_str(&json_str) {
        Ok(ValidationOutcome::Valid) => Ok(()),
        Ok(ValidationOutcome::NotValid(reasons)) => Err(reasons),
        Err(e) => Err(vec![format!("Profile validation error: {e}")]),
    }
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
}
