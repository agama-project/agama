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

pub mod client;
pub mod message;
mod monitor;

pub mod test_utils;

#[cfg(test)]
mod tests {
    use agama_utils::{actor::Handler, api::Event, issue, progress, test};
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    use crate::test_utils::TestClient;

    use super::*;

    struct Context {
        // events_rx: broadcast::Receiver<Event>,
        handler: Handler<Service>,
        client: TestClient,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let (events_tx, _events_rx) = broadcast::channel::<Event>(16);
            let dbus = test::dbus::connection().await.unwrap();
            let issues = issue::start(events_tx.clone(), dbus.clone()).await.unwrap();
            let progress = progress::Service::builder(events_tx.clone()).build();

            let client = TestClient::new();
            let handler = Service::builder(events_tx, issues.clone(), progress, dbus)
                .with_client(client.clone())
                .spawn()
                .await
                .expect("Could not start the storage service");

            Context { handler, client }
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_probe(ctx: &mut Context) -> Result<(), service::Error> {
        ctx.handler.call(message::Probe).await?;

        let state = ctx.client.state().await;
        assert!(state.probed);

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_install(ctx: &mut Context) -> Result<(), service::Error> {
        ctx.handler.call(message::Install).await?;

        let state = ctx.client.state().await;
        assert!(state.installed);

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_finish(ctx: &mut Context) -> Result<(), service::Error> {
        ctx.handler.call(message::Finish).await?;

        let state = ctx.client.state().await;
        assert!(state.finished);

        Ok(())
    }
}
