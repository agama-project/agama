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
//!
//! # Example
//!
//! ```no_run
//! use tasks::manager::{TaskManager, TaskEvent};
//! use tokio::time::{sleep, Duration};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let manager = TaskManager::new();
//!     let mut events = manager.take_event_receiver().await.unwrap();
//!
//!     // Spawn event handler
//!     tokio::spawn(async move {
//!         while let Some(event) = events.recv().await {
//!             match event {
//!                 TaskEvent::Started { id, metadata } => {
//!                     println!("Task {} started: {}", id, metadata.name);
//!                 }
//!                 TaskEvent::Completed { id, result, .. } => {
//!                     println!("Task {} completed: {:?}", id, result);
//!                 }
//!             }
//!         }
//!     });
//!
//!     // Create tasks with dependencies
//!     let download = manager
//!         .task("download", "Download data from API")
//!         .tag("network")
//!         .run(|| async {
//!             sleep(Duration::from_millis(100)).await;
//!             Ok(())
//!         })
//!         .await;
//!
//!     let process = manager
//!         .task("process", "Process downloaded data")
//!         .tag("processing")
//!         .depends_on(download)
//!         .run(|| async {
//!             sleep(Duration::from_millis(100)).await;
//!             Ok(())
//!         })
//!         .await;
//!
//!     // Query tasks by tag
//!     sleep(Duration::from_millis(300)).await;
//!     let network_tasks = manager.get_tasks_by_tag("network").await;
//!     println!("Found {} network tasks", network_tasks.len());
//!
//!     Ok(())
//! }
//! ```

use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use tokio::sync::{mpsc, Notify, RwLock};

/// Unique identifier for a task.
pub type TaskId = usize;

/// Result type returned by task execution.
///
/// Tasks return `Ok(())` on success or an error boxed as `Box<dyn Error + Send>`.
pub type TaskResult = Result<(), Box<dyn std::error::Error + Send>>;

/// Helper to convert any error into a TaskResult error.
///
/// This function boxes an error and casts it to the trait object type required by TaskResult.
/// Use this to avoid verbose `.map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)`
/// expressions in task closures.
///
/// # Example
///
/// ```ignore
/// task_manager
///     .task("example", "Example task")
///     .run(|| async move {
///         some_operation()
///             .await
///             .map_err(task_error)
///     })
///     .await;
/// ```
pub fn task_error<E: std::error::Error + Send + 'static>(
    e: E,
) -> Box<dyn std::error::Error + Send> {
    Box::new(e)
}

type BoxFuture = Pin<Box<dyn Future<Output = TaskResult> + Send>>;

/// Metadata describing a task.
///
/// Contains human-readable information about a task including its name,
/// description, and optional tags for categorization.
///
/// # Example
///
/// ```
/// use tasks::manager::TaskMetadata;
///
/// let mut metadata = TaskMetadata::new("backup-db", "Backup database to S3");
/// metadata.add_tag("backup");
/// metadata.add_tag("critical");
///
/// assert_eq!(metadata.name, "backup-db");
/// assert_eq!(metadata.description, "Backup database to S3");
/// assert_eq!(metadata.tags, vec!["backup", "critical"]);
/// ```
#[derive(Debug, Clone)]
pub struct TaskMetadata {
    /// Short name identifying the task (e.g., "backup-db")
    pub name: String,
    /// Human-readable description of what the task does
    pub description: String,
    /// Tags for categorization and filtering
    pub tags: Vec<String>,
}

impl TaskMetadata {
    /// Create new task metadata with a name and description.
    ///
    /// # Example
    ///
    /// ```
    /// use tasks::manager::TaskMetadata;
    ///
    /// let metadata = TaskMetadata::new("process-data", "Process user data");
    /// assert_eq!(metadata.name, "process-data");
    /// assert_eq!(metadata.description, "Process user data");
    /// assert!(metadata.tags.is_empty());
    /// ```
    pub fn new(name: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            tags: Vec::new(),
        }
    }

    /// Add a tag to the metadata.
    ///
    /// Tags can be used to categorize tasks and filter them later.
    ///
    /// # Example
    ///
    /// ```
    /// use tasks::manager::TaskMetadata;
    ///
    /// let mut metadata = TaskMetadata::new("backup", "Backup files");
    /// metadata.add_tag("storage");
    /// metadata.add_tag("critical");
    /// assert_eq!(metadata.tags, vec!["storage", "critical"]);
    /// ```
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
///
/// # Example
///
/// ```no_run
/// use tasks::manager::{TaskManager, TaskEvent};
///
/// #[tokio::main]
/// async fn main() {
///     let manager = TaskManager::new();
///     let mut events = manager.take_event_receiver().await.unwrap();
///
///     // Handle events
///     tokio::spawn(async move {
///         while let Some(event) = events.recv().await {
///             // Process event
///         }
///     });
///
///     // Create task
///     let task_id = manager
///         .task("my-task", "Description of my task")
///         .tag("important")
///         .run(|| async { Ok(()) })
///         .await;
/// }
/// ```
pub struct TaskManager {
    state: Arc<RwLock<TaskManagerState>>,
    event_rx: Arc<RwLock<Option<mpsc::UnboundedReceiver<TaskEvent>>>>,
}

/// Builder for configuring and running a task.
///
/// Created by [`TaskManager::task`]. Use this to add tags, dependencies,
/// and finally execute the task with [`run`](TaskBuilder::run).
///
/// # Example
///
/// ```no_run
/// use tasks::manager::TaskManager;
///
/// #[tokio::main]
/// async fn main() {
///     let manager = TaskManager::new();
///
///     let task_id = manager
///         .task("process", "Process data")
///         .tag("processing")
///         .tag("high-priority")
///         .run(|| async { Ok(()) })
///         .await;
/// }
/// ```
pub struct TaskBuilder {
    manager: TaskManager,
    metadata: TaskMetadata,
    dependencies: Vec<TaskId>,
}

impl TaskManager {
    /// Create a new task manager.
    ///
    /// # Example
    ///
    /// ```
    /// use tasks::manager::TaskManager;
    ///
    /// let manager = TaskManager::new();
    /// ```
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
    ///
    /// # Example
    ///
    /// ```no_run
    /// use tasks::manager::TaskManager;
    ///
    /// #[tokio::main]
    /// async fn main() {
    ///     let manager = TaskManager::new();
    ///
    ///     let task = manager
    ///         .task("backup", "Backup database to S3")
    ///         .tag("backup")
    ///         .run(|| async { Ok(()) })
    ///         .await;
    /// }
    /// ```
    pub fn task(&self, name: impl Into<String>, description: impl Into<String>) -> TaskBuilder {
        TaskBuilder {
            manager: self.clone(),
            metadata: TaskMetadata::new(name, description),
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
    ///
    /// # Example
    ///
    /// ```no_run
    /// use tasks::manager::{TaskManager, TaskEvent};
    ///
    /// #[tokio::main]
    /// async fn main() {
    ///     let manager = TaskManager::new();
    ///     let mut events = manager.take_event_receiver().await.unwrap();
    ///
    ///     tokio::spawn(async move {
    ///         while let Some(event) = events.recv().await {
    ///             match event {
    ///                 TaskEvent::Started { id, metadata } => {
    ///                     println!("Task {}: {}", id, metadata.name);
    ///                 }
    ///                 TaskEvent::Completed { id, result, .. } => {
    ///                     println!("Task {} done: {:?}", id, result);
    ///                 }
    ///             }
    ///         }
    ///     });
    /// }
    /// ```
    pub async fn take_event_receiver(&self) -> Option<mpsc::UnboundedReceiver<TaskEvent>> {
        self.event_rx.write().await.take()
    }

    /// Check if a task has completed.
    ///
    /// Returns `true` if the task has finished executing (successfully or not).
    ///
    /// # Example
    ///
    /// ```no_run
    /// use tasks::manager::TaskManager;
    ///
    /// #[tokio::main]
    /// async fn main() {
    ///     let manager = TaskManager::new();
    ///     let task_id = manager
    ///         .task("test", "Test task")
    ///         .run(|| async { Ok(()) })
    ///         .await;
    ///
    ///     tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    ///
    ///     if manager.is_task_completed(task_id).await {
    ///         println!("Task completed!");
    ///     }
    /// }
    /// ```
    pub async fn is_task_completed(&self, task_id: TaskId) -> bool {
        let state = self.state.read().await;
        state.completed.contains(&task_id)
    }

    /// Get the number of completed tasks.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use tasks::manager::TaskManager;
    ///
    /// #[tokio::main]
    /// async fn main() {
    ///     let manager = TaskManager::new();
    ///     // ... create and run tasks ...
    ///
    ///     let count = manager.completed_count().await;
    ///     println!("Completed {} tasks", count);
    /// }
    /// ```
    pub async fn completed_count(&self) -> usize {
        let state = self.state.read().await;
        state.completed.len()
    }

    /// Get metadata for a specific task.
    ///
    /// Returns `None` if the task ID doesn't exist or hasn't been registered yet.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use tasks::manager::TaskManager;
    ///
    /// #[tokio::main]
    /// async fn main() {
    ///     let manager = TaskManager::new();
    ///     let task_id = manager
    ///         .task("backup", "Backup database")
    ///         .run(|| async { Ok(()) })
    ///         .await;
    ///
    ///     if let Some(metadata) = manager.get_metadata(task_id).await {
    ///         println!("Task: {} - {}", metadata.name, metadata.description);
    ///     }
    /// }
    /// ```
    pub async fn get_metadata(&self, task_id: TaskId) -> Option<TaskMetadata> {
        let state = self.state.read().await;
        state.metadata.get(&task_id).cloned()
    }

    /// Get metadata for all tasks.
    ///
    /// Returns a vector of `(TaskId, TaskMetadata)` tuples for all registered tasks.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use tasks::manager::TaskManager;
    ///
    /// #[tokio::main]
    /// async fn main() {
    ///     let manager = TaskManager::new();
    ///     // ... create tasks ...
    ///
    ///     for (id, metadata) in manager.get_all_metadata().await {
    ///         println!("[{}] {}: {}", id, metadata.name, metadata.description);
    ///     }
    /// }
    /// ```
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
    ///
    /// # Example
    ///
    /// ```no_run
    /// use tasks::manager::TaskManager;
    ///
    /// #[tokio::main]
    /// async fn main() {
    ///     let manager = TaskManager::new();
    ///
    ///     manager
    ///         .task("backup-db", "Backup database")
    ///         .tag("backup")
    ///         .tag("critical")
    ///         .run(|| async { Ok(()) })
    ///         .await;
    ///
    ///     // Find all critical tasks
    ///     for (id, metadata) in manager.get_tasks_by_tag("critical").await {
    ///         println!("Critical: {} - {}", metadata.name, metadata.description);
    ///     }
    /// }
    /// ```
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
    ///
    /// # Example
    ///
    /// ```no_run
    /// use tasks::manager::TaskManager;
    ///
    /// #[tokio::main]
    /// async fn main() {
    ///     let manager = TaskManager::new();
    ///
    ///     manager
    ///         .task("process", "Process data")
    ///         .tag("processing")
    ///         .tag("high-priority")
    ///         .tag("batch")
    ///         .run(|| async { Ok(()) })
    ///         .await;
    /// }
    /// ```
    pub fn tag(mut self, tag: impl Into<String>) -> Self {
        self.metadata.add_tag(tag);
        self
    }

    /// Add a dependency on another task.
    ///
    /// This task will not start executing until the specified task has completed.
    /// Multiple dependencies can be added by calling this method multiple times.
    ///
    /// # Example
    ///
    /// ```no_run
    /// use tasks::manager::TaskManager;
    ///
    /// #[tokio::main]
    /// async fn main() {
    ///     let manager = TaskManager::new();
    ///
    ///     let download = manager
    ///         .task("download", "Download data")
    ///         .run(|| async { Ok(()) })
    ///         .await;
    ///
    ///     let process = manager
    ///         .task("process", "Process data")
    ///         .depends_on(download)  // Wait for download to complete
    ///         .run(|| async { Ok(()) })
    ///         .await;
    /// }
    /// ```
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
    ///
    /// # Example
    ///
    /// ```no_run
    /// use tasks::manager::TaskManager;
    ///
    /// #[tokio::main]
    /// async fn main() {
    ///     let manager = TaskManager::new();
    ///
    ///     let task_id = manager
    ///         .task("work", "Do some work")
    ///         .run(|| async {
    ///             // Perform work here
    ///             println!("Working...");
    ///             Ok(())
    ///         })
    ///         .await;
    ///
    ///     println!("Spawned task {}", task_id);
    /// }
    /// ```
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
