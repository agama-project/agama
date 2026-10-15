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

//! Core Model Context Protocol (MCP) server dispatcher and tool handlers using the `rmcp` SDK.

use crate::error::{BackendError, Error};
use crate::mode::McpMode;
use crate::tools::{
    filter_system_resource, tool_error, tool_success, validate_config_schema, AnswerQuestionArgs,
    GetConfigSchemaArgs, GetLogsArgs, GetSystemArgs, ProposalOutcome, SetConfigArgs,
};
use agama_utils::actor::Handler;
use agama_utils::api::question::{self, Question};
use agama_utils::api::status::Stage;
use agama_utils::api::{status::Status, Action, Config, IssueWithScope, Proposal, SystemInfo};
use agama_utils::progress;
use agama_utils::question as question_service;
use async_trait::async_trait;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, Implementation, ServerCapabilities, ServerConfig};
use rmcp::{tool, tool_handler, tool_router, ServerHandler};
use serde_json::json;
use std::sync::Arc;

/// Backend trait abstracting interactions with the Agama installer state machine.
#[async_trait]
pub trait McpBackend: Send + Sync {
    /// Queries the hardware probe engines for physical and software system info.
    async fn get_system(&self) -> Result<SystemInfo, BackendError>;

    /// Applies a complete configuration profile (replacing previous user configuration).
    async fn set_config(&self, config: Config) -> Result<(), BackendError>;

    /// Retrieves the computed installation proposal.
    async fn get_proposal(&self) -> Result<Option<Proposal>, BackendError>;

    /// Retrieves active issues / validation errors.
    async fn get_issues(&self) -> Result<Vec<IssueWithScope>, BackendError>;

    /// Triggers the installation action.
    async fn commit_install(&self) -> Result<(), BackendError>;

    /// Retrieves current progress status and active tasks.
    async fn get_progress(&self) -> Result<Status, BackendError>;

    /// Retrieves all interactive questions (both pending and answered).
    async fn get_questions(&self) -> Result<Vec<Question>, BackendError>;

    /// Submits an answer to a pending question, unblocking progress.
    async fn answer_question(
        &self,
        id: u32,
        action: String,
        value: Option<String>,
    ) -> Result<(), BackendError>;
}

/// Production MCP backend connected to live Agama Manager and Questions actors.
struct AgamaBackend {
    manager: Handler<agama_manager::Service>,
    questions: Handler<question_service::Service>,
}

#[async_trait]
impl McpBackend for AgamaBackend {
    async fn get_system(&self) -> Result<SystemInfo, BackendError> {
        Ok(self.manager.call(agama_manager::message::GetSystem).await?)
    }

    async fn set_config(&self, config: Config) -> Result<(), BackendError> {
        Ok(self
            .manager
            .call(agama_manager::message::SetConfig::new(config))
            .await?)
    }

    async fn get_proposal(&self) -> Result<Option<Proposal>, BackendError> {
        Ok(self
            .manager
            .call(agama_manager::message::GetProposal)
            .await?)
    }

    async fn get_issues(&self) -> Result<Vec<IssueWithScope>, BackendError> {
        let issue_groups = self.manager.call(agama_manager::message::GetIssues).await?;
        Ok(issue_groups
            .into_iter()
            .flat_map(|(scope, issues)| {
                issues
                    .into_iter()
                    .map(move |issue| IssueWithScope { scope, issue })
            })
            .collect())
    }

    async fn commit_install(&self) -> Result<(), BackendError> {
        Ok(self
            .manager
            .call(agama_manager::message::RunAction::new(Action::Install))
            .await?)
    }

    async fn get_progress(&self) -> Result<Status, BackendError> {
        Ok(self.manager.call(progress::message::GetStatus).await?)
    }

    async fn get_questions(&self) -> Result<Vec<Question>, BackendError> {
        Ok(self.questions.call(question_service::message::Get).await?)
    }

    async fn answer_question(
        &self,
        id: u32,
        action: String,
        value: Option<String>,
    ) -> Result<(), BackendError> {
        let answer = question::Answer { action, value };
        Ok(self
            .questions
            .call(question_service::message::Answer { id, answer })
            .await?)
    }
}

/// Core MCP Server implementation exposing Agama installer capabilities as tools.
#[derive(Clone)]
pub struct McpServer {
    backend: Arc<dyn McpBackend>,
    mode: McpMode,
}

#[tool_router]
impl McpServer {
    /// Creates a new MCP server with a custom backend.
    pub fn with_backend(backend: Arc<dyn McpBackend>, mode: McpMode) -> Self {
        Self { backend, mode }
    }

    /// Creates a new MCP server connected to the Agama Manager and Questions services.
    pub fn new(
        manager: Handler<agama_manager::Service>,
        questions: Handler<question_service::Service>,
        mode: McpMode,
    ) -> Self {
        let backend = AgamaBackend { manager, questions };
        Self::with_backend(Arc::new(backend), mode)
    }

    /// Returns the current operating mode.
    pub fn mode(&self) -> McpMode {
        self.mode
    }

    /// Queries Agama's hardware probe engines to map the physical state of the machine.
    #[tool(
        name = "get_system",
        description = "Queries Agama's hardware probe engines to map the physical state of the machine. Accepts an optional 'resource' filter (e.g. 'storage', 'network', 'hardware') to avoid blowing out context limits on large systems."
    )]
    pub async fn get_system(
        &self,
        Parameters(args): Parameters<GetSystemArgs>,
    ) -> Result<CallToolResult, Error> {
        let system = match self.backend.get_system().await {
            Ok(s) => s,
            Err(e) => return Ok(tool_error(format!("Failed to probe system: {e}"))),
        };

        let system_val = match serde_json::to_value(&system) {
            Ok(v) => v,
            Err(e) => return Ok(tool_error(format!("Failed to serialize system info: {e}"))),
        };

        if let Some(resource) = args.resource {
            let trimmed = resource.trim();
            if !trimmed.is_empty() {
                let filtered = filter_system_resource(&system_val, trimmed);
                let is_err = filtered.get("error").is_some();
                let formatted = serde_json::to_string_pretty(&filtered)?;
                return if is_err {
                    Ok(tool_error(formatted))
                } else {
                    Ok(tool_success(formatted))
                };
            }
        }

        let formatted = serde_json::to_string_pretty(&system_val)?;
        Ok(tool_success(formatted))
    }

    /// Returns the JSON Schema for the Agama installation profile, optionally filtered by section.
    #[tool(
        name = "get_config_schema",
        description = "Retrieves the JSON Schema for the Agama installation profile. Call without arguments to view the list of available sections and overview. Provide a section name (e.g. 'storage', 'software', 'access', 'network', 'user', 'bootloader') to retrieve the detailed field-level constraints, types, and allowed enum values for that subsystem."
    )]
    pub async fn get_config_schema(
        &self,
        Parameters(args): Parameters<GetConfigSchemaArgs>,
    ) -> Result<CallToolResult, Error> {
        let schema_val = match crate::tools::load_schema_json() {
            Ok(v) => v,
            Err(e) => return Ok(tool_error(format!("Failed to load Agama schema: {e}"))),
        };

        match crate::tools::get_schema_for_section(&schema_val, args.section.as_deref()) {
            Ok(res_val) => {
                let formatted = serde_json::to_string_pretty(&res_val)?;
                Ok(tool_success(formatted))
            }
            Err(e) => Ok(tool_error(e.to_string())),
        }
    }

    /// Pushes the AI-generated Agama profile (JSON) to the installer.
    #[tool(
        name = "set_config",
        description = "Pushes the complete Agama configuration profile (JSON) to the installer. Performs a full replacement of the configuration state. Top-level sections include: 'product', 'software', 'storage', 'user', 'root', 'network', 'bootloader', 'access', 'ntp', 'l10n', 'hostname', 'security', 'proxy'. Use the 'get_config_schema' tool to inspect valid keys, types, and constraints for any section."
    )]
    pub async fn set_config(
        &self,
        Parameters(args): Parameters<SetConfigArgs>,
    ) -> Result<CallToolResult, Error> {
        let profile_val = if let Some(s) = args.config.as_str() {
            match serde_json::from_str(s) {
                Ok(v) => v,
                Err(e) => return Ok(tool_error(format!("Invalid JSON syntax in 'config': {e}"))),
            }
        } else {
            args.config
        };

        if !profile_val.is_object() {
            return Ok(tool_error(
                "Expected 'config' to be a JSON object containing the configuration profile.",
            ));
        }

        if let Err(err) = validate_config_schema(&profile_val) {
            return Ok(tool_error(err.to_string()));
        }

        let config: Config = match serde_json::from_value(profile_val) {
            Ok(c) => c,
            Err(e) => {
                return Ok(tool_error(format!(
                    "Failed to parse configuration into Agama model: {e}"
                )));
            }
        };

        if let Err(e) = self.backend.set_config(config).await {
            return Ok(tool_error(format!(
                "Failed to apply configuration state: {e}"
            )));
        }

        Ok(tool_success(
            "Configuration profile replaced and applied successfully.",
        ))
    }

    /// Commands Agama to compute the final installation plan based on the injected configuration and hardware reality.
    #[tool(
        name = "get_proposal",
        description = "Commands Agama to compute the final installation plan based on the injected configuration and hardware reality. Returns the diff/plan on success, proposal_computing if calculation is in progress, or issues if the configuration is invalid."
    )]
    pub async fn get_proposal(&self) -> Result<CallToolResult, Error> {
        let status = match self.backend.get_progress().await {
            Ok(s) => s,
            Err(e) => return Ok(tool_error(format!("Failed to retrieve status: {e}"))),
        };

        if status.stage == Stage::Configuring && !status.tasks.is_empty() {
            return ProposalOutcome::computing(status.tasks).to_tool_result();
        }

        let proposal = match self.backend.get_proposal().await {
            Ok(p) => p,
            Err(e) => return Ok(tool_error(format!("Failed to compute proposal: {e}"))),
        };

        let issues = match self.backend.get_issues().await {
            Ok(i) => i,
            Err(e) => return Ok(tool_error(format!("Failed to retrieve issues: {e}"))),
        };

        ProposalOutcome::from_results(proposal, issues).to_tool_result()
    }

    /// Locks the state machine and triggers disk format and software deployment.
    #[tool(
        name = "commit_install",
        description = "Locks the state machine and triggers the disk format and software deployment. Disabled in configuration mode (returns 403 Forbidden)."
    )]
    pub async fn commit_install(&self) -> Result<CallToolResult, Error> {
        if !self.mode.allows_install() {
            return Err(Error::Forbidden);
        }

        if let Err(e) = self.backend.commit_install().await {
            return Ok(tool_error(format!("Failed to trigger installation: {e}")));
        }

        Ok(tool_success(
            "Installation committed and started. Monitor progress using the 'get_progress' tool.",
        ))
    }

    /// Returns structured data regarding the current state, stage, percentage completion, active tasks, and any pending questions.
    #[tool(
        name = "get_progress",
        description = "Returns structured data regarding the current state, stage, percentage completion, active tasks, and any pending questions requiring an answer."
    )]
    pub async fn get_progress(&self) -> Result<CallToolResult, Error> {
        let status = match self.backend.get_progress().await {
            Ok(s) => s,
            Err(e) => return Ok(tool_error(format!("Failed to retrieve progress: {e}"))),
        };

        let pending_questions = match self.backend.get_questions().await {
            Ok(questions) => questions
                .into_iter()
                .filter(|q| q.answer.is_none())
                .collect(),
            Err(err) => {
                tracing::warn!("Failed to retrieve questions for progress: {err}");
                Vec::new()
            }
        };

        let percent = match status.stage {
            Stage::Configuring => 0.0,
            Stage::Finished => 100.0,
            Stage::Failed => 0.0,
            Stage::Installing => {
                if status.progresses.is_empty() {
                    50.0
                } else {
                    let total: f64 = status
                        .progresses
                        .iter()
                        .map(|p| (p.index as f64 / p.size.max(1) as f64) * 100.0)
                        .sum();
                    (total / (status.progresses.len() as f64)).clamp(0.0, 100.0)
                }
            }
        };

        let report = json!({
            "stage": status.stage,
            "percent": percent,
            "isFinished": status.stage == Stage::Finished,
            "isFailed": status.stage == Stage::Failed,
            "tasks": status.tasks,
            "progresses": status.progresses,
            "hasPendingQuestions": !pending_questions.is_empty(),
            "pendingQuestions": pending_questions,
        });

        let formatted = serde_json::to_string_pretty(&report)?;
        Ok(tool_success(formatted))
    }

    /// Retrieves specific subsets of system logs directly from journalctl.
    #[tool(
        name = "get_logs",
        description = "Retrieves specific subsets of system logs directly from journalctl to prevent overwhelming the AI context window. Allows specifying log scope and line count."
    )]
    pub async fn get_logs(
        &self,
        Parameters(args): Parameters<GetLogsArgs>,
    ) -> Result<CallToolResult, Error> {
        let logs = crate::logs::get_logs(args.log_type.as_deref(), args.lines);
        Ok(tool_success(logs))
    }

    /// Retrieves interactive questions raised by the Agama installer awaiting an answer.
    #[tool(
        name = "get_questions",
        description = "Retrieves interactive questions raised by the Agama installer awaiting an answer (e.g. disk decryption password, GPG import, package retry)."
    )]
    pub async fn get_questions(&self) -> Result<CallToolResult, Error> {
        let questions = match self.backend.get_questions().await {
            Ok(q) => q,
            Err(e) => return Ok(tool_error(format!("Failed to retrieve questions: {e}"))),
        };

        let pending: Vec<_> = questions
            .into_iter()
            .filter(|q| q.answer.is_none())
            .collect();

        let formatted = serde_json::to_string_pretty(&pending)?;
        Ok(tool_success(formatted))
    }

    /// Submits an answer to a pending question, unblocking installer progress.
    #[tool(
        name = "answer_question",
        description = "Submits an answer to a pending question, unblocking installer progress. Provide question ID, action identifier, and optional value."
    )]
    pub async fn answer_question(
        &self,
        Parameters(args): Parameters<AnswerQuestionArgs>,
    ) -> Result<CallToolResult, Error> {
        if let Err(e) = self
            .backend
            .answer_question(args.id, args.action.clone(), args.value)
            .await
        {
            return Ok(tool_error(format!(
                "Failed to answer question {}: {e}",
                args.id
            )));
        }

        Ok(tool_success(format!(
            "Successfully answered question {} with action '{}'.",
            args.id, args.action
        )))
    }
}

#[tool_handler]
impl ServerHandler for McpServer {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(
            ServerCapabilities::builder()
                .enable_tools()
                .enable_resources()
                .build(),
        )
        .with_server_info(Implementation::new("agama-mcp", env!("CARGO_PKG_VERSION")))
        .with_instructions(
            "Agama Baremetal Installer MCP Server. Enables AI agents to probe hardware \
             inventory, inspect configuration schemas with 'get_config_schema', validate and inject configuration profiles \
             with 'set_config', check installation proposals, execute bare-metal installations, answer interactive prompts, and monitor progress.",
        )
    }

    async fn list_resources(
        &self,
        _request: Option<rmcp::model::PaginatedRequestParams>,
        _context: rmcp::service::RequestContext<rmcp::RoleServer>,
    ) -> Result<rmcp::model::ListResourcesResult, rmcp::model::ErrorData> {
        Ok(rmcp::model::ListResourcesResult {
            resources: vec![rmcp::model::Resource::new(
                "agama://schema/config.json",
                "Agama Installation Profile Schema",
            )
            .with_description(
                "Complete JSON Schema for the Agama unattended installation profile.",
            )
            .with_mime_type("application/schema+json")],
            next_cursor: None,
            meta: None,
            cache_scope: None,
            result_type: None,
            ttl_ms: None,
        })
    }

    async fn read_resource(
        &self,
        request: rmcp::model::ReadResourceRequestParams,
        _context: rmcp::service::RequestContext<rmcp::RoleServer>,
    ) -> Result<rmcp::model::ReadResourceResponse, rmcp::model::ErrorData> {
        match request.uri.as_str() {
            "agama://schema/config.json" => {
                let schema_val = crate::tools::load_schema_json()
                    .map_err(|e| rmcp::model::ErrorData::internal_error(e.to_string(), None))?;
                let text = serde_json::to_string_pretty(&schema_val)
                    .map_err(|e| rmcp::model::ErrorData::internal_error(e.to_string(), None))?;
                let result = rmcp::model::ReadResourceResult::new(vec![
                    rmcp::model::ResourceContents::TextResourceContents {
                        uri: request.uri,
                        mime_type: Some("application/schema+json".to_string()),
                        text,
                        meta: None,
                    },
                ]);
                Ok(rmcp::model::ReadResourceResponse::Complete(result))
            }
            _ => Err(rmcp::model::ErrorData::resource_not_found(
                format!("Resource not found: {}", request.uri),
                None,
            )),
        }
    }
}
