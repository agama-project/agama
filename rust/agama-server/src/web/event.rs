use crate::l10n::web::LocaleConfig;
use agama_lib::{manager::InstallationPhase, progress::Progress, software::SelectedBy, users::FirstUserSettings};
use serde::Serialize;
use std::collections::HashMap;
use tokio::sync::broadcast::{Receiver, Sender};

use super::common::Issue;

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type")]
pub enum Event {
    L10nConfigChanged(LocaleConfig),
    LocaleChanged {
        locale: String,
    },
    Progress {
        service: String,
        #[serde(flatten)]
        progress: Progress,
    },
    ProductChanged {
        id: String,
    },
    FirstUserChanged(FirstUserSettings),
    RootPasswordChanged {
        password_is_set: bool
    },
    RootSSHKeyChanged {
        key: Option<String>,
    },
    PatternsChanged(HashMap<String, SelectedBy>),
    QuestionsChanged,
    InstallationPhaseChanged {
        phase: InstallationPhase,
    },
    BusyServicesChanged {
        services: Vec<String>,
    },
    ServiceStatusChanged {
        service: String,
        status: u32,
    },
    IssuesChanged {
        service: String,
        path: String,
        issues: Vec<Issue>,
    },
}

pub type EventsSender = Sender<Event>;
pub type EventsReceiver = Receiver<Event>;
