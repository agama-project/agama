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
            status::Stage,
        },
        progress::{
            message,
            service::{self, Service},
        },
    };
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    struct Context {
        events_rx: event::Receiver,
        handler: Handler<Service>,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Self {
            let (events_tx, events_rx) = broadcast::channel::<Event>(16);
            let handler = Service::starter(events_tx).start();
            Self { events_rx, handler }
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_progress(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        // Start a progress (first step)
        ctx.handler
            .call(message::Start::new(Scope::L10n, 3, "first step"))
            .await?;

        let event = ctx.events_rx.recv().await.unwrap();
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

        let progresses = ctx.handler.call(message::GetProgress).await?;
        assert_eq!(progresses.len(), 1);

        let progress = progresses.first().unwrap();
        assert_eq!(*progress, event_progress);

        // Second step
        ctx.handler
            .call(message::NextWithStep::new(Scope::L10n, "second step"))
            .await?;

        let event = ctx.events_rx.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged { progress: _ }));

        let progresses = ctx.handler.call(message::GetProgress).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, Scope::L10n);
        assert_eq!(progress.size, 3);
        assert!(progress.steps.is_empty());
        assert_eq!(progress.step, "second step");
        assert_eq!(progress.index, 2);

        // Last step (without step text)
        ctx.handler.call(message::Next::new(Scope::L10n)).await?;

        let event = ctx.events_rx.recv().await.unwrap();
        assert!(matches!(event, Event::ProgressChanged { progress: _ }));

        let progresses = ctx.handler.call(message::GetProgress).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.scope, Scope::L10n);
        assert_eq!(progress.size, 3);
        assert!(progress.steps.is_empty());
        assert_eq!(progress.step, "");
        assert_eq!(progress.index, 3);

        // Finish the progress
        ctx.handler.call(message::Finish::new(Scope::L10n)).await?;

        let event = ctx.events_rx.recv().await.unwrap();
        assert!(matches!(
            event,
            Event::ProgressFinished { scope: Scope::L10n }
        ));

        let progresses = ctx.handler.call(message::GetProgress).await.unwrap();
        assert!(progresses.is_empty());

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_set_progress(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        // Set first progress.
        let progress = Progress::new(Scope::Storage, 3, "first step".to_string());
        ctx.handler
            .call(message::SetProgress::new(progress))
            .await?;

        let event = ctx.events_rx.recv().await.unwrap();
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

        let progresses = ctx.handler.call(message::GetProgress).await?;
        assert_eq!(progresses.len(), 1);

        let progress = progresses.first().unwrap();
        assert_eq!(*progress, event_progress);

        // Set second progress
        let progress = Progress::new(Scope::Storage, 3, "second step".to_string());
        ctx.handler
            .call(message::SetProgress::new(progress))
            .await?;

        let event = ctx.events_rx.recv().await.unwrap();
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

        let progresses = ctx.handler.call(message::GetProgress).await?;
        assert_eq!(progresses.len(), 1);

        let progress = progresses.first().unwrap();
        assert_eq!(*progress, event_progress);

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_progress_with_steps(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        // Start a progress (first step)
        ctx.handler
            .call(message::StartWithSteps::new(
                Scope::L10n,
                vec![
                    "first step".to_string(),
                    "second step".to_string(),
                    "third step".to_string(),
                ],
            ))
            .await?;

        let progresses = ctx.handler.call(message::GetProgress).await?;
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
        ctx.handler.call(message::Next::new(Scope::L10n)).await?;

        let progresses = ctx.handler.call(message::GetProgress).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.step, "second step");
        assert_eq!(progress.index, 2);

        // Third step
        ctx.handler.call(message::Next::new(Scope::L10n)).await?;

        let progresses = ctx.handler.call(message::GetProgress).await.unwrap();
        let progress = progresses.first().unwrap();
        assert_eq!(progress.step, "third step");
        assert_eq!(progress.index, 3);

        // Finish the progress
        ctx.handler.call(message::Finish::new(Scope::L10n)).await?;

        let progresses = ctx.handler.call(message::GetProgress).await.unwrap();
        assert!(progresses.is_empty());

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_several_progresses(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        ctx.handler
            .call(message::Start::new(Scope::Manager, 2, ""))
            .await?;
        ctx.handler
            .call(message::Start::new(Scope::L10n, 2, ""))
            .await?;

        let progresses = ctx.handler.call(message::GetProgress).await.unwrap();
        assert_eq!(progresses.len(), 2);
        assert_eq!(progresses[0].scope, Scope::Manager);
        assert_eq!(progresses[1].scope, Scope::L10n);

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_progress_missing_step(
        ctx: &mut Context,
    ) -> Result<(), Box<dyn std::error::Error>> {
        ctx.handler
            .call(message::Start::new(Scope::L10n, 1, ""))
            .await?;
        let error = ctx.handler.call(message::Next::new(Scope::L10n)).await;
        assert!(matches!(
            error,
            Err(service::Error::Progress(progress::Error::MissingStep(
                Scope::L10n
            )))
        ));

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_missing_progress(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        ctx.handler
            .call(message::Start::new(Scope::Manager, 2, ""))
            .await?;
        let error = ctx.handler.call(message::Next::new(Scope::L10n)).await;
        assert!(matches!(
            error,
            Err(service::Error::MissingProgress(Scope::L10n))
        ));

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_duplicated_progress(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        ctx.handler
            .call(message::Start::new(Scope::L10n, 2, ""))
            .await?;

        let error = ctx
            .handler
            .call(message::Start::new(Scope::L10n, 1, ""))
            .await;
        assert!(matches!(
            error,
            Err(service::Error::DuplicatedProgress(Scope::L10n))
        ));

        let error = ctx
            .handler
            .call(message::StartWithSteps::new(
                Scope::L10n,
                vec!["step".to_string()],
            ))
            .await;
        assert!(matches!(
            error,
            Err(service::Error::DuplicatedProgress(Scope::L10n))
        ));

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_set_and_get_stage(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        let stage = ctx.handler.call(message::GetStage).await?;
        assert_eq!(stage, Stage::Configuring);

        ctx.handler
            .call(message::SetStage::new(Stage::Installing))
            .await?;

        let stage = ctx.handler.call(message::GetStage).await?;
        assert_eq!(stage, Stage::Installing);
        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_is_empty(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        let is_empty = ctx.handler.call(message::IsEmpty::new()).await?;
        assert!(is_empty);

        // Start a progress (first step)
        ctx.handler
            .call(message::Start::new(Scope::L10n, 3, "first step"))
            .await?;

        let is_empty = ctx.handler.call(message::IsEmpty::new()).await?;
        assert!(!is_empty);

        let is_empty = ctx
            .handler
            .call(message::IsEmpty::with_scope(Scope::L10n))
            .await?;
        assert!(!is_empty);

        let is_empty = ctx
            .handler
            .call(message::IsEmpty::with_scope(Scope::Software))
            .await?;
        assert!(is_empty);
        Ok(())
    }
}
