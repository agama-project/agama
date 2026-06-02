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

//! TaskManager for executing async tasks with dependencies and metadata.
//!
//! This module provides a clean API for managing background tasks with:
//! - Required metadata (name and description)
//! - Optional tags for categorization
//! - Dependency management between tasks
//! - Event notifications via channels
//! - Task querying and filtering

use agama_utils::api::Scope;
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::sync::Arc;
use tokio::sync::{mpsc, Notify, RwLock};

/// Unique identifier for a task.
pub type TaskId = usize;

/// Error type for task execution.
///
/// This is a newtype wrapper around `Box<dyn Error + Send>` that provides a conversion
/// method for any error type that implements `Error + Send + 'static`.
///
/// Since Rust doesn't allow implementing `From<E>` for all error types (it conflicts with
/// the reflexive `From<T> for T`), this type provides the `from_error` constructor method
/// for explicit conversion.
///
/// Use `.map_err(TaskError::from_error)` to convert errors in task closures.
#[derive(Debug)]
pub struct TaskError(Box<dyn std::error::Error + Send>);

impl TaskError {
    /// Converts any error type into a TaskError.
    ///
    /// This method can be used with `.map_err()` to convert errors in task closures.
    pub fn from_error<E: std::error::Error + Send + 'static>(e: E) -> Self {
        TaskError(Box::new(e))
    }
}

impl std::fmt::Display for TaskError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for TaskError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.0.source()
    }
}

/// Result type returned by task execution.
///
/// Tasks return `Ok(())` on success or a [`TaskError`] on failure.
pub type TaskResult = Result<(), TaskError>;

/// Metadata describing a task.
///
/// Contains human-readable information about a task including its name,
/// description, and optional tags for categorization.
#[derive(Debug, Clone)]
pub struct TaskMetadata {
    /// Short name identifying the task (e.g., "backup-db")
    pub name: String,
    /// Human-readable description of what the task does
    pub description: String,
    /// Scope that originated the task
    pub scope: Scope,
    /// Tags for categorization and filtering
    pub tags: Vec<String>,
}

impl TaskMetadata {
    /// Create new task metadata with a name and description.
    pub fn new(name: impl Into<String>, scope: Scope, description: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            scope,
            description: description.into(),
            tags: Vec::new(),
        }
    }

    /// Add a tag to the metadata.
    ///
    /// Tags can be used to categorize tasks and filter them later.
    pub fn add_tag(&mut self, tag: impl Into<String>) {
        self.tags.push(tag.into());
    }
}

/// Events emitted by the task manager during task execution.
///
/// Subscribe to these events to monitor task progress and handle completions.
#[derive(Debug)]
pub enum TaskEvent {
    /// A task has started executing.
    ///
    /// Emitted after all dependencies have completed and the task begins work.
    Started {
        /// Unique identifier of the task
        id: TaskId,
        /// Metadata including name, description, and tags
        metadata: TaskMetadata,
    },
    /// A task has completed execution.
    ///
    /// Emitted when a task finishes, whether successful or failed.
    Completed {
        /// Unique identifier of the task
        id: TaskId,
        /// Metadata including name, description, and tags
        metadata: TaskMetadata,
        /// Result of the task execution
        result: TaskResult,
    },
}

struct TaskManagerState {
    completed: HashSet<TaskId>,
    next_id: TaskId,
    notify: Arc<Notify>,
    event_tx: mpsc::UnboundedSender<TaskEvent>,
    metadata: HashMap<TaskId, TaskMetadata>,
}

/// Manager for executing async tasks with dependencies.
///
/// `TaskManager` allows you to:
/// - Create tasks with metadata (name, description, tags)
/// - Define dependencies between tasks
/// - Execute tasks concurrently using tokio tasks
/// - Monitor task progress via events
/// - Query and filter completed tasks
///
/// # Thread Safety
///
/// `TaskManager` is `Clone` and can be shared across threads. All clones
/// share the same underlying state via `Arc`.
pub struct TaskManager {
    state: Arc<RwLock<TaskManagerState>>,
    event_rx: Arc<RwLock<Option<mpsc::UnboundedReceiver<TaskEvent>>>>,
}

/// Builder for configuring and running a task.
///
/// Created by [`TaskManager::task`]. Use this to add tags, dependencies,
/// and finally execute the task with [`run`](TaskBuilder::run).
pub struct TaskBuilder {
    manager: TaskManager,
    metadata: TaskMetadata,
    dependencies: Vec<TaskId>,
}

impl TaskManager {
    /// Create a new task manager.
    pub fn new() -> Self {
        let (event_tx, event_rx) = mpsc::unbounded_channel();

        let state = TaskManagerState {
            completed: HashSet::new(),
            next_id: 0,
            notify: Arc::new(Notify::new()),
            event_tx,
            metadata: HashMap::new(),
        };

        Self {
            state: Arc::new(RwLock::new(state)),
            event_rx: Arc::new(RwLock::new(Some(event_rx))),
        }
    }

    /// Start building a new task with name and description.
    ///
    /// Returns a [`TaskBuilder`] that can be configured with tags and dependencies
    /// before being executed with [`run`](TaskBuilder::run).
    ///
    /// # Arguments
    ///
    /// * `name` - Short identifier for the task (e.g., "backup-db")
    /// * `description` - Human-readable description of what the task does
    pub fn task(
        &self,
        name: impl Into<String>,
        scope: Scope,
        description: impl Into<String>,
    ) -> TaskBuilder {
        TaskBuilder {
            manager: self.clone(),
            metadata: TaskMetadata::new(name, scope, description),
            dependencies: Vec::new(),
        }
    }

    async fn next_id(&self) -> TaskId {
        let mut state = self.state.write().await;
        let id = state.next_id;
        state.next_id += 1;
        id
    }

    async fn spawn_task<F, Fut>(
        &self,
        task_id: TaskId,
        metadata: TaskMetadata,
        dependencies: Vec<TaskId>,
        work: F,
    ) where
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = TaskResult> + Send + 'static,
    {
        // Store metadata
        {
            let mut state = self.state.write().await;
            state.metadata.insert(task_id, metadata.clone());
        }

        let state = Arc::clone(&self.state);

        tokio::spawn(async move {
            let (notify, event_tx) = {
                let state_guard = state.read().await;
                (
                    Arc::clone(&state_guard.notify),
                    state_guard.event_tx.clone(),
                )
            };

            // Wait for dependencies
            loop {
                let is_ready = {
                    let state_guard = state.read().await;
                    dependencies
                        .iter()
                        .all(|dep| state_guard.completed.contains(dep))
                };

                if is_ready {
                    break;
                }

                notify.notified().await;
            }

            // Send started event
            let _ = event_tx.send(TaskEvent::Started {
                id: task_id,
                metadata: metadata.clone(),
            });

            // Execute work
            let result = work().await;

            // Send completed event
            let _ = event_tx.send(TaskEvent::Completed {
                id: task_id,
                metadata,
                result,
            });

            // Mark as completed
            let mut state_guard = state.write().await;
            state_guard.completed.insert(task_id);
            state_guard.notify.notify_waiters();
        });
    }

    /// Take ownership of the event receiver.
    ///
    /// Can only be called once. Returns `None` if already called.
    /// Use this to receive events from all tasks.
    pub async fn take_event_receiver(&self) -> Option<mpsc::UnboundedReceiver<TaskEvent>> {
        self.event_rx.write().await.take()
    }

    /// Check if a task has completed.
    ///
    /// Returns `true` if the task has finished executing (successfully or not).
    pub async fn is_task_completed(&self, task_id: TaskId) -> bool {
        let state = self.state.read().await;
        state.completed.contains(&task_id)
    }

    /// Get the number of completed tasks.
    pub async fn completed_count(&self) -> usize {
        let state = self.state.read().await;
        state.completed.len()
    }

    /// Get metadata for a specific task.
    ///
    /// Returns `None` if the task ID doesn't exist or hasn't been registered yet.
    pub async fn get_metadata(&self, task_id: TaskId) -> Option<TaskMetadata> {
        let state = self.state.read().await;
        state.metadata.get(&task_id).cloned()
    }

    /// Get metadata for all tasks.
    ///
    /// Returns a vector of `(TaskId, TaskMetadata)` tuples for all registered tasks.
    pub async fn get_all_metadata(&self) -> Vec<(TaskId, TaskMetadata)> {
        let state = self.state.read().await;
        state
            .metadata
            .iter()
            .map(|(id, meta)| (*id, meta.clone()))
            .collect()
    }

    /// Get all tasks that have a specific tag.
    ///
    /// Returns a vector of `(TaskId, TaskMetadata)` tuples for tasks
    /// that include the specified tag.
    pub async fn get_tasks_by_tag(&self, tag: &str) -> Vec<(TaskId, TaskMetadata)> {
        let state = self.state.read().await;
        state
            .metadata
            .iter()
            .filter(|(_, meta)| meta.tags.iter().any(|t| t == tag))
            .map(|(id, meta)| (*id, meta.clone()))
            .collect()
    }
}

impl Clone for TaskManager {
    fn clone(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
            event_rx: Arc::clone(&self.event_rx),
        }
    }
}

impl Default for TaskManager {
    fn default() -> Self {
        Self::new()
    }
}

impl TaskBuilder {
    /// Add a tag to the task.
    ///
    /// Tags can be used to categorize tasks and filter them later using
    /// [`TaskManager::get_tasks_by_tag`].
    pub fn tag(mut self, tag: impl Into<String>) -> Self {
        self.metadata.add_tag(tag);
        self
    }

    /// Add a dependency on another task.
    ///
    /// This task will not start executing until the specified task has completed.
    /// Multiple dependencies can be added by calling this method multiple times.
    pub fn depends_on(mut self, task_id: TaskId) -> Self {
        self.dependencies.push(task_id);
        self
    }

    /// Execute the task with the given work closure.
    ///
    /// Returns the [`TaskId`] of the spawned task. The task begins executing
    /// immediately if it has no dependencies, or waits for all dependencies
    /// to complete.
    ///
    /// # Type Parameters
    ///
    /// * `F` - Closure that returns a future
    /// * `Fut` - Future that resolves to [`TaskResult`]
    pub async fn run<F, Fut>(self, work: F) -> TaskId
    where
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = TaskResult> + Send + 'static,
    {
        let task_id = self.manager.next_id().await;
        self.manager
            .spawn_task(task_id, self.metadata, self.dependencies, work)
            .await;
        task_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_metadata_new() {
        let metadata = TaskMetadata::new("process-data", Scope::Manager, "Process user data");
        assert_eq!(metadata.name, "process-data");
        assert_eq!(metadata.scope, Scope::Manager);
        assert_eq!(metadata.description, "Process user data");
        assert!(metadata.tags.is_empty());
    }

    #[test]
    fn test_task_metadata_add_tag() {
        let mut metadata = TaskMetadata::new("backup", Scope::Storage, "Backup files");
        metadata.add_tag("storage");
        metadata.add_tag("critical");
        assert_eq!(metadata.tags, vec!["storage", "critical"]);
    }

    #[test]
    fn test_task_metadata_with_multiple_tags() {
        let mut metadata = TaskMetadata::new("backup-db", Scope::Manager, "Backup database to S3");
        metadata.add_tag("backup");
        metadata.add_tag("critical");

        assert_eq!(metadata.name, "backup-db");
        assert_eq!(metadata.description, "Backup database to S3");
        assert_eq!(metadata.scope, Scope::Manager);
        assert_eq!(metadata.tags, vec!["backup", "critical"]);
    }

    #[test]
    fn test_task_error_from_error() {
        use std::io;

        let io_error = io::Error::new(io::ErrorKind::NotFound, "file not found");
        let task_error = TaskError::from_error(io_error);

        assert_eq!(task_error.to_string(), "file not found");
    }

    #[test]
    fn test_task_error_display() {
        use std::io;

        let io_error = io::Error::new(io::ErrorKind::PermissionDenied, "access denied");
        let task_error = TaskError::from_error(io_error);

        let display_string = format!("{}", task_error);
        assert_eq!(display_string, "access denied");
    }
}
