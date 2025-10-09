// Copyright (c) [2025] SUSE LLC
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

use crate::{
    actor::{self, Handler},
    progress::{event, service::Service},
};
use std::convert::Infallible;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Infallible(#[from] Infallible),
}

/// Starts the progress service.
///
/// * `events`: channel to emit the [progress-specific events](crate::progress::event::Event).
pub async fn start(events: event::Sender) -> Result<Handler<Service>, Error> {
    let handler = actor::spawn(Service::new(events));
    Ok(handler)
}

#[cfg(test)]
mod tests {
    use crate::actor::{self, Handler};
    use crate::progress::{
        event::{Event, Receiver},
        message,
        service::{self, Service},
    };
    use tokio::sync::mpsc;

    fn start_testing_service() -> (Receiver, Handler<Service>) {
        let (events, receiver) = mpsc::unbounded_channel::<Event>();
        let service = Service::new(events);

        let handler = actor::spawn(service);
        (receiver, handler)
    }

    #[tokio::test]
    async fn test_progress() -> Result<(), Box<dyn std::error::Error>> {
        let (mut receiver, handler) = start_testing_service();

        // Start a progress (first step)
        handler
            .call(message::Start::new("test", 3, "first step"))
            .await?;

        let event = receiver.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged));

        let progresses = handler.call(message::Get).await?;
        assert_eq!(progresses.len(), 1);

        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, "test");
        assert_eq!(progress.size, 3);
        assert!(progress.steps.is_empty());
        assert_eq!(progress.step, "first step");
        assert_eq!(progress.index, 1);

        // Second step
        handler
            .call(message::NextStep::new("test", "second step"))
            .await?;

        let event = receiver.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged));

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, "test");
        assert_eq!(progress.size, 3);
        assert!(progress.steps.is_empty());
        assert_eq!(progress.step, "second step");
        assert_eq!(progress.index, 2);

        // Last step (without step text)
        handler.call(message::Next::new("test")).await?;

        let event = receiver.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged));

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, "test");
        assert_eq!(progress.size, 3);
        assert!(progress.steps.is_empty());
        assert_eq!(progress.step, "");
        assert_eq!(progress.index, 3);

        // Finish the progress
        handler.call(message::Finish::new("test")).await?;

        let event = receiver.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged));

        let progresses = handler.call(message::Get).await.unwrap();
        assert!(progresses.is_empty());

        Ok(())
    }

    #[tokio::test]
    async fn test_progress_with_steps() -> Result<(), Box<dyn std::error::Error>> {
        let (_receiver, handler) = start_testing_service();

        // Start a progress (first step)
        handler
            .call(message::StartWithSteps::new(
                "test",
                &["first step", "second step", "third step"],
            ))
            .await?;

        let progresses = handler.call(message::Get).await?;
        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, "test");
        assert_eq!(progress.size, 3);
        assert_eq!(progress.steps.len(), 3);
        assert_eq!(progress.steps[0], "first step");
        assert_eq!(progress.steps[1], "second step");
        assert_eq!(progress.steps[2], "third step");
        assert_eq!(progress.step, "first step");
        assert_eq!(progress.index, 1);

        // Second step
        handler.call(message::Next::new("test")).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.step, "second step");
        assert_eq!(progress.index, 2);

        // Third step
        handler.call(message::Next::new("test")).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.step, "third step");
        assert_eq!(progress.index, 3);

        // Finish the progress
        handler.call(message::Finish::new("test")).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        assert!(progresses.is_empty());

        Ok(())
    }

    #[tokio::test]
    async fn test_several_progresses() -> Result<(), Box<dyn std::error::Error>> {
        let (_receiver, handler) = start_testing_service();

        handler.call(message::Start::new("test1", 2, "")).await?;
        handler.call(message::Start::new("test2", 2, "")).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        assert_eq!(progresses.len(), 2);
        assert_eq!(progresses[0].scope, "test1");
        assert_eq!(progresses[1].scope, "test2");

        Ok(())
    }

    #[tokio::test]
    async fn test_progress_missing_step() -> Result<(), Box<dyn std::error::Error>> {
        let (_receiver, handler) = start_testing_service();

        handler.call(message::Start::new("test", 1, "")).await?;
        let error = handler.call(message::Next::new("test")).await;
        assert!(matches!(error, Err(service::Error::MissingStep(scope)) if scope == "test"));

        Ok(())
    }

    #[tokio::test]
    async fn test_missing_progress() -> Result<(), Box<dyn std::error::Error>> {
        let (_receiver, handler) = start_testing_service();

        handler.call(message::Start::new("test1", 2, "")).await?;
        let error = handler.call(message::Next::new("test2")).await;
        assert!(matches!(error, Err(service::Error::MissingProgress(scope)) if scope == "test2"));

        Ok(())
    }

    #[tokio::test]
    async fn test_duplicated_progress() -> Result<(), Box<dyn std::error::Error>> {
        let (_receiver, handler) = start_testing_service();

        handler.call(message::Start::new("test", 2, "")).await?;

        let error = handler.call(message::Start::new("test", 1, "")).await;
        assert!(matches!(error, Err(service::Error::DuplicatedProgress(scope)) if scope == "test"));

        let error = handler
            .call(message::StartWithSteps::new("test", &["step"]))
            .await;
        assert!(matches!(error, Err(service::Error::DuplicatedProgress(scope)) if scope == "test"));

        Ok(())
    }
}
