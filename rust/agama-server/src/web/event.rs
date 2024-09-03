use crate::network::model::NetworkChange;
use agama_lib::{
    jobs::Job,
    localization::model::LocaleConfig,
    manager::InstallationPhase,
    product::RegistrationRequirement,
    progress::Progress,
    software::SelectedBy,
    storage::{
        model::{
            dasd::{DASDDevice, DASDFormatSummary},
            zfcp::{ZFCPController, ZFCPDisk},
        },
        ISCSINode,
    },
    users::FirstUser,
};
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
    DevicesDirty {
        dirty: bool,
    },
    Progress {
        service: String,
        #[serde(flatten)]
        progress: Progress,
    },
    ProductChanged {
        id: String,
    },
    RegistrationRequirementChanged {
        requirement: RegistrationRequirement,
    },
    RegistrationChanged,
    FirstUserChanged(FirstUser),
    RootChanged {
        password: Option<bool>,
        sshkey: Option<String>,
    },
    NetworkChange {
        #[serde(flatten)]
        change: NetworkChange,
    },
    // TODO: it should include the full software proposal or, at least,
    // all the relevant changes.
    SoftwareProposalChanged {
        patterns: HashMap<String, SelectedBy>,
    },
    QuestionsChanged,
    InstallationPhaseChanged {
        phase: InstallationPhase,
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

pub type EventsSender = Sender<Event>;
pub type EventsReceiver = Receiver<Event>;
