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
        let scope = "test".to_string();
        let (mut receiver, handler) = start_testing_service();

        // Start a progress
        handler.call(message::Start::new(scope.clone(), 2)).await?;

        let event = receiver.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged));

        let progresses = handler.call(message::Get).await?;
        assert_eq!(progresses.len(), 1);

        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, scope);
        assert_eq!(progress.size, 2);
        assert!(progress.steps.is_none());
        assert!(progress.step.is_none());
        assert!(progress.index.is_none());

        // First step
        handler
            .call(message::NextStep::new(
                scope.clone(),
                "first step".to_string(),
            ))
            .await?;

        let event = receiver.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged));

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, scope);
        assert_eq!(progress.size, 2);
        assert!(progress.steps.is_none());
        assert_eq!(*progress.step.as_ref().unwrap(), "first step".to_string());
        assert_eq!(progress.index.unwrap(), 1);

        // Second step (without step text)
        handler.call(message::Next::new(scope.clone())).await?;

        let event = receiver.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged));

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, scope);
        assert_eq!(progress.size, 2);
        assert!(progress.steps.is_none());
        assert!(progress.step.is_none());
        assert_eq!(progress.index.unwrap(), 2);

        // Finish the progress
        handler.call(message::Finish::new(scope.clone())).await?;

        let event = receiver.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged));

        let progresses = handler.call(message::Get).await.unwrap();
        assert!(progresses.is_empty());

        Ok(())
    }

    #[tokio::test]
    async fn test_progress_with_steps() -> Result<(), Box<dyn std::error::Error>> {
        let scope = "test".to_string();
        let (_receiver, handler) = start_testing_service();

        let first_step = "first step".to_string();
        let second_step = "second step".to_string();
        let third_step = "third step".to_string();

        // Start a progress
        handler
            .call(message::StartWithSteps::new(
                scope.clone(),
                vec![first_step.clone(), second_step.clone(), third_step.clone()],
            ))
            .await?;

        let progresses = handler.call(message::Get).await?;
        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, scope);
        assert_eq!(progress.size, 3);
        assert_eq!(progress.steps.as_ref().unwrap().len(), 3);
        assert_eq!(*progress.steps.as_ref().unwrap()[0], first_step);
        assert_eq!(*progress.steps.as_ref().unwrap()[1], second_step);
        assert_eq!(*progress.steps.as_ref().unwrap()[2], third_step);
        assert!(progress.step.is_none());
        assert!(progress.index.is_none());

        // First step
        handler.call(message::Next::new(scope.clone())).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(*progress.step.as_ref().unwrap(), first_step);
        assert_eq!(progress.index.unwrap(), 1);

        // Second step
        handler.call(message::Next::new(scope.clone())).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(*progress.step.as_ref().unwrap(), second_step);
        assert_eq!(progress.index.unwrap(), 2);

        // Third step
        handler.call(message::Next::new(scope.clone())).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(*progress.step.as_ref().unwrap(), third_step);
        assert_eq!(progress.index.unwrap(), 3);

        // Finish the progress
        handler.call(message::Finish::new(scope.clone())).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        assert!(progresses.is_empty());

        Ok(())
    }

    #[tokio::test]
    async fn test_several_progresses() -> Result<(), Box<dyn std::error::Error>> {
        let scope1 = "test1".to_string();
        let scope2 = "test2".to_string();
        let (_receiver, handler) = start_testing_service();

        handler.call(message::Start::new(scope1.clone(), 2)).await?;
        handler.call(message::Start::new(scope2.clone(), 2)).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        assert_eq!(progresses.len(), 2);
        assert_eq!(progresses[0].scope, scope1);
        assert_eq!(progresses[1].scope, scope2);

        Ok(())
    }

    #[tokio::test]
    async fn test_progress_error_next() -> Result<(), Box<dyn std::error::Error>> {
        let scope = "test".to_string();
        let (_receiver, handler) = start_testing_service();

        handler.call(message::Start::new(scope.clone(), 1)).await?;
        handler.call(message::Next::new(scope.clone())).await?;
        let error = handler.call(message::Next::new(scope.clone())).await;
        assert!(matches!(error, Err(service::Error::NextStep(s)) if s == scope));

        Ok(())
    }

    #[tokio::test]
    async fn test_progress_error_scope() -> Result<(), Box<dyn std::error::Error>> {
        let scope1 = "test1".to_string();
        let scope2 = "test2".to_string();
        let (_receiver, handler) = start_testing_service();

        handler.call(message::Start::new(scope1.clone(), 1)).await?;
        let error = handler.call(message::Next::new(scope2.clone())).await;
        assert!(matches!(error, Err(service::Error::Progress(s)) if s == scope2));

        Ok(())
    }
}
