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

//! This crate implements the support for localization handling in Agama.
//! It takes care of setting the locale, keymap and timezone for Agama itself
//! and the target system.
//!
//! From a technical point of view, it includes:
//!
//! * The [UserConfig] struct that defines the settings the user can
//!   alter for the target system.
//! * The [Proposal] struct that describes how the system will look like after
//!   the installation.
//! * The [SystemInfo] which includes information about the system
//!   where Agama is running.
//! * An [specific event type](Event) for localization-related events.
//!
//! The service can be started by calling the [start_service] function, which
//! returns a [agama_utils::actors::ActorHandler] to interact with the system.

pub mod service;
pub use service::{Service, Starter};

mod dbus;
pub mod message;
mod model;
pub use model::{Model, ModelAdapter};
mod monitor;
pub mod test_utils;

#[cfg(test)]
mod tests {
    use crate::{
        message,
        service::Service,
        test_utils::{start_service, TestModel},
    };

    use agama_utils::{
        actor::Handler,
        api::{self, event::Event},
        issue,
    };
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    struct Context {
        events_rx: broadcast::Receiver<Event>,
        handler: Handler<Service>,
        issues: Handler<issue::Service>,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let (events_tx, events_rx) = broadcast::channel::<Event>(16);
            let issues = issue::Service::starter(events_tx.clone()).start();

            let handler = start_service(events_tx, issues.clone()).await;

            Self {
                events_rx,
                handler,
                issues,
            }
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_get_and_set_config(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        let mut config = ctx.handler.call(message::GetConfig).await.unwrap();
        assert_eq!(config.r#static, Some("test-hostname".to_string()));
        config.r#static = Some("".to_string());
        config.hostname = Some("test".to_string());

        ctx.handler
            .call(message::SetConfig::with(config.clone()))
            .await?;
        dbg!(" Updated hostname ");

        let updated = ctx.handler.call(message::GetConfig).await?;
        assert_eq!(
            &updated,
            &api::hostname::Config {
                r#static: Some("".to_string()),
                hostname: Some("test".to_string())
            }
        );

        Ok(())
    }
}
