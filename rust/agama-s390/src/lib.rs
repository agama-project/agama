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

pub mod service;
pub use service::{Service, Starter};

pub mod dasd;
pub mod message;
pub mod test_utils;
pub mod zfcp;

use agama_storage as storage;
use agama_storage_client as storage_client;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{TestDASDClient, TestZFCPClient};
    use agama_utils::{
        actor::Handler,
        api::{s390::Config, Event},
        issue, progress, test,
    };
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    struct Context {
        handler: Handler<Service>,
        dasd: TestDASDClient,
        zfcp: TestZFCPClient,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let (events, _) = broadcast::channel::<Event>(16);
            let connection = test::dbus::connection().await.unwrap();
            let progress = progress::Service::starter(events.clone()).start();
            let issues = issue::Service::starter(events.clone()).start();
            let storage = storage::test_utils::start_service(
                events.clone(),
                issues.clone(),
                progress.clone(),
                connection.clone(),
            )
            .await;
            let dasd = TestDASDClient::new();
            let zfcp = TestZFCPClient::new();
            let handler = Service::starter(storage, events, progress, issues, connection)
                .with_dasd(dasd.clone())
                .with_zfcp(zfcp.clone())
                .start()
                .await
                .expect("Could not start the s390 service");

            Context {
                handler,
                dasd,
                zfcp,
            }
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_probe_dasd(ctx: &mut Context) -> Result<(), service::Error> {
        ctx.handler.call(message::ProbeDASD).await?;

        let state = ctx.dasd.state().await;
        assert!(state.probed);

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_probe_zfcp(ctx: &mut Context) -> Result<(), service::Error> {
        ctx.handler.call(message::ProbeZFCP).await?;

        let state = ctx.zfcp.state().await;
        assert!(state.probed);

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_get_system(ctx: &mut Context) -> Result<(), service::Error> {
        let system = ctx.handler.call(message::GetSystem).await?;
        assert!(system.dasd.is_some());
        assert!(system.zfcp.is_some());

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_set_config(ctx: &mut Context) -> Result<(), service::Error> {
        let config: Config = serde_json::from_str(
            r#"
            {
                "dasd": {
                    "devices": [
                        {
                            "channel": "0.0.0100",
                            "active": true,
                            "format": true
                        }
                    ]
                },
                "zfcp": {
                    "devices": [
                        {
                            "channel": "0.0.1a00",
                            "wwpn": "0x5005076300c20b8e",
                            "lun": "0x0001000000000000",
                            "active": true
                        }
                    ]
                }
            }
            "#,
        )
        .unwrap();
        let message = message::SetConfig::new(Some(config));
        ctx.handler.call(message).await?;

        let config = ctx.handler.call(message::GetConfig).await?;
        assert!(config.dasd.is_some());
        assert!(config.zfcp.is_some());

        Ok(())
    }
}
