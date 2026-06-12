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
//! - Dependency management between tasks
//! - Event notifications via channels

use agama_utils::api::{
    self,
    event::{self, Event},
    Scope,
};
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::sync::Arc;
use tokio::sync::{Notify, RwLock};

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
/// Contains human-readable information about a task including its name and description.
/// The actual task is a closure passed to [`TaskBuilder::run`].
#[derive(Debug, Clone)]
pub struct TaskMetadata {
    /// Id of the task.
    pub id: TaskId,
    /// Short name identifying the task (e.g., "backup-db").
    pub name: String,
    /// Short and human-readable description of what the task does. It should
    /// be translatable.
    pub description: String,
    /// Scope that originated the task.
    pub scope: Scope,
}

impl TaskMetadata {
    /// Create new task metadata with a name and description.
    pub fn new(
        id: TaskId,
        name: impl Into<String>,
        scope: Scope,
        description: impl Into<String>,
    ) -> Self {
        Self {
            id,
            name: name.into(),
            scope,
            description: description.into(),
        }
    }
}

impl From<TaskMetadata> for api::status::Task {
    fn from(value: TaskMetadata) -> Self {
        Self {
            id: value.id,
            name: value.name,
            description: value.description,
            scope: value.scope,
        }
    }
}

/// Holds the TaskManager state.
struct TaskManagerState {
    /// Set of completed tasks.
    completed: HashSet<TaskId>,
    /// First free ID for a new task
    next_id: TaskId,
    /// Notification mechanism provided by Tokio.
    notify: Arc<Notify>,
    /// Tasks metadata, include task ID, name, description, etc.
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
    events: event::Sender,
}

/// Builder for configuring and running a task.
///
/// Created by [`TaskManager::task`]. Use this to add tags, dependencies,
/// and finally execute the task with [`run`](TaskBuilder::run).
pub struct TaskBuilder {
    manager: TaskManager,
    name: String,
    scope: Scope,
    description: String,
    dependencies: Vec<TaskId>,
}

impl TaskManager {
    /// Create a new task manager.
    pub fn new(events: event::Sender) -> Self {
        let state = TaskManagerState {
            completed: HashSet::new(),
            next_id: 0,
            notify: Arc::new(Notify::new()),
            metadata: HashMap::new(),
        };

        Self {
            state: Arc::new(RwLock::new(state)),
            events,
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
            name: name.into(),
            scope,
            description: description.into(),
            dependencies: Vec::new(),
        }
    }

    async fn next_id(&self) -> TaskId {
        let mut state = self.state.write().await;
        let id = state.next_id;
        state.next_id += 1;
        id
    }

    async fn spawn_task<F, Fut>(&self, metadata: TaskMetadata, dependencies: Vec<TaskId>, work: F)
    where
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = TaskResult> + Send + 'static,
    {
        let task_id = metadata.id;

        // Store metadata
        {
            let mut state = self.state.write().await;
            state.metadata.insert(task_id, metadata.clone());
        }

        if let Err(e) = self.events.send(Event::TaskAdded {
            task: metadata.clone().into(),
        }) {
            tracing::warn!("Failed to send TaskAdded event: {}", e);
        }

        let state = Arc::clone(&self.state);
        let events = self.events.clone();

        tokio::spawn(async move {
            let notify = {
                let state_guard = state.read().await;
                Arc::clone(&state_guard.notify)
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

            if let Err(e) = events.send(Event::TaskStarted {
                task: metadata.clone().into(),
            }) {
                tracing::warn!("Failed to send TaskStarted event: {}", e);
            }

            if let Err(e) = work().await {
                tracing::error!("Task '{}' failed: {}", metadata.name, e);
            }

            // Mark as completed
            let mut state_guard = state.write().await;
            state_guard.completed.insert(task_id);
            state_guard.notify.notify_waiters();

            state_guard.metadata.remove(&task_id);

            if let Err(e) = events.send(Event::TaskFinished {
                task: metadata.clone().into(),
                remaining: state_guard.metadata.len(),
            }) {
                tracing::warn!("Failed to send TaskFinished event: {}", e);
            }
        });
    }

    /// Get metadata for all tasks.
    ///
    /// Returns a vector of `TaskMetadata` for all registered tasks.
    pub async fn get_all_metadata(&self) -> Vec<TaskMetadata> {
        let state = self.state.read().await;
        state.metadata.values().cloned().collect()
    }
}

impl Clone for TaskManager {
    fn clone(&self) -> Self {
        Self {
            state: Arc::clone(&self.state),
            events: self.events.clone(),
        }
    }
}

impl TaskBuilder {
    /// Add dependencies on other tasks.
    ///
    /// This task will not start executing until all specified tasks have completed.
    /// Accepts a slice of TaskIds to add multiple dependencies at once.
    pub fn depends_on(mut self, task_ids: &[TaskId]) -> Self {
        self.dependencies.extend_from_slice(task_ids);
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
        let metadata = TaskMetadata::new(task_id, self.name, self.scope, self.description);
        self.manager
            .spawn_task(metadata, self.dependencies, work)
            .await;
        task_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    struct Context {
        manager: TaskManager,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let (events_tx, mut events_rx) = broadcast::channel::<Event>(16);

            tokio::spawn(async move {
                while let Ok(event) = events_rx.recv().await {
                    println!("{:?}", event);
                }
            });

            let manager = TaskManager::new(events_tx);
            Context { manager }
        }

        async fn teardown(self) {
            // Nothing to tear down
        }
    }

    #[test]
    fn test_task_metadata_new() {
        let metadata = TaskMetadata::new(42, "process-data", Scope::Manager, "Process user data");
        assert_eq!(metadata.id, 42);
        assert_eq!(metadata.name, "process-data");
        assert_eq!(metadata.scope, Scope::Manager);
        assert_eq!(metadata.description, "Process user data");
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

    #[test_context(Context)]
    #[tokio::test]
    async fn test_depends_on_multiple_tasks(ctx: &mut Context) {
        let builder = ctx.manager.task("test", Scope::Manager, "Test task");

        // Test that depends_on accepts a slice
        let builder_with_deps = builder.depends_on(&[1, 2, 3]);

        assert_eq!(builder_with_deps.dependencies, vec![1, 2, 3]);
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_depends_on_empty_slice(ctx: &mut Context) {
        let builder = ctx.manager.task("test", Scope::Manager, "Test task");

        // Test that depends_on works with empty slice
        let builder_with_deps = builder.depends_on(&[]);

        assert!(builder_with_deps.dependencies.is_empty());
    }
}
