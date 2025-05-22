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
    jobs::Job,
    localization::model::LocaleConfig,
    manager::InstallationPhase,
    network::model::NetworkChange,
    progress::Progress,
    software::{model::Conflict, SelectedBy},
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

use crate::issue::Issue;

#[derive(Clone, Debug, Deserialize, Serialize)]
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
    RegistrationChanged,
    FirstUserChanged(FirstUser),
    RootUserChanged(RootUser),
    NetworkChange {
        #[serde(flatten)]
        change: NetworkChange,
    },
    // TODO: it should include the full software proposal or, at least,
    // all the relevant changes.
    SoftwareProposalChanged {
        patterns: HashMap<String, SelectedBy>,
    },
    ConflictsChanged {
        conflicts: Vec<Conflict>,
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
