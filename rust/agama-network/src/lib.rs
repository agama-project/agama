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

//! Network configuration service for Agama
//!
//! This library implements the network configuration service for Agama.

pub mod adapter;
pub mod error;
pub mod message;
pub mod model;
mod nm;
mod service;
pub mod types;

pub use adapter::{Adapter, NetworkAdapterError};
pub use model::NetworkState;
pub use nm::NetworkManagerAdapter;
pub use service::{NetworkSystemError, Service, Starter};

pub mod test_utils;

#[cfg(test)]
mod tests {
    use crate::{
        message,
        model::{Connection, GeneralState},
        test_utils::{stacked_connections, TestAdapter},
        types::{Config, Device},
        NetworkState, Service, Starter,
    };
    use agama_utils::{
        actor::Handler,
        api::{
            event::{self, Event},
            network::DeviceType,
            scope::Scope,
        },
        progress,
    };
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    struct Context {
        events_rx: event::Receiver,
        adapter: TestAdapter,
        handler: Handler<Service>,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let (events_tx, events_rx) = broadcast::channel::<Event>(16);
            let progress = progress::Service::starter(events_tx.clone()).start();
            let adapter = TestAdapter::default();

            let handler = Starter::new(events_tx, progress)
                .with_adapter(adapter.clone())
                .start()
                .await
                .expect("Could not start the network service");

            let mut context = Self {
                events_rx,
                adapter,
                handler,
            };
            // Discard the events emitted when applying the default configuration on start.
            context.network_events();
            context
        }
    }

    impl Context {
        /// Returns the network events emitted since the last call, ignoring any other event.
        fn network_events(&mut self) -> Vec<&'static str> {
            let mut events = vec![];
            while let Ok(event) = self.events_rx.try_recv() {
                match event {
                    Event::ConfigChanged {
                        scope: Scope::Network,
                    } => events.push("ConfigChanged"),
                    Event::ProposalChanged {
                        scope: Scope::Network,
                    } => events.push("ProposalChanged"),
                    Event::SystemChanged {
                        scope: Scope::Network,
                    } => events.push("SystemChanged"),
                    _ => {}
                }
            }
            events
        }
    }

    fn stacked_config() -> Config {
        let state = NetworkState::new(
            None,
            GeneralState::default(),
            vec![],
            vec![],
            stacked_connections(),
        );
        state.try_into().unwrap()
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_set_config(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        ctx.handler
            .call(message::SetConfig::new(stacked_config()))
            .await?;
        assert_eq!(
            ctx.network_events(),
            ["ConfigChanged", "ProposalChanged", "SystemChanged"]
        );

        let config = ctx.handler.call(message::GetConfig).await?;
        let connections = config.connections.unwrap().flatten();
        let mut ids: Vec<&str> = connections.iter().map(|c| c.id.as_str()).collect();
        ids.sort_unstable();
        assert_eq!(ids, ["bond0", "br0", "br0.100", "eth0", "eth1"]);

        let system = ctx.handler.call(message::GetSystem).await?;
        let roots: Vec<&str> = system
            .connections
            .0
            .iter()
            .map(|c| c.connection.id.as_str())
            .collect();
        assert_eq!(roots, ["br0", "br0.100"]);
        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_update_device(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        let mut device = Device {
            name: "eth0".to_string(),
            ..Default::default()
        };
        ctx.handler
            .call(message::AddDevice {
                device: device.clone(),
            })
            .await?;
        assert_eq!(ctx.network_events(), ["SystemChanged"]);

        // An unchanged device is not reported.
        ctx.handler
            .call(message::UpdateDevice {
                name: "eth0".to_string(),
                device: device.clone(),
            })
            .await?;
        assert!(ctx.network_events().is_empty());

        device.speed = Some(1000);
        ctx.handler
            .call(message::UpdateDevice {
                name: "eth0".to_string(),
                device,
            })
            .await?;
        assert_eq!(ctx.network_events(), ["SystemChanged"]);
        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_new_connection(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        ctx.handler
            .call(message::SetConfig::new(stacked_config()))
            .await?;
        ctx.network_events();

        // A known connection is skipped.
        let eth0 = stacked_connections().remove(0);
        ctx.handler
            .call(message::NewConnection { connection: eth0 })
            .await?;
        assert!(ctx.network_events().is_empty());

        // NetworkManager adds a connection.
        let eth2 = Connection::new("eth2".to_string(), DeviceType::Ethernet);
        let mut state = ctx.adapter.state();
        state.connections.push(eth2.clone());
        ctx.adapter.set_state(state);

        ctx.handler
            .call(message::NewConnection { connection: eth2 })
            .await?;
        assert_eq!(ctx.network_events(), ["ProposalChanged", "SystemChanged"]);

        let system = ctx.handler.call(message::GetSystem).await?;
        assert!(system
            .connections
            .0
            .iter()
            .any(|c| c.connection.id == "eth2"));
        Ok(())
    }
}
