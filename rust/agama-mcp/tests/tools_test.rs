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
use rmcp::model::ErrorCode;
use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

struct MockBackend {
    pub system_info: SystemInfo,
    pub proposal: Mutex<Option<Proposal>>,
    pub issues: Vec<IssueWithScope>,
    pub status: Mutex<Status>,
    pub install_committed: AtomicBool,
    pub reboot_called: AtomicBool,
    pub questions: Mutex<Vec<Question>>,
    pub answered_questions: Mutex<Vec<(u32, String, Option<String>)>>,
    pub events: Option<tokio::sync::broadcast::Sender<Event>>,
}

fn sample_system_info() -> SystemInfo {
    SystemInfo {
        manager: Default::default(),
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

impl Default for MockBackend {
    fn default() -> Self {
        Self {
            system_info: sample_system_info(),
            proposal: Mutex::new(Some(sample_proposal())),
            issues: Vec::new(),
            status: Mutex::new(Default::default()),
            install_committed: AtomicBool::new(false),
            reboot_called: AtomicBool::new(false),
            questions: Mutex::new(vec![sample_question()]),
            answered_questions: Mutex::new(Vec::new()),
            events: None,
        }
    }
}

#[async_trait]
impl McpBackend for MockBackend {
    async fn get_system(&self) -> Result<SystemInfo, BackendError> {
        Ok(self.system_info.clone())
    }

    async fn set_config(&self, _config: Config) -> Result<(), BackendError> {
        Ok(())
    }

    async fn get_proposal(&self) -> Result<Option<Proposal>, BackendError> {
        Ok(self.proposal.lock().unwrap().clone())
    }

    async fn get_issues(&self) -> Result<Vec<IssueWithScope>, BackendError> {
        Ok(self.issues.clone())
    }

    async fn commit_install(&self) -> Result<(), BackendError> {
        self.install_committed.store(true, Ordering::Release);
        Ok(())
    }

    async fn reboot(&self) -> Result<(), BackendError> {
        self.reboot_called.store(true, Ordering::Release);
        Ok(())
    }

    async fn get_progress(&self) -> Result<Status, BackendError> {
        Ok(self.status.lock().unwrap().clone())
    }

    async fn get_questions(&self) -> Result<Vec<Question>, BackendError> {
        Ok(self.questions.lock().unwrap().clone())
    }

    async fn answer_question(
        &self,
        id: u32,
        action: String,
        value: Option<String>,
    ) -> Result<(), BackendError> {
        let mut questions = self.questions.lock().unwrap();
        if let Some(q) = questions.iter_mut().find(|q| q.id == id) {
            q.answer = Some(QuestionAnswer {
                action: action.clone(),
                value: value.clone(),
            });
        }
        self.answered_questions
            .lock()
            .unwrap()
            .push((id, action, value));
        Ok(())
    }

    fn subscribe_events(&self) -> Option<agama_utils::api::event::Receiver> {
        self.events.as_ref().map(|tx| tx.subscribe())
    }
}

#[tokio::test]
async fn test_commit_install_forbidden_in_config_mode() {
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
    assert!(!backend.install_committed.load(Ordering::Acquire));
}

#[tokio::test]
async fn test_commit_install_allowed_in_full_mode() {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    let res = server
        .commit_install()
        .await
        .expect("Expected success in full mode");
    assert!(backend.install_committed.load(Ordering::Acquire));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("Installation committed and started"));
}

#[tokio::test]
async fn test_reboot_forbidden_in_config_mode() {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend.clone(), McpMode::Config);

    let err = server
        .reboot()
        .await
        .expect_err("Expected error in config mode");
    assert!(matches!(err, agama_mcp::Error::Forbidden));
    let mcp_err: rmcp::model::ErrorData = err.into();
    assert_eq!(mcp_err.code, ErrorCode(403));
    assert!(!backend.reboot_called.load(Ordering::Acquire));
}

#[tokio::test]
async fn test_reboot_blocked_during_installing() {
    let backend_inner = MockBackend::default();
    backend_inner.status.lock().unwrap().stage = Stage::Installing;
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    let res = server.reboot().await.unwrap();
    assert_eq!(res.is_error, Some(true));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("Cannot reboot while installation is in progress"));
    assert!(!backend.reboot_called.load(Ordering::Acquire));
}

#[tokio::test]
async fn test_reboot_success_when_finished() {
    let backend_inner = MockBackend::default();
    backend_inner.status.lock().unwrap().stage = Stage::Finished;
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    let res = server.reboot().await.unwrap();
    assert_eq!(res.is_error, Some(false));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("Reboot initiated"));
    assert!(text.contains("terminating"));
    assert!(backend.reboot_called.load(Ordering::Acquire));
}

#[tokio::test]
async fn test_get_system_filtered() {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .get_system(Parameters(GetSystemArgs {
            resource: Some("storage".to_string()),
        }))
        .await
        .unwrap();

    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("/dev/sda"));
    assert!(text.contains("/dev/nvme0n1"));
}

#[tokio::test]
async fn test_get_proposal_with_issues() {
    let mut backend_inner = MockBackend::default();
    backend_inner.issues = vec![IssueWithScope {
        scope: Scope::Storage,
        issue: Issue::new("error", "Disk too small"),
    }];
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server.get_proposal().await.unwrap();
    assert_eq!(res.is_error, Some(true));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("issues_detected"));
    assert!(text.contains("Disk too small"));
}

#[tokio::test]
async fn test_get_proposal_while_computing() {
    let backend_inner = MockBackend::default();
    backend_inner.status.lock().unwrap().stage = Stage::Configuring;
    backend_inner.status.lock().unwrap().tasks = vec![agama_utils::api::status::Task {
        id: 1,
        name: "storage_calc".to_string(),
        description: "Calculating storage proposal".to_string(),
        scope: Scope::Storage,
    }];
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server.get_proposal().await.unwrap();
    assert_eq!(res.is_error, Some(false));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("proposal_computing"));
    assert!(text.contains("storage_calc"));
}

#[tokio::test]
async fn test_lifecycle_between_set_config_and_get_proposal() {
    ensure_test_schema();
    let backend_inner = MockBackend::default();
    // 1. Pre-configuration state: no product or proposal yet
    *backend_inner.proposal.lock().unwrap() = None;
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    // AI queries proposal before setting config -> proposal_pending
    let pending_res = server.get_proposal().await.unwrap();
    assert_eq!(pending_res.is_error, Some(false));
    let text = &pending_res.content[0].as_text().unwrap().text;
    assert!(text.contains("proposal_pending"));
    assert!(text.contains("Ensure a product is configured"));

    // 2. AI sends valid config with product
    let set_args = SetConfigArgs {
        config: json!({
            "product": { "id": "Tumbleweed" },
            "root": { "password": "nots3cr3t" }
        }),
    };
    let set_res = server.set_config(Parameters(set_args)).await.unwrap();
    assert_eq!(set_res.is_error, Some(false));

    // 3. Agama starts solver and probing tasks in background
    backend.status.lock().unwrap().tasks = vec![agama_utils::api::status::Task {
        id: 10,
        name: "software_probe".to_string(),
        description: "Resolving packages and patterns for Tumbleweed".to_string(),
        scope: Scope::Software,
    }];

    // AI checks proposal while solvers are computing -> proposal_computing
    let computing_res = server.get_proposal().await.unwrap();
    assert_eq!(computing_res.is_error, Some(false));
    let text = &computing_res.content[0].as_text().unwrap().text;
    assert!(text.contains("proposal_computing"));
    assert!(text.contains("software_probe"));
    assert!(text.contains("Resolving packages and patterns"));

    // 4. Background solvers finish: tasks clear, calculated proposal is ready
    backend.status.lock().unwrap().tasks.clear();
    *backend.proposal.lock().unwrap() = Some(sample_proposal());

    // AI queries proposal now that calculation finished -> proposal_ready
    let ready_res = server.get_proposal().await.unwrap();
    assert_eq!(ready_res.is_error, Some(false));
    let text = &ready_res.content[0].as_text().unwrap().text;
    assert!(text.contains("proposal_ready"));
}

#[tokio::test]
async fn test_get_progress_reporting_with_pending_questions() {
    let backend_inner = MockBackend::default();
    backend_inner.status.lock().unwrap().stage = Stage::Installing;
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server.get_progress().await.unwrap();
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("installing"));
    assert!(text.contains("\"hasPendingQuestions\": true"));
    assert!(text.contains("Cannot verify GPG signature"));
}

#[tokio::test]
async fn test_get_logs_tool() {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .get_logs(Parameters(GetLogsArgs {
            log_type: Some("installer".to_string()),
            lines: Some(10),
        }))
        .await
        .unwrap();

    let text = &res.content[0].as_text().unwrap().text;
    assert!(!text.is_empty());
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
async fn test_set_config_valid() {
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
        .await
        .unwrap();

    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("Configuration profile replaced"));
}

#[tokio::test]
async fn test_set_config_schema_violation_reports_tool_error() {
    ensure_test_schema();
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    // 1. Invalid value for a known schema enum (access.ssh can only be "enabled" or "default")
    let res = server
        .set_config(Parameters(SetConfigArgs {
            config: json!({
                "access": {
                    "ssh": "invalid_value"
                }
            }),
        }))
        .await
        .unwrap();

    assert_eq!(res.is_error, Some(true));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("violates the Agama profile schema"));
    assert!(text.contains("access"));

    // 2. Unrecognized section at root (Profile schema specifies additionalProperties: false)
    let res2 = server
        .set_config(Parameters(SetConfigArgs {
            config: json!({
                "unknown_section": {
                    "foo": "bar"
                }
            }),
        }))
        .await
        .unwrap();

    assert_eq!(res2.is_error, Some(true));
    let text2 = &res2.content[0].as_text().unwrap().text;
    assert!(text2.contains("violates the Agama profile schema"));
    assert!(text2.contains("unknown_section"));
}

#[tokio::test]
async fn test_set_config_invalid_json_reports_tool_error() {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    // 1. Not an object (e.g. array)
    let res = server
        .set_config(Parameters(SetConfigArgs {
            config: json!([1, 2, 3]),
        }))
        .await
        .unwrap();

    assert_eq!(res.is_error, Some(true));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("Expected 'config' to be a JSON object"));

    // 2. Malformed JSON string
    let res2 = server
        .set_config(Parameters(SetConfigArgs {
            config: json!("{ invalid_json }"),
        }))
        .await
        .unwrap();

    assert_eq!(res2.is_error, Some(true));
    let text2 = &res2.content[0].as_text().unwrap().text;
    assert!(text2.contains("Invalid JSON syntax in 'config'"));
}

#[tokio::test]
async fn test_get_questions_and_answer() {
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    // 1. Query pending questions
    let res = server.get_questions().await.unwrap();
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("Cannot verify GPG signature"));

    // 2. Submit answer
    let ans_res = server
        .answer_question(Parameters(AnswerQuestionArgs {
            id: 1,
            action: "import".to_string(),
            value: None,
        }))
        .await
        .unwrap();
    let ans_text = &ans_res.content[0].as_text().unwrap().text;
    assert!(ans_text.contains("Successfully answered question 1"));

    // Verify answer recorded on backend
    let answered = backend.answered_questions.lock().unwrap();
    assert_eq!(answered.len(), 1);
    assert_eq!(answered[0].0, 1);
    assert_eq!(answered[0].1, "import");

    // 3. Pending questions now empty
    let res2 = server.get_questions().await.unwrap();
    let text2 = &res2.content[0].as_text().unwrap().text;
    assert_eq!(text2.trim(), "[]");
}

#[tokio::test]
async fn test_get_config_schema_overview() {
    ensure_test_schema();
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .get_config_schema(Parameters(GetConfigSchemaArgs { section: None }))
        .await
        .unwrap();

    assert_eq!(res.is_error, Some(false));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("Agama Installation Profile Schema"));
    assert!(text.contains("available_sections"));
    assert!(text.contains("storage"));
    assert!(text.contains("product"));
    assert!(text.contains("root"));
    assert!(text.contains("example_minimal_profile"));
    assert!(text.contains("Tumbleweed"));
    assert!(text.contains("nots3cr3t"));
}

#[tokio::test]
async fn test_get_config_schema_section_access() {
    ensure_test_schema();
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .get_config_schema(Parameters(GetConfigSchemaArgs {
            section: Some("access".to_string()),
        }))
        .await
        .unwrap();

    assert_eq!(res.is_error, Some(false));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("access"));
    assert!(text.contains("ssh"));
}

#[tokio::test]
async fn test_get_config_schema_unknown_section() {
    ensure_test_schema();
    let backend = Arc::new(MockBackend::default());
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .get_config_schema(Parameters(GetConfigSchemaArgs {
            section: Some("unknown_subsystem".to_string()),
        }))
        .await
        .unwrap();

    assert_eq!(res.is_error, Some(true));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("Section 'unknown_subsystem' not found"));
    assert!(text.contains("Available sections"));
}

#[tokio::test]
async fn test_wait_progress_returns_immediately_on_pending_question() {
    let backend_inner = MockBackend::default();
    backend_inner.status.lock().unwrap().stage = Stage::Installing;
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    // Question is pending -> should return immediately without waiting for timeout
    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(60),
        }))
        .await
        .unwrap();

    assert_eq!(res.is_error, Some(false));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("question_pending"));
    assert!(text.contains("hasPendingQuestions\": true"));
}

#[tokio::test]
async fn test_wait_progress_returns_immediately_on_finished() {
    let backend_inner = MockBackend::default();
    backend_inner.status.lock().unwrap().stage = Stage::Finished;
    backend_inner.questions.lock().unwrap().clear();
    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(60),
        }))
        .await
        .unwrap();

    assert_eq!(res.is_error, Some(false));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("finished"));
    assert!(text.contains("Installation finished"));
}

#[tokio::test]
async fn test_wait_progress_wakes_up_on_question_event() {
    let mut backend_inner = MockBackend::default();
    backend_inner.status.lock().unwrap().stage = Stage::Installing;
    backend_inner.questions.lock().unwrap().clear();

    let (events_tx, _) = tokio::sync::broadcast::channel(16);
    backend_inner.events = Some(events_tx.clone());

    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    // Background task: inject question after 50ms and broadcast QuestionAdded event
    let backend_clone = backend.clone();
    let events_tx_clone = events_tx.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(50)).await;
        backend_clone.questions.lock().unwrap().push(sample_question());
        let _ = events_tx_clone.send(Event::QuestionAdded { id: 1 });
    });

    let start = std::time::Instant::now();
    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(30),
        }))
        .await
        .unwrap();

    // Must return within ~1-2 seconds, not wait for the full 30s timeout
    assert!(start.elapsed() < Duration::from_secs(5));
    assert_eq!(res.is_error, Some(false));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("question_pending"));
    assert!(text.contains("Question 1 pending"));
}

#[tokio::test]
async fn test_wait_progress_returns_immediately_on_configuring() {
    let backend_inner = MockBackend::default();
    backend_inner.status.lock().unwrap().stage = Stage::Configuring;
    backend_inner.questions.lock().unwrap().clear();

    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(60),
        }))
        .await
        .unwrap();

    assert_eq!(res.is_error, Some(false));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("configuring"));
    assert!(text.contains("Ready for review"));
    assert!(text.contains("get_proposal"));
    assert!(text.contains("commit_install"));
}

#[tokio::test]
async fn test_wait_progress_wakes_up_when_configuring_tasks_finish() {
    let mut backend_inner = MockBackend::default();
    backend_inner.status.lock().unwrap().stage = Stage::Configuring;
    backend_inner.status.lock().unwrap().tasks = vec![agama_utils::api::status::Task {
        id: 5,
        name: "storage_calc".to_string(),
        description: "Computing storage proposal".to_string(),
        scope: Scope::Storage,
    }];
    backend_inner.questions.lock().unwrap().clear();

    let (events_tx, _) = tokio::sync::broadcast::channel(16);
    backend_inner.events = Some(events_tx.clone());

    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    let backend_clone = backend.clone();
    let events_tx_clone = events_tx.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(50)).await;
        // Solvers finish: clear tasks and emit TaskFinished with remaining: 0
        let finished_task = backend_clone.status.lock().unwrap().tasks.remove(0);
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
        .await
        .unwrap();

    assert!(start.elapsed() < Duration::from_secs(5));
    assert_eq!(res.is_error, Some(false));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("configuring"));
    assert!(text.contains("Ready for review"));
    assert!(text.contains("get_proposal"));
    assert!(text.contains("commit_install"));
}

#[tokio::test]
async fn test_wait_progress_wakes_up_on_finished_event() {
    let mut backend_inner = MockBackend::default();
    backend_inner.status.lock().unwrap().stage = Stage::Installing;
    backend_inner.questions.lock().unwrap().clear();

    let (events_tx, _) = tokio::sync::broadcast::channel(16);
    backend_inner.events = Some(events_tx.clone());

    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend.clone(), McpMode::Full);

    let backend_clone = backend.clone();
    let events_tx_clone = events_tx.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(50)).await;
        backend_clone.status.lock().unwrap().stage = Stage::Finished;
        let _ = events_tx_clone.send(Event::StageChanged {
            stage: Stage::Finished,
        });
    });

    let start = std::time::Instant::now();
    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(30),
        }))
        .await
        .unwrap();

    assert!(start.elapsed() < Duration::from_secs(5));
    assert_eq!(res.is_error, Some(false));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("finished"));
    assert!(text.contains("Installation finished"));
}

#[tokio::test]
async fn test_wait_progress_short_timeout_returns_progress() {
    let backend_inner = MockBackend::default();
    backend_inner.status.lock().unwrap().stage = Stage::Installing;
    backend_inner.questions.lock().unwrap().clear();

    let backend = Arc::new(backend_inner);
    let server = McpServer::with_backend(backend, McpMode::Full);

    let res = server
        .wait_progress(Parameters(WaitProgressArgs {
            timeout_seconds: Some(1),
        }))
        .await
        .unwrap();

    assert_eq!(res.is_error, Some(false));
    let text = &res.content[0].as_text().unwrap().text;
    assert!(text.contains("installing"));
    assert!(text.contains("Call 'wait_progress' to continue monitoring"));
}
