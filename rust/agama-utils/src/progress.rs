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

pub mod service;
pub use service::Service;

pub mod message;

#[cfg(test)]
mod tests {
    use crate::{
        actor::Handler,
        api::{
            event::{self, Event},
            progress::{self, Progress},
            scope::Scope,
        },
        progress::{
            message,
            service::{self, Service},
        },
    };
    use tokio::sync::broadcast;

    fn start_testing_service() -> (event::Receiver, Handler<Service>) {
        let (events, receiver) = broadcast::channel::<Event>(16);
        let handler = Service::builder(events).build();
        (receiver, handler)
    }

    #[tokio::test]
    async fn test_progress() -> Result<(), Box<dyn std::error::Error>> {
        let (mut receiver, handler) = start_testing_service();

        // Start a progress (first step)
        handler
            .call(message::Start::new(Scope::L10n, 3, "first step"))
            .await?;

        let event = receiver.recv().await.unwrap();
        let Event::ProgressChanged {
            progress: event_progress,
        } = event
        else {
            panic!("Unexpected event: {:?}", event);
        };

        assert_eq!(event_progress.scope, Scope::L10n);
        assert_eq!(event_progress.size, 3);
        assert!(event_progress.steps.is_empty());
        assert_eq!(event_progress.step, "first step");
        assert_eq!(event_progress.index, 1);

        let progresses = handler.call(message::Get).await?;
        assert_eq!(progresses.len(), 1);

        let progress = progresses.first().unwrap();
        assert_eq!(*progress, event_progress);

        // Second step
        handler
            .call(message::NextWithStep::new(Scope::L10n, "second step"))
            .await?;

        let event = receiver.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged { progress: _ }));

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, Scope::L10n);
        assert_eq!(progress.size, 3);
        assert!(progress.steps.is_empty());
        assert_eq!(progress.step, "second step");
        assert_eq!(progress.index, 2);

        // Last step (without step text)
        handler.call(message::Next::new(Scope::L10n)).await?;

        let event = receiver.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged { progress: _ }));

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, Scope::L10n);
        assert_eq!(progress.size, 3);
        assert!(progress.steps.is_empty());
        assert_eq!(progress.step, "");
        assert_eq!(progress.index, 3);

        // Finish the progress
        handler.call(message::Finish::new(Scope::L10n)).await?;

        let event = receiver.recv().await.unwrap();
        assert!(matches!(
            event,
            Event::ProgressFinished { scope: Scope::L10n }
        ));

        let progresses = handler.call(message::Get).await.unwrap();
        assert!(progresses.is_empty());

        Ok(())
    }

    #[tokio::test]
    async fn test_set_progress() -> Result<(), Box<dyn std::error::Error>> {
        let (mut receiver, handler) = start_testing_service();

        // Set first progress.
        let progress = Progress::new(Scope::Storage, 3, "first step".to_string());
        handler.call(message::Set::new(progress)).await?;

        let event = receiver.recv().await.unwrap();
        let Event::ProgressChanged {
            progress: event_progress,
        } = event
        else {
            panic!("Unexpected event: {:?}", event);
        };

        assert_eq!(event_progress.scope, Scope::Storage);
        assert_eq!(event_progress.size, 3);
        assert!(event_progress.steps.is_empty());
        assert_eq!(event_progress.step, "first step");
        assert_eq!(event_progress.index, 1);

        let progresses = handler.call(message::Get).await?;
        assert_eq!(progresses.len(), 1);

        let progress = progresses.first().unwrap();
        assert_eq!(*progress, event_progress);

        // Set second progress
        let progress = Progress::new(Scope::Storage, 3, "second step".to_string());
        handler.call(message::Set::new(progress)).await?;

        let event = receiver.recv().await.unwrap();
        let Event::ProgressChanged {
            progress: event_progress,
        } = event
        else {
            panic!("Unexpected event: {:?}", event);
        };

        assert_eq!(event_progress.scope, Scope::Storage);
        assert_eq!(event_progress.size, 3);
        assert!(event_progress.steps.is_empty());
        assert_eq!(event_progress.step, "second step");
        assert_eq!(event_progress.index, 1);

        let progresses = handler.call(message::Get).await?;
        assert_eq!(progresses.len(), 1);

        let progress = progresses.first().unwrap();
        assert_eq!(*progress, event_progress);

        Ok(())
    }

    #[tokio::test]
    async fn test_progress_with_steps() -> Result<(), Box<dyn std::error::Error>> {
        let (_receiver, handler) = start_testing_service();

        // Start a progress (first step)
        handler
            .call(message::StartWithSteps::new(
                Scope::L10n,
                &["first step", "second step", "third step"],
            ))
            .await?;

        let progresses = handler.call(message::Get).await?;
        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, Scope::L10n);
        assert_eq!(progress.size, 3);
        assert_eq!(progress.steps.len(), 3);
        assert_eq!(progress.steps[0], "first step");
        assert_eq!(progress.steps[1], "second step");
        assert_eq!(progress.steps[2], "third step");
        assert_eq!(progress.step, "first step");
        assert_eq!(progress.index, 1);

        // Second step
        handler.call(message::Next::new(Scope::L10n)).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.step, "second step");
        assert_eq!(progress.index, 2);

        // Third step
        handler.call(message::Next::new(Scope::L10n)).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.step, "third step");
        assert_eq!(progress.index, 3);

        // Finish the progress
        handler.call(message::Finish::new(Scope::L10n)).await?;

        let progresses = handler.call(message::Get).await.unwrap();
        assert!(progresses.is_empty());

        Ok(())
    }

    #[tokio::test]
    async fn test_several_progresses() -> Result<(), Box<dyn std::error::Error>> {
        let (_receiver, handler) = start_testing_service();

        handler
            .call(message::Start::new(Scope::Manager, 2, ""))
            .await?;
        handler
            .call(message::Start::new(Scope::L10n, 2, ""))
            .await?;

        let progresses = handler.call(message::Get).await.unwrap();
        assert_eq!(progresses.len(), 2);
        assert_eq!(progresses[0].scope, Scope::Manager);
        assert_eq!(progresses[1].scope, Scope::L10n);

        Ok(())
    }

    #[tokio::test]
    async fn test_progress_missing_step() -> Result<(), Box<dyn std::error::Error>> {
        let (_receiver, handler) = start_testing_service();

        handler
            .call(message::Start::new(Scope::L10n, 1, ""))
            .await?;
        let error = handler.call(message::Next::new(Scope::L10n)).await;
        assert!(matches!(
            error,
            Err(service::Error::Progress(progress::Error::MissingStep(
                Scope::L10n
            )))
        ));

        Ok(())
    }

    #[tokio::test]
    async fn test_missing_progress() -> Result<(), Box<dyn std::error::Error>> {
        let (_receiver, handler) = start_testing_service();

        handler
            .call(message::Start::new(Scope::Manager, 2, ""))
            .await?;
        let error = handler.call(message::Next::new(Scope::L10n)).await;
        assert!(matches!(
            error,
            Err(service::Error::MissingProgress(Scope::L10n))
        ));

        Ok(())
    }

    #[tokio::test]
    async fn test_duplicated_progress() -> Result<(), Box<dyn std::error::Error>> {
        let (_receiver, handler) = start_testing_service();

        handler
            .call(message::Start::new(Scope::L10n, 2, ""))
            .await?;

        let error = handler.call(message::Start::new(Scope::L10n, 1, "")).await;
        assert!(matches!(
            error,
            Err(service::Error::DuplicatedProgress(Scope::L10n))
        ));

        let error = handler
            .call(message::StartWithSteps::new(Scope::L10n, &["step"]))
            .await;
        assert!(matches!(
            error,
            Err(service::Error::DuplicatedProgress(Scope::L10n))
        ));

        Ok(())
    }
}
