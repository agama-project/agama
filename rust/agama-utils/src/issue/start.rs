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

use crate::actor::{self, Handler};
use crate::api::event;
use crate::issue::monitor::{self, Monitor};
use crate::issue::service::{self, Service};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Service(#[from] service::Error),
}

pub async fn start(
    events: event::Sender,
    dbus: Option<zbus::Connection>,
) -> Result<Handler<Service>, Error> {
    let service = Service::new(events);
    let handler = actor::spawn(service);

    if let Some(conn) = dbus {
        let dbus_monitor = Monitor::new(handler.clone(), conn);
        monitor::spawn(dbus_monitor);
    }

    Ok(handler)
}

#[cfg(test)]
mod tests {
    use crate::api::event::Event;
    use crate::api::issue::{Issue, IssueSeverity, IssueSource};
    use crate::api::scope::Scope;
    use crate::issue;
    use crate::issue::message;
    use tokio::sync::broadcast::{self, error::TryRecvError};

    fn build_issue() -> Issue {
        Issue {
            description: "Product not selected".to_string(),
            kind: "missing_product".to_string(),
            details: Some("A product is required.".to_string()),
            source: IssueSource::Config,
            severity: IssueSeverity::Error,
        }
    }

    #[tokio::test]
    async fn test_get_and_update_issues() -> Result<(), Box<dyn std::error::Error>> {
        let (events_tx, mut events_rx) = broadcast::channel::<Event>(16);
        let issues = issue::start(events_tx, None).await.unwrap();
        let issues_list = issues.call(message::Get).await.unwrap();
        assert!(issues_list.is_empty());

        let issue = build_issue();
        _ = issues
            .cast(message::Update::new(Scope::Manager, vec![issue]))
            .unwrap();

        let issues_list = issues.call(message::Get).await.unwrap();
        assert_eq!(issues_list.len(), 1);

        assert!(events_rx.recv().await.is_ok());
        Ok(())
    }

    #[tokio::test]
    async fn test_update_without_event() -> Result<(), Box<dyn std::error::Error>> {
        let (events_tx, mut events_rx) = broadcast::channel::<Event>(16);
        let issues = issue::start(events_tx, None).await.unwrap();

        let issues_list = issues.call(message::Get).await.unwrap();
        assert!(issues_list.is_empty());

        let issue = build_issue();
        let update = message::Update::new(Scope::Manager, vec![issue]).notify(false);
        _ = issues.cast(update).unwrap();

        let issues_list = issues.call(message::Get).await.unwrap();
        assert_eq!(issues_list.len(), 1);

        assert!(matches!(events_rx.try_recv(), Err(TryRecvError::Empty)));
        Ok(())
    }

    #[tokio::test]
    async fn test_update_without_change() -> Result<(), Box<dyn std::error::Error>> {
        let (events_tx, mut events_rx) = broadcast::channel::<Event>(16);
        let issues = issue::start(events_tx, None).await.unwrap();

        let issue = build_issue();
        let update = message::Update::new(Scope::Manager, vec![issue.clone()]);
        issues.call(update).await.unwrap();
        assert!(events_rx.try_recv().is_ok());

        let update = message::Update::new(Scope::Manager, vec![issue]);
        issues.call(update).await.unwrap();
        assert!(matches!(events_rx.try_recv(), Err(TryRecvError::Empty)));
        Ok(())
    }
}
