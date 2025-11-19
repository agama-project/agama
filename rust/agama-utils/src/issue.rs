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

//! Service to keep the installation issues in a centralized place.
//!
//! This service offers and API for other services to register the issues.
//! Additionally, it is responsible for emitting the corresponding event when
//! the list of issues changes.
//!
//! The service can be started calling the [start] function, which returns an
//! [agama_utils::actors::ActorHandler] to interact with it.

pub mod service;
pub use service::Service;

pub mod message;

#[cfg(test)]
mod tests {
    use crate::{
        actor::Handler,
        api::{
            event::{Event, Receiver},
            issue::Issue,
            scope::Scope,
        },
        issue::{
            message,
            service::{Error, Service},
        },
    };
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast::{self, error::TryRecvError};

    fn build_issue() -> Issue {
        Issue {
            description: "Product not selected".to_string(),
            class: "missing_product".to_string(),
            details: Some("A product is required.".to_string()),
        }
    }

    struct Context {
        handler: Handler<Service>,
        receiver: Receiver,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let (sender, receiver) = broadcast::channel::<Event>(16);
            let handler = Service::starter(sender).start();
            Self { handler, receiver }
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_get_and_update_issues(ctx: &mut Context) -> Result<(), Error> {
        let issues = ctx.handler.call(message::Get).await.unwrap();
        assert!(issues.is_empty());

        let issue = build_issue();
        ctx.handler
            .cast(message::Set::new(Scope::Manager, vec![issue]))?;

        let issues = ctx.handler.call(message::Get).await?;
        assert_eq!(issues.len(), 1);

        assert!(ctx.receiver.recv().await.is_ok());
        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_update_without_event(ctx: &mut Context) -> Result<(), Error> {
        let issues = ctx.handler.call(message::Get).await?;
        assert!(issues.is_empty());

        let issue = build_issue();
        let update = message::Set::new(Scope::Manager, vec![issue]).notify(false);
        ctx.handler.cast(update)?;

        let issues = ctx.handler.call(message::Get).await?;
        assert_eq!(issues.len(), 1);

        assert!(matches!(ctx.receiver.try_recv(), Err(TryRecvError::Empty)));
        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_update_without_change(ctx: &mut Context) -> Result<(), Error> {
        let issue = build_issue();
        let update = message::Set::new(Scope::Manager, vec![issue.clone()]);
        ctx.handler.call(update).await?;
        assert!(ctx.receiver.try_recv().is_ok());

        let update = message::Set::new(Scope::Manager, vec![issue]);
        ctx.handler.call(update).await?;
        assert!(matches!(ctx.receiver.try_recv(), Err(TryRecvError::Empty)));
        Ok(())
    }
}
