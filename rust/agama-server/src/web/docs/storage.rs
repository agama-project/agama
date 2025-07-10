// Copyright (c) [2024] SUSE LLC
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

use utoipa::openapi::{Components, ComponentsBuilder, OpenApi, Paths, PathsBuilder};

use super::{
    common::{IssuesApiDocBuilder, ProgressApiDocBuilder, ServiceStatusApiDocBuilder},
    ApiDocBuilder,
};

pub struct StorageApiDocBuilder;

impl ApiDocBuilder for StorageApiDocBuilder {
    fn title(&self) -> String {
        "Storage HTTP API".to_string()
    }

    fn paths(&self) -> Paths {
        PathsBuilder::new()
            .path_from::<crate::storage::web::__path_actions>()
            .path_from::<crate::storage::web::__path_devices_dirty>()
            .path_from::<crate::storage::web::__path_get_proposal_settings>()
            .path_from::<crate::storage::web::__path_probe>()
            .path_from::<crate::storage::web::__path_product_params>()
            .path_from::<crate::storage::web::__path_set_proposal_settings>()
            .path_from::<crate::storage::web::__path_staging_devices>()
            .path_from::<crate::storage::web::__path_system_devices>()
            .path_from::<crate::storage::web::__path_available_drives>()
            .path_from::<crate::storage::web::__path_candidate_drives>()
            .path_from::<crate::storage::web::__path_available_md_raids>()
            .path_from::<crate::storage::web::__path_candidate_md_raids>()
            .path_from::<crate::storage::web::__path_volume_for>()
            .path_from::<crate::storage::web::dasd::__path_devices>()
            .path_from::<crate::storage::web::dasd::__path_disable>()
            .path_from::<crate::storage::web::dasd::__path_enable>()
            .path_from::<crate::storage::web::dasd::__path_format>()
            .path_from::<crate::storage::web::dasd::__path_probe>()
            .path_from::<crate::storage::web::dasd::__path_set_diag>()
            .path_from::<crate::storage::web::dasd::__path_supported>()
            .path_from::<crate::storage::web::dasd::__path_get_config>()
            .path_from::<crate::storage::web::dasd::__path_set_config>()
            .path_from::<crate::storage::web::iscsi::__path_delete_node>()
            .path_from::<crate::storage::web::iscsi::__path_discover>()
            .path_from::<crate::storage::web::iscsi::__path_initiator>()
            .path_from::<crate::storage::web::iscsi::__path_login_node>()
            .path_from::<crate::storage::web::iscsi::__path_logout_node>()
            .path_from::<crate::storage::web::iscsi::__path_nodes>()
            .path_from::<crate::storage::web::iscsi::__path_update_initiator>()
            .path_from::<crate::storage::web::iscsi::__path_update_node>()
            .path_from::<crate::storage::web::iscsi::__path_set_config>()
            .path_from::<crate::storage::web::zfcp::__path_activate_controller>()
            .path_from::<crate::storage::web::zfcp::__path_activate_controller>()
            .path_from::<crate::storage::web::zfcp::__path_activate_disk>()
            .path_from::<crate::storage::web::zfcp::__path_controllers>()
            .path_from::<crate::storage::web::zfcp::__path_deactivate_disk>()
            .path_from::<crate::storage::web::zfcp::__path_get_global_config>()
            .path_from::<crate::storage::web::zfcp::__path_get_disks>()
            .path_from::<crate::storage::web::zfcp::__path_get_luns>()
            .path_from::<crate::storage::web::zfcp::__path_get_wwpns>()
            .path_from::<crate::storage::web::zfcp::__path_probe>()
            .path_from::<crate::storage::web::zfcp::__path_supported>()
            .build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new()
            .schema_from::<agama_lib::issue::Issue>()
            .schema_from::<agama_lib::storage::client::iscsi::ISCSIAuth>()
            .schema_from::<agama_lib::storage::client::iscsi::ISCSIInitiator>()
            .schema_from::<agama_lib::storage::client::iscsi::ISCSINode>()
            .schema_from::<agama_lib::storage::client::iscsi::LoginResult>()
            .schema_from::<agama_lib::storage::model::Action>()
            .schema_from::<agama_lib::storage::model::BlockDevice>()
            .schema_from::<agama_lib::storage::model::Component>()
            .schema_from::<agama_lib::storage::model::Device>()
            .schema_from::<agama_lib::storage::model::DeviceInfo>()
            .schema_from::<agama_lib::storage::model::DeviceSid>()
            .schema_from::<agama_lib::storage::model::DeviceSize>()
            .schema_from::<agama_lib::storage::model::Drive>()
            .schema_from::<agama_lib::storage::model::DriveInfo>()
            .schema_from::<agama_lib::storage::model::Filesystem>()
            .schema_from::<agama_lib::storage::model::LvmLv>()
            .schema_from::<agama_lib::storage::model::LvmVg>()
            .schema_from::<agama_lib::storage::model::Md>()
            .schema_from::<agama_lib::storage::model::Multipath>()
            .schema_from::<agama_lib::storage::model::Partition>()
            .schema_from::<agama_lib::storage::model::PartitionTable>()
            .schema_from::<agama_lib::storage::model::ProposalSettings>()
            .schema_from::<agama_lib::storage::model::ProposalSettingsPatch>()
            .schema_from::<agama_lib::storage::model::ProposalTarget>()
            .schema_from::<agama_lib::storage::model::Raid>()
            .schema_from::<agama_lib::storage::model::ShrinkingInfo>()
            .schema_from::<agama_lib::storage::model::SpaceAction>()
            .schema_from::<agama_lib::storage::model::SpaceActionSettings>()
            .schema_from::<agama_lib::storage::model::UnusedSlot>()
            .schema_from::<agama_lib::storage::model::Volume>()
            .schema_from::<agama_lib::storage::model::VolumeOutline>()
            .schema_from::<agama_lib::storage::model::VolumeTarget>()
            .schema_from::<agama_lib::storage::model::dasd::DASDDevice>()
            .schema_from::<agama_lib::storage::settings::dasd::DASDConfig>()
            .schema_from::<agama_lib::storage::settings::dasd::DASDDeviceConfig>()
            .schema_from::<agama_lib::storage::settings::dasd::DASDDeviceState>()
            .schema_from::<agama_lib::storage::model::zfcp::ZFCPController>()
            .schema_from::<agama_lib::storage::model::zfcp::ZFCPDisk>()
            .schema_from::<crate::storage::web::ProductParams>()
            .schema_from::<crate::storage::web::iscsi::DiscoverParams>()
            .schema_from::<crate::storage::web::iscsi::InitiatorParams>()
            .schema_from::<crate::storage::web::iscsi::LoginParams>()
            .schema_from::<crate::storage::web::iscsi::NodeParams>()
            .schema_from::<crate::storage::web::zfcp::ZFCPGlobalConfig>()
            .build()
    }

    fn nested(&self) -> Option<OpenApi> {
        let mut issues = IssuesApiDocBuilder::new()
            .add(
                "/api/storage/issues",
                "List of storage-related issues",
                "storage_issues",
            )
            .build();
        let status = ServiceStatusApiDocBuilder::new("/api/storage/status").build();
        let progress = ProgressApiDocBuilder::new("/api/storage/progress").build();
        issues.merge(status);
        issues.merge(progress);
        Some(issues)
    }
}
