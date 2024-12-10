// Copyright (c) [2024] SUSE LLC
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

//! Implements logic to keep track of the status of a service.
//!
//! This behavior can be reused by different services, e.g., the
//! [software service](crate::software_ng::SoftwareService).
use crate::web::{Event, EventsSender};
use agama_lib::progress::{Progress, ProgressSequence, ProgressSummary};
use tokio::sync::{
    mpsc,
    oneshot::{self, error::RecvError},
};

#[derive(thiserror::Error, Debug)]
pub enum ServiceStatusError {
    #[error("The service is busy")]
    Busy,
    #[error("Could not send the message: {0}")]
    SendError(#[from] mpsc::error::SendError<Action>),
    #[error("Could not receive message: {0}")]
    RecvError(#[from] RecvError),
}

/// Actions related to service status management.
pub enum Action {
    Start(Vec<String>, oneshot::Sender<Result<(), ServiceStatusError>>),
    NextStep,
    Finish,
    GetProgress(oneshot::Sender<Option<ProgressSummary>>),
}

type ActionReceiver = mpsc::UnboundedReceiver<Action>;
type ActionSender = mpsc::UnboundedSender<Action>;

// TODO: somehow duplicated from agama-server/web/common.rs
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ServiceStatus {
    Idle = 0,
    Busy = 1,
}

/// Builds and starts a service status server.
///
/// See the [SoftwareService::start](crate::sfotware_ng::SoftwareService::start) method for an
/// example.
pub struct ServiceStatusManager {}

impl ServiceStatusManager {
    /// Starts a service status manager for the given service.
    ///
    /// * `name`: service name.
    /// * `events`: channel to send events (e.g., status changes and progress updates).
    pub fn start(name: &str, events: EventsSender) -> ServiceStatusClient {
        let (sender, receiver) = mpsc::unbounded_channel();
        let server = ServiceStatusServer {
            name: name.to_string(),
            events,
            progress: None,
            // NOTE: would it be OK to derive the status from the progress
            status: ServiceStatus::Idle,
            receiver,
            sender,
        };

        server.start()
    }
}

/// Client to interact with the service status manager.
///
/// It uses a channel to send the actions to the server. It can be cloned and used in different
/// tasks if needed.
#[derive(Clone)]
pub struct ServiceStatusClient(ActionSender);

impl ServiceStatusClient {
    /// Starts a new long-running task.
    pub async fn start_task(&self, steps: Vec<String>) -> Result<(), ServiceStatusError> {
        let (tx, rx) = oneshot::channel();
        self.0.send(Action::Start(steps, tx))?;
        rx.await?
    }

    /// Moves to the next step of the current long-running task.
    pub fn next_step(&self) -> Result<(), ServiceStatusError> {
        self.0.send(Action::NextStep)?;
        Ok(())
    }

    /// Finishes the current long-running task.
    pub fn finish_task(&self) -> Result<(), ServiceStatusError> {
        self.0.send(Action::Finish)?;
        Ok(())
    }

    /// Get the current progress information.
    pub async fn get_progress(&self) -> Result<Option<ProgressSummary>, ServiceStatusError> {
        let (tx, rx) = oneshot::channel();
        self.0.send(Action::GetProgress(tx)).unwrap();
        Ok(rx.await?)
    }
}

/// Keeps track of the status of a service.
///
/// It holds the progress sequence and the service status. Additionally, it emits
/// events when any of them change.
#[derive(Debug)]
pub struct ServiceStatusServer {
    pub name: String,
    events: EventsSender,
    progress: Option<ProgressSequence>,
    status: ServiceStatus,
    sender: ActionSender,
    receiver: ActionReceiver,
}

impl ServiceStatusServer {
    pub fn start(self) -> ServiceStatusClient {
        let channel = self.sender.clone();
        tokio::spawn(async move {
            ServiceStatusServer::run(self).await;
        });
        ServiceStatusClient(channel)
    }

    /// Runs the server dispatching the actions received through the input channel.
    pub async fn run(mut self) {
        loop {
            let Some(action) = self.receiver.recv().await else {
                break;
            };

            match action {
                Action::Start(steps, tx) => {
                    _ = tx.send(self.start_task(steps));
                }

                Action::Finish => {
                    self.finish_task();
                }

                Action::NextStep => {
                    self.next_step();
                }

                Action::GetProgress(tx) => {
                    let progress = self.get_progress();
                    _ = tx.send(progress);
                }
            }
        }
    }

    /// Starts an operation composed by several steps.
    ///
    /// It builds a new progress sequence and sets the service as "busy".
    ///
    /// * `steps`: steps to include in the sequence.
    fn start_task(&mut self, steps: Vec<String>) -> Result<(), ServiceStatusError> {
        if self.is_busy() {
            return Err(ServiceStatusError::Busy {});
        }
        let progress = ProgressSequence::new(steps);
        if let Some(step) = progress.step() {
            let _ = self.events.send(Event::Progress {
                service: self.name.clone(),
                progress: step,
            });
        }
        self.progress = Some(progress);

        self.status = ServiceStatus::Busy;
        let _ = self.events.send(Event::ServiceStatusChanged {
            service: self.name.clone(),
            status: (self.status as u32),
        });
        Ok(())
    }

    /// Moves to the next step in the progress sequence.
    ///
    /// It returns `None` if no sequence is found or if the sequence is already finished.
    fn next_step(&mut self) -> Option<Progress> {
        let Some(progress) = self.progress.as_mut() else {
            tracing::error!("No progress sequence found");
            return None;
        };

        let Some(step) = progress.next_step() else {
            tracing::error!("The progress sequence is already finished");
            return None;
        };

        let _ = self.events.send(Event::Progress {
            service: self.name.clone(),
            progress: step.clone(),
        });
        Some(step)
    }

    /// Returns the current step of the progress sequence.
    fn get_progress(&self) -> Option<ProgressSummary> {
        self.progress
            .as_ref()
            .map(|p| {
                let Some(step) = p.step() else {
                    return None;
                };

                let summary = ProgressSummary {
                    steps: p.steps.clone(),
                    current_step: step.current_step,
                    max_steps: step.max_steps,
                    current_title: step.current_title,
                    finished: step.finished,
                };
                Some(summary)
            })
            .flatten()
    }

    /// It finishes the current sequence.
    ///
    /// It finishes the progress sequence and sets the service as "idle".
    fn finish_task(&mut self) {
        self.progress = None;
        let _ = self.events.send(Event::Progress {
            service: self.name.clone(),
            progress: Progress {
                current_step: 0,
                max_steps: 0,
                current_title: "".to_string(),
                finished: true,
            },
        });

        self.status = ServiceStatus::Idle;
        let _ = self.events.send(Event::ServiceStatusChanged {
            service: self.name.clone(),
            status: (self.status as u32),
        });
    }

    /// Determines whether the service is busy or not.
    fn is_busy(&self) -> bool {
        self.status == ServiceStatus::Busy
    }
}
