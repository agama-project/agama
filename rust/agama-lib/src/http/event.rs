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
    auth::ClientId,
    jobs::Job,
    manager::InstallationPhase,
    network::model::NetworkChange,
    progress::Progress,
    storage::{
        model::{
            dasd::{DASDDevice, DASDFormatSummary},
            zfcp::{ZFCPController, ZFCPDisk},
        },
        ISCSINode,
    },
    users::{FirstUser, RootUser},
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::broadcast;

pub type OldSender = broadcast::Sender<OldEvent>;
pub type OldReceiver = broadcast::Receiver<OldEvent>;

/// Agama event.
///
/// It represents an event that occurs in Agama.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OldEvent {
    /// The identifier of the client which caused the event.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<ClientId>,
    /// Event payload.
    #[serde(flatten)]
    pub payload: EventPayload,
}

impl OldEvent {
    /// Creates a new event.
    ///
    /// * `payload`: event payload.
    pub fn new(payload: EventPayload) -> Self {
        OldEvent {
            client_id: None,
            payload,
        }
    }

    /// Creates a new event with a client ID.
    ///
    /// * `payload`: event payload.
    /// * `client_id`: client ID.
    pub fn new_with_client_id(payload: EventPayload, client_id: &ClientId) -> Self {
        OldEvent {
            client_id: Some(client_id.clone()),
            payload,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "type")]
pub enum EventPayload {
    ClientConnected,
    LocaleChanged {
        locale: String,
    },
    DevicesDirty {
        dirty: bool,
    },
    ProgressChanged {
        path: String,
        #[serde(flatten)]
        progress: Progress,
    },
    ProductChanged {
        id: String,
    },
    RegistrationChanged,
    FirstUserChanged(FirstUser),
    RootUserChanged(RootUser),
    NetworkChange {
        #[serde(flatten)]
        change: NetworkChange,
    },
    StorageChanged,
    QuestionsChanged,
    InstallationPhaseChanged {
        phase: InstallationPhase,
    },
    ServiceStatusChanged {
        service: String,
        status: u32,
    },
    ValidationChanged {
        service: String,
        path: String,
        errors: Vec<String>,
    },
    ISCSINodeAdded {
        node: ISCSINode,
    },
    ISCSINodeChanged {
        node: ISCSINode,
    },
    ISCSINodeRemoved {
        node: ISCSINode,
    },
    ISCSIInitiatorChanged {
        name: Option<String>,
        ibft: Option<bool>,
    },
    DASDDeviceAdded {
        device: DASDDevice,
    },
    DASDDeviceChanged {
        device: DASDDevice,
    },
    DASDDeviceRemoved {
        device: DASDDevice,
    },
    JobAdded {
        job: Job,
    },
    JobChanged {
        job: Job,
    },
    JobRemoved {
        job: Job,
    },
    DASDFormatJobChanged {
        #[serde(rename = "jobId")]
        job_id: String,
        summary: HashMap<String, DASDFormatSummary>,
    },
    ZFCPDiskAdded {
        device: ZFCPDisk,
    },
    ZFCPDiskChanged {
        device: ZFCPDisk,
    },
    ZFCPDiskRemoved {
        device: ZFCPDisk,
    },
    ZFCPControllerAdded {
        device: ZFCPController,
    },
    ZFCPControllerChanged {
        device: ZFCPController,
    },
    ZFCPControllerRemoved {
        device: ZFCPController,
    },
}

/// Makes it easier to create an event, reducing the boilerplate.
///
/// # Event without additional data
///
/// ```
/// # use agama_lib::{event, http::EventPayload};
/// let my_event = event!(ClientConnected);
/// assert!(matches!(my_event.payload, EventPayload::ClientConnected));
/// assert!(my_event.client_id.is_none());
/// ```
///
/// # Event with some additional data
///
/// ```
/// # use agama_lib::{event, http::EventPayload};
/// let my_event = event!(LocaleChanged { locale: "es_ES".to_string() });
/// assert!(matches!(
///    my_event.payload,
///    EventPayload::LocaleChanged { locale: _ }
/// ));
/// ```
///
/// # Adding the client ID
///
/// ```
/// # use agama_lib::{auth::ClientId, event, http::EventPayload};
/// let client_id = ClientId::new();
/// let my_event = event!(ClientConnected, &client_id);
/// assert!(matches!(my_event.payload, EventPayload::ClientConnected));
/// assert!(my_event.client_id.is_some());
/// ```
///
/// # Add the client ID to a complex event
///
/// ```
/// # use agama_lib::{auth::ClientId, event, http::EventPayload};
/// let client_id = ClientId::new();
/// let my_event = event!(LocaleChanged { locale: "es_ES".to_string() }, &client_id);
/// assert!(matches!(
///    my_event.payload,
///    EventPayload::LocaleChanged { locale: _ }
/// ));
/// assert!(my_event.client_id.is_some());
/// ```
#[macro_export]
macro_rules! event {
    ($variant:ident) => {
        agama_lib::http::OldEvent::new(agama_lib::http::EventPayload::$variant)
    };
    ($variant:ident, $client:expr) => {
        agama_lib::http::OldEvent::new_with_client_id(
            agama_lib::http::EventPayload::$variant,
            $client,
        )
    };
    ($variant:ident $inner:tt, $client:expr) => {
        agama_lib::http::OldEvent::new_with_client_id(
            agama_lib::http::EventPayload::$variant $inner,
            $client
        )
    };
    ($variant:ident $inner:tt) => {
        agama_lib::http::OldEvent::new(agama_lib::http::EventPayload::$variant $inner)
    };
}
