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

use agama_mcp::error::BackendError;
use agama_mcp::mode::McpMode;
use agama_mcp::server::{McpBackend, McpServer};
use agama_mcp::tools::{
    AnswerQuestionArgs, GetConfigSchemaArgs, GetLogsArgs, GetSystemArgs, SetConfigArgs,
    WaitProgressArgs,
};
use agama_utils::api::event::Event;
use agama_utils::api::question::{
    Action as QuestionAction, Answer as QuestionAnswer, Question, QuestionField, QuestionSpec,
};
use agama_utils::api::scope::Scope;
use agama_utils::api::status::{Stage, Status};
use agama_utils::api::{Config, Issue, IssueWithScope, Proposal, SystemInfo};
use async_trait::async_trait;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, ErrorCode};
use serde_json::json;
use std::sync::{Arc, Mutex};
use std::time::Duration;

type TestResult = Result<(), Box<dyn std::error::Error>>;

fn get_text(res: &CallToolResult) -> &str {
    res.content
        .first()
        .and_then(|c| c.as_text())
        .map(|t| t.text.as_str())
        .unwrap_or("")
}

struct MockBackendState {
    system_info: SystemInfo,
    proposal: Option<Proposal>,
    issues: Vec<IssueWithScope>,
    status: Status,
    install_committed: bool,
    reboot_called: bool,
    questions: Vec<Question>,
    answered_questions: Vec<(u32, String, Option<String>)>,
}

struct MockBackend {
    state: Mutex<MockBackendState>,
    events: Option<tokio::sync::broadcast::Sender<Event>>,
}

fn sample_system_info() -> SystemInfo {
    SystemInfo {
        manager: agama_utils::api::manager::SystemInfo {
            products: vec![agama_utils::api::manager::Product {
                id: "Tumbleweed".to_string(),
                name: "openSUSE Tumbleweed".to_string(),
                description: "openSUSE Tumbleweed rolling release".to_string(),
                icon: "default.svg".to_string(),
                registration: false,
                ..Default::default()
            }],
            ..Default::default()
        },
        hostname: agama_utils::api::hostname::SystemInfo {
            r#static: None,
            hostname: "localhost".to_string(),
        },
        l10n: Default::default(),
        software: Default::default(),
        storage: Some(json!({ "disks": ["/dev/sda", "/dev/nvme0n1"] })),
        iscsi: None,
        bootloader: None,
        network: Default::default(),
        s390: None,
    }
}

fn sample_proposal() -> Proposal {
    Proposal {
        hostname: None,
        l10n: None,
        network: Default::default(),
        access: Default::default(),
        software: None,
        storage: None,
        users: None,
    }
}

fn sample_question() -> Question {
    Question {
        id: 1,
        spec: QuestionSpec {
            text: "Cannot verify GPG signature. Import key?".to_string(),
            class: "importGpg".to_string(),
            field: QuestionField::None,
            actions: vec![
                QuestionAction::new("import", "Import"),
                QuestionAction::new("cancel", "Cancel"),
            ],
            default_action: Some("cancel".to_string()),
            data: Default::default(),
        },
        answer: None,
    }
}

impl Default for MockBackendState {
    fn default() -> Self {
        Self {
            system_info: sample_system_info(),
            proposal: Some(sample_proposal()),
            issues: Vec::new(),
            status: Default::default(),
            install_committed: false,
            reboot_called: false,
            questions: vec![sample_question()],
            answered_questions: Vec::new(),
        }
    }
}

impl Default for MockBackend {
    fn default() -> Self {
        Self {
            state: Mutex::new(MockBackendState::default()),
            events: None,
        }
    }
}

#[async_trait]
impl McpBackend for MockBackend {
    async fn get_system(&self) -> Result<SystemInfo, BackendError> {
        Ok(self.state.lock().unwrap().system_info.clone())
    }

    async fn set_config(&self, _config: Config) -> Result<(), BackendError> {
        Ok(())
    }

    async fn get_proposal(&self) -> Result<Option<Proposal>, BackendError> {
        Ok(self.state.lock().unwrap().proposal.clone())
    }

    async fn get_issues(&self) -> Result<Vec<IssueWithScope>, BackendError> {
        Ok(self.state.lock().unwrap().issues.clone())
    }

    async fn commit_install(&self) -> Result<(), BackendError> {
        self.state.lock().unwrap().install_committed = true;
        Ok(())
    }

    async fn reboot(&self) -> Result<(), BackendError> {
        self.state.lock().unwrap().reboot_called = true;
        Ok(())
    }

    async fn get_progress(&self) -> Result<Status, BackendError> {
        Ok(self.state.lock().unwrap().status.clone())
    }

    async fn get_questions(&self) -> Result<Vec<Question>, BackendError> {
        Ok(self.state.lock().unwrap().questions.clone())
    }

    async fn answer_question(
        &self,
        id: u32,
        action: String,
        value: Option<String>,
    ) -> Result<(), BackendError> {
        let mut state = self.state.lock().unwrap();
        if let Some(q) = state.questions.iter_mut().find(|q| q.id == id) {
            q.answer = Some(QuestionAnswer {
                action: action.clone(),
                value: value.clone(),
            });
        }
        state.answered_questions.push((id, action, value));
        Ok(())
    }

    fn subscribe_events(&self) -> Option<agama_utils::api::event::Receiver> {
        self.events.as_ref().map(|tx| tx.subscribe())
    }
}

#[tokio::test]
async fn test_commit_install_forbidden_in_config_mode() -> TestResult {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend.clone(), McpMode::Config);

    let err = server
        .commit_install()
        .await
        .expect_err("Expected error in config mode");
    assert!(matches!(err, agama_mcp::Error::Forbidden));
    let mcp_err: rmcp::model::ErrorData = err.into();
    assert_eq!(mcp_err.code, ErrorCode(403));
    assert!(mcp_err.message.contains("configuration-only mode"));
    assert!(!backend.state.lock().unwrap().install_committed);
    Ok(())
}

#[tokio::test]
async fn test_commit_install_allowed_in_full_mode() -> TestResult {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    let res = server.commit_install().await?;
    assert!(backend.state.lock().unwrap().install_committed);
    let text = get_text(&res);
    assert!(text.contains("Installation committed and started"));
    Ok(())
}

#[tokio::test]
async fn test_reboot_forbidden_in_config_mode() -> TestResult {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend.clone(), McpMode::Config);

    let err = server
        .reboot()
        .await
        .expect_err("Expected error in config mode");
    assert!(matches!(err, agama_mcp::Error::Forbidden));
    let mcp_err: rmcp::model::ErrorData = err.into();
    assert_eq!(mcp_err.code, ErrorCode(403));
    assert!(!backend.state.lock().unwrap().reboot_called);
    Ok(())
}

#[tokio::test]
async fn test_reboot_blocked_during_installation() -> TestResult {
    let backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().status.stage = Stage::Installing;
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    let res = server.reboot().await?;
    assert_eq!(res.is_error, Some(true));
    let text = get_text(&res);
    assert!(text.contains("Cannot reboot while installation is in progress"));
    assert!(!backend.state.lock().unwrap().reboot_called);
    Ok(())
}

#[tokio::test]
async fn test_reboot_success_when_finished() -> TestResult {
    let backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().status.stage = Stage::Finished;
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    let res = server.reboot().await?;
    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("Reboot initiated"));
    assert!(text.contains("terminating"));
    assert!(backend.state.lock().unwrap().reboot_called);
    Ok(())
}

#[tokio::test]
async fn test_get_system_filtered() -> TestResult {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .get_system(Parameters(GetSystemArgs {
            resource: Some("storage".to_string()),
        }))
        .await?;

    let text = get_text(&res);
    assert!(text.contains("/dev/sda"));
    assert!(text.contains("/dev/nvme0n1"));
    Ok(())
}

#[tokio::test]
async fn test_get_system_filtered_products_returns_json_object() -> TestResult {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .get_system(Parameters(GetSystemArgs {
            resource: Some("products".to_string()),
        }))
        .await?;

    let text = get_text(&res);
    let parsed: serde_json::Value = serde_json::from_str(text)?;
    assert!(parsed.is_object());
    assert!(parsed["products"].is_array());
    assert_eq!(parsed["products"][0]["id"], "Tumbleweed");
    Ok(())
}

#[tokio::test]
async fn test_get_proposal_with_issues() -> TestResult {
    let backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().issues = vec![IssueWithScope {
        scope: Scope::Storage,
        issue: Issue::new("error", "Disk too small"),
    }];
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server.get_proposal().await?;
    assert_eq!(res.is_error, Some(true));
    let text = get_text(&res);
    assert!(text.contains("issues_detected"));
    assert!(text.contains("Disk too small"));
    Ok(())
}

#[tokio::test]
async fn test_get_proposal_while_computing() -> TestResult {
    let backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().status.stage = Stage::Configuring;
    backend_inner.state.lock().unwrap().status.tasks = vec![agama_utils::api::status::Task {
        id: 1,
        name: "storage_calc".to_string(),
        description: "Calculating storage proposal".to_string(),
        scope: Scope::Storage,
    }];
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server.get_proposal().await?;
    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("proposal_computing"));
    assert!(text.contains("storage_calc"));
    Ok(())
}

#[tokio::test]
async fn test_lifecycle_between_set_config_and_get_proposal() -> TestResult {
    ensure_test_schema();
    let backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().proposal = None;
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    // AI queries proposal before setting config -> proposal_pending
    let pending_res = server.get_proposal().await?;
    assert_eq!(pending_res.is_error, Some(false));
    let text = get_text(&pending_res);
    assert!(text.contains("proposal_pending"));
    assert!(text.contains("Ensure a product is configured"));

    // AI sends valid config with product
    let set_args = SetConfigArgs {
        config: json!({
            "product": { "id": "Tumbleweed" },
            "root": { "password": "nots3cr3t" }
        }),
    };
    let set_res = server.set_config(Parameters(set_args)).await?;
    assert_eq!(set_res.is_error, Some(false));

    // Background solvers/probes run
    backend.state.lock().unwrap().status.tasks = vec![agama_utils::api::status::Task {
        id: 10,
        name: "software_probe".to_string(),
        description: "Resolving packages and patterns for Tumbleweed".to_string(),
        scope: Scope::Software,
    }];

    let computing_res = server.get_proposal().await?;
    assert_eq!(computing_res.is_error, Some(false));
    let text = get_text(&computing_res);
    assert!(text.contains("proposal_computing"));
    assert!(text.contains("software_probe"));
    assert!(text.contains("Resolving packages and patterns"));

    // Background solvers finish
    backend.state.lock().unwrap().status.tasks.clear();
    backend.state.lock().unwrap().proposal = Some(sample_proposal());

    let ready_res = server.get_proposal().await?;
    assert_eq!(ready_res.is_error, Some(false));
    let text = get_text(&ready_res);
    assert!(text.contains("proposal_ready"));
    Ok(())
}

#[tokio::test]
async fn test_get_progress_reporting_with_pending_questions() -> TestResult {
    let backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().status.stage = Stage::Installing;
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server.get_progress().await?;
    let text = get_text(&res);
    assert!(text.contains("installing"));
    assert!(text.contains("\"hasPendingQuestions\": true"));
    assert!(text.contains("Cannot verify GPG signature"));
    Ok(())
}

#[tokio::test]
async fn test_get_logs_tool() -> TestResult {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .get_logs(Parameters(GetLogsArgs {
            log_type: Some("installer".to_string()),
            lines: Some(10),
        }))
        .await?;

    let text = get_text(&res);
    assert!(!text.is_empty());
    Ok(())
}

fn ensure_test_schema() {
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let schema_file = manifest_dir.join("../out/schemas/config.schema.json");
    if !schema_file.exists() {
        let root_dir = manifest_dir.join("..");
        let _ = std::process::Command::new("cargo")
            .args(["xtask", "openapi"])
            .current_dir(&root_dir)
            .status();
        assert!(
            schema_file.exists(),
            "Agama OpenAPI schema not found at {}. Please run 'cargo xtask openapi'.",
            schema_file.display()
        );
    }
}

#[tokio::test]
async fn test_set_config_valid() -> TestResult {
    ensure_test_schema();
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .set_config(Parameters(SetConfigArgs {
            config: json!({
                "product": { "id": "Tumbleweed" },
                "root": { "password": "nots3cr3t" }
            }),
        }))
        .await?;

    let text = get_text(&res);
    assert!(text.contains("Configuration profile replaced"));
    Ok(())
}

#[tokio::test]
async fn test_set_config_schema_violation_reports_tool_error() -> TestResult {
    ensure_test_schema();
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    // Invalid value for known enum
    let res = server
        .set_config(Parameters(SetConfigArgs {
            config: json!({
                "access": {
                    "ssh": "invalid_value"
                }
            }),
        }))
        .await?;

    assert_eq!(res.is_error, Some(true));
    let text = get_text(&res);
    assert!(text.contains("violates the Agama profile schema"));
    assert!(text.contains("access"));

    // Unrecognized section
    let res2 = server
        .set_config(Parameters(SetConfigArgs {
            config: json!({
                "unknown_section": {
                    "foo": "bar"
                }
            }),
        }))
        .await?;

    assert_eq!(res2.is_error, Some(true));
    let text2 = get_text(&res2);
    assert!(text2.contains("violates the Agama profile schema"));
    assert!(text2.contains("unknown_section"));
    Ok(())
}

#[tokio::test]
async fn test_set_config_invalid_json_reports_tool_error() -> TestResult {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    // Array instead of object
    let res = server
        .set_config(Parameters(SetConfigArgs {
            config: json!([1, 2, 3]),
        }))
        .await?;

    assert_eq!(res.is_error, Some(true));
    let text = get_text(&res);
    assert!(text.contains("Expected 'config' to be a JSON object"));

    // Malformed JSON string
    let res2 = server
        .set_config(Parameters(SetConfigArgs {
            config: json!("{ invalid_json }"),
        }))
        .await?;

    assert_eq!(res2.is_error, Some(true));
    let text2 = get_text(&res2);
    assert!(text2.contains("Invalid JSON syntax in 'config'"));
    Ok(())
}

#[tokio::test]
async fn test_set_config_pre_scripts_forbidden_in_config_mode() -> TestResult {
    ensure_test_schema();
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Config);

    let res = server
        .set_config(Parameters(SetConfigArgs {
            config: json!({
                "product": { "id": "Tumbleweed" },
                "scripts": {
                    "pre": [
                        { "name": "danger.sh", "content": "#!/bin/sh\nrm -rf /" }
                    ]
                }
            }),
        }))
        .await?;

    assert_eq!(res.is_error, Some(true));
    let text = get_text(&res);
    assert!(text.contains("Pre-installation scripts ('scripts.pre') are not permitted"));
    Ok(())
}

#[tokio::test]
async fn test_set_config_pre_scripts_allowed_in_full_mode() -> TestResult {
    ensure_test_schema();
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .set_config(Parameters(SetConfigArgs {
            config: json!({
                "product": { "id": "Tumbleweed" },
                "scripts": {
                    "pre": [
                        { "name": "setup.sh", "content": "#!/bin/sh\necho setup" }
                    ]
                }
            }),
        }))
        .await?;

    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("Configuration profile replaced"));
    Ok(())
}

#[tokio::test]
async fn test_get_questions_and_answer() -> TestResult {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    // 1. Query pending questions
    let res = server.get_questions().await?;
    let text = get_text(&res);
    assert!(text.contains("Cannot verify GPG signature"));

    // 2. Submit answer
    let ans_res = server
        .answer_question(Parameters(AnswerQuestionArgs {
            id: 1,
            action: "import".to_string(),
            value: None,
        }))
        .await?;
    let ans_text = get_text(&ans_res);
    assert!(ans_text.contains("Successfully answered question 1"));

    // Verify answer recorded on backend
    let state = backend.state.lock().unwrap();
    assert_eq!(state.answered_questions.len(), 1);
    assert_eq!(state.answered_questions[0].0, 1);
    assert_eq!(state.answered_questions[0].1, "import");
    drop(state);

    // 3. Pending questions now empty
    let res2 = server.get_questions().await?;
    let text2 = get_text(&res2);
    assert_eq!(text2.trim(), "[]");
    Ok(())
}

#[tokio::test]
async fn test_get_config_schema_overview() -> TestResult {
    ensure_test_schema();
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .get_config_schema(Parameters(GetConfigSchemaArgs { section: None }))
        .await?;

    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("Agama Installation Profile Schema"));
    assert!(text.contains("available_sections"));
    assert!(text.contains("storage"));
    assert!(text.contains("product"));
    assert!(text.contains("root"));
    assert!(text.contains("example_minimal_profile"));
    assert!(text.contains("Tumbleweed"));
    assert!(text.contains("nots3cr3t"));
    Ok(())
}

#[tokio::test]
async fn test_get_config_schema_section_access() -> TestResult {
    ensure_test_schema();
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .get_config_schema(Parameters(GetConfigSchemaArgs {
            section: Some("access".to_string()),
        }))
        .await?;

    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("access"));
    assert!(text.contains("ssh"));
    Ok(())
}

#[tokio::test]
async fn test_get_config_schema_unknown_section() -> TestResult {
    ensure_test_schema();
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .get_config_schema(Parameters(GetConfigSchemaArgs {
            section: Some("unknown_subsystem".to_string()),
        }))
        .await?;

    assert_eq!(res.is_error, Some(true));
    let text = get_text(&res);
    assert!(text.contains("Section 'unknown_subsystem' not found"));
    assert!(text.contains("Available sections"));
    Ok(())
}

#[tokio::test]
async fn test_wait_progress_returns_immediately_on_pending_question() -> TestResult {
    let backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().status.stage = Stage::Installing;
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(60),
        }))
        .await?;

    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("question_pending"));
    assert!(text.contains("hasPendingQuestions\": true"));
    Ok(())
}

#[tokio::test]
async fn test_wait_progress_returns_immediately_on_finished() -> TestResult {
    let backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().status.stage = Stage::Finished;
    backend_inner.state.lock().unwrap().questions.clear();
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(60),
        }))
        .await?;

    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("finished"));
    assert!(text.contains("Installation finished"));
    Ok(())
}

#[tokio::test]
async fn test_wait_progress_wakes_up_on_question_event() -> TestResult {
    let mut backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().status.stage = Stage::Installing;
    backend_inner.state.lock().unwrap().questions.clear();

    let (events_tx, _) = tokio::sync::broadcast::channel(16);
    backend_inner.events = Some(events_tx.clone());

    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    let backend_clone = backend.clone();
    let events_tx_clone = events_tx.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(50)).await;
        backend_clone
            .state
            .lock()
            .unwrap()
            .questions
            .push(sample_question());
        let _ = events_tx_clone.send(Event::QuestionAdded { id: 1 });
    });

    let start = std::time::Instant::now();
    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(30),
        }))
        .await?;

    assert!(start.elapsed() < Duration::from_secs(5));
    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("question_pending"));
    assert!(text.contains("Question 1 pending"));
    Ok(())
}

#[tokio::test]
async fn test_wait_progress_returns_immediately_on_configuring() -> TestResult {
    let backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().status.stage = Stage::Configuring;
    backend_inner.state.lock().unwrap().questions.clear();

    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(60),
        }))
        .await?;

    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("configuring"));
    assert!(text.contains("Ready for review"));
    assert!(text.contains("get_proposal"));
    assert!(text.contains("commit_install"));
    Ok(())
}

#[tokio::test]
async fn test_wait_progress_wakes_up_when_configuring_tasks_finish() -> TestResult {
    let mut backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().status.stage = Stage::Configuring;
    backend_inner.state.lock().unwrap().status.tasks = vec![agama_utils::api::status::Task {
        id: 5,
        name: "storage_calc".to_string(),
        description: "Computing storage proposal".to_string(),
        scope: Scope::Storage,
    }];
    backend_inner.state.lock().unwrap().questions.clear();

    let (events_tx, _) = tokio::sync::broadcast::channel(16);
    backend_inner.events = Some(events_tx.clone());

    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    let backend_clone = backend.clone();
    let events_tx_clone = events_tx.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(50)).await;
        let finished_task = backend_clone.state.lock().unwrap().status.tasks.remove(0);
        let _ = events_tx_clone.send(Event::TaskFinished {
            task: finished_task,
            remaining: 0,
        });
    });

    let start = std::time::Instant::now();
    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(30),
        }))
        .await?;

    assert!(start.elapsed() < Duration::from_secs(5));
    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("configuring"));
    assert!(text.contains("Ready for review"));
    assert!(text.contains("get_proposal"));
    assert!(text.contains("commit_install"));
    Ok(())
}

#[tokio::test]
async fn test_wait_progress_wakes_up_on_finished_event() -> TestResult {
    let mut backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().status.stage = Stage::Installing;
    backend_inner.state.lock().unwrap().questions.clear();

    let (events_tx, _) = tokio::sync::broadcast::channel(16);
    backend_inner.events = Some(events_tx.clone());

    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    let backend_clone = backend.clone();
    let events_tx_clone = events_tx.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(50)).await;
        backend_clone.state.lock().unwrap().status.stage = Stage::Finished;
        let _ = events_tx_clone.send(Event::StageChanged {
            stage: Stage::Finished,
        });
    });

    let start = std::time::Instant::now();
    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(30),
        }))
        .await?;

    assert!(start.elapsed() < Duration::from_secs(5));
    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("finished"));
    assert!(text.contains("Installation finished"));
    Ok(())
}

#[tokio::test]
async fn test_wait_progress_short_timeout_returns_progress() -> TestResult {
    let backend_inner = MockBackend::default();
    backend_inner.state.lock().unwrap().status.stage = Stage::Installing;
    backend_inner.state.lock().unwrap().questions.clear();

    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(1),
        }))
        .await?;

    assert_eq!(res.is_error, Some(false));
    let text = get_text(&res);
    assert!(text.contains("installing"));
    assert!(text.contains("Call 'wait_progress' to continue monitoring"));
    Ok(())
}
