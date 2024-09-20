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

use core::fmt;
use std::collections::HashMap;

use crate::{
    dbus::{extract_id_from_path, get_property},
    error::ServiceError,
    storage::proxies::{InitiatorProxy, NodeProxy},
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use zbus::{
    fdo::ObjectManagerProxy,
    zvariant::{self, ObjectPath, OwnedValue, Value},
    Connection,
};

#[derive(Serialize, utoipa::ToSchema)]
pub struct ISCSIInitiator {
    name: String,
    ibft: bool,
}

#[derive(Clone, Debug, Default, Serialize, utoipa::ToSchema)]
/// ISCSI node
pub struct ISCSINode {
    /// Artificial ID to match it against the D-Bus backend.
    pub id: u32,
    /// Target name.
    pub target: String,
    /// Target IP address (in string-like form).
    pub address: String,
    /// Target port.
    pub port: u32,
    /// Interface name.
    pub interface: String,
    /// Whether the node was initiated by iBFT
    pub ibft: bool,
    /// Whether the node is connected (there is a session).
    pub connected: bool,
    /// Startup status (TODO: document better)
    pub startup: String,
}

impl TryFrom<&HashMap<String, OwnedValue>> for ISCSINode {
    type Error = ServiceError;

    fn try_from(value: &HashMap<String, OwnedValue>) -> Result<Self, Self::Error> {
        Ok(ISCSINode {
            id: 0,
            target: get_property(value, "Target")?,
            address: get_property(value, "Address")?,
            interface: get_property(value, "Interface")?,
            port: get_property(value, "Port")?,
            ibft: get_property(value, "IBFT")?,
            connected: get_property(value, "Connected")?,
            startup: get_property(value, "Startup")?,
        })
    }
}

#[derive(Clone, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct ISCSIAuth {
    /// Username for authentication by target.
    pub username: Option<String>,
    /// Password for authentication by target.
    pub password: Option<String>,
    /// Username for authentication by initiator.
    pub reverse_username: Option<String>,
    /// Password for authentication by initiator.
    pub reverse_password: Option<String>,
}

impl From<ISCSIAuth> for HashMap<String, OwnedValue> {
    fn from(value: ISCSIAuth) -> Self {
        let mut hash = HashMap::new();

        if let Some(username) = value.username {
            hash.insert("Username".to_string(), Value::new(username).to_owned());
        }

        if let Some(password) = value.password {
            hash.insert("Password".to_string(), Value::new(password).to_owned());
        }

        if let Some(reverse_username) = value.reverse_username {
            hash.insert(
                "ReverseUsername".to_string(),
                Value::new(reverse_username).to_owned(),
            );
        }

        if let Some(reverse_password) = value.reverse_password {
            hash.insert(
                "ReversePassword".to_string(),
                Value::new(reverse_password).to_owned(),
            );
        }

        hash
    }
}

/// D-Bus client for the ISCSI part of the storage service.
#[derive(Clone)]
pub struct ISCSIClient<'a> {
    connection: zbus::Connection,
    initiator_proxy: InitiatorProxy<'a>,
    object_manager_proxy: ObjectManagerProxy<'a>,
}

impl<'a> ISCSIClient<'a> {
    pub async fn new(connection: Connection) -> Result<ISCSIClient<'a>, ServiceError> {
        let initiator_proxy = InitiatorProxy::builder(&connection)
            .destination("org.opensuse.Agama.Storage1")?
            .path("/org/opensuse/Agama/Storage1")?
            .build()
            .await?;

        let object_manager_proxy = ObjectManagerProxy::builder(&connection)
            .destination("org.opensuse.Agama.Storage1")?
            .path("/org/opensuse/Agama/Storage1")?
            .build()
            .await?;

        Ok(Self {
            connection,
            initiator_proxy,
            object_manager_proxy,
        })
    }

    /// Performs an iSCSI discovery.
    ///
    /// It returns true when the discovery was successful.
    ///
    /// * `address`: target address in string-like form.
    /// * `port`: target port.
    /// * `auth`: authentication options.
    pub async fn discover<'b>(
        &self,
        address: &str,
        port: u32,
        auth: ISCSIAuth,
    ) -> Result<bool, ServiceError> {
        let mut options_hash: HashMap<&str, zvariant::Value> = HashMap::new();

        if let (Some(ref username), Some(ref password)) = (auth.username, auth.password) {
            options_hash.insert("Username", username.to_string().into());
            options_hash.insert("Password", password.to_string().into());
        }

        if let (Some(ref username), Some(ref password)) =
            (auth.reverse_username, auth.reverse_password)
        {
            options_hash.insert("ReverseUsername", username.to_string().into());
            options_hash.insert("ReversePassword", password.to_string().into());
        }

        let mut options_ref: HashMap<&str, &zvariant::Value<'_>> = HashMap::new();
        for (key, value) in options_hash.iter() {
            options_ref.insert(key, value);
        }

        let result = self
            .initiator_proxy
            .discover(address, port, options_ref)
            .await?;
        Ok(result == 0)
    }

    /// Returns the initiator data.
    pub async fn get_initiator(&self) -> Result<ISCSIInitiator, ServiceError> {
        let ibft = self.initiator_proxy.ibft().await?;
        let name = self.initiator_proxy.initiator_name().await?;
        Ok(ISCSIInitiator { name, ibft })
    }

    /// Sets the initiator name.
    ///
    /// * `name`: new name.
    pub async fn set_initiator_name(&self, name: &str) -> Result<(), ServiceError> {
        Ok(self.initiator_proxy.set_initiator_name(name).await?)
    }

    /// Returns the iSCSI nodes.
    pub async fn get_nodes(&self) -> Result<Vec<ISCSINode>, ServiceError> {
        let managed_objects = self.object_manager_proxy.get_managed_objects().await?;

        let mut nodes: Vec<ISCSINode> = vec![];
        for (path, ifaces) in managed_objects {
            if let Some(properties) = ifaces.get("org.opensuse.Agama.Storage1.ISCSI.Node") {
                let id = extract_id_from_path(&path).unwrap_or(0);
                match ISCSINode::try_from(properties) {
                    Ok(mut node) => {
                        node.id = id;
                        nodes.push(node);
                    }
                    Err(error) => {
                        log::warn!("Not a valid iSCSI node: {}", error);
                    }
                }
            }
        }
        Ok(nodes)
    }

    /// Sets the startup for a ISCSI node.
    ///
    /// * `id`: node ID.
    /// * `startup`: new startup value.
    pub async fn set_startup(&self, id: u32, startup: &str) -> Result<(), ServiceError> {
        let proxy = self.get_node_proxy(id).await?;
        Ok(proxy.set_startup(startup).await?)
    }

    pub async fn login(
        &self,
        id: u32,
        auth: ISCSIAuth,
        startup: String,
    ) -> Result<LoginResult, ServiceError> {
        let proxy = self.get_node_proxy(id).await?;

        let mut options: HashMap<String, OwnedValue> = auth.into();
        options.insert("Startup".to_string(), Value::new(startup).to_owned());

        // FIXME: duplicated code (see discover)
        let mut options_ref: HashMap<&str, &zvariant::Value<'_>> = HashMap::new();
        for (key, value) in options.iter() {
            options_ref.insert(key, value);
        }
        let result = proxy.login(options_ref).await?;
        let result =
            LoginResult::try_from(result).map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;
        Ok(result)
    }

    pub async fn logout(&self, id: u32) -> Result<bool, ServiceError> {
        let proxy = self.get_node_proxy(id).await?;
        let result = proxy.logout().await?;
        Ok(result == 0)
    }

    pub async fn delete_node(&self, id: u32) -> Result<(), ServiceError> {
        let path = format!("/org/opensuse/Agama/Storage1/iscsi_nodes/{}", id);
        let path = ObjectPath::from_string_unchecked(path);
        self.initiator_proxy.delete(&path).await?;
        Ok(())
    }

    pub async fn get_node_proxy(&self, id: u32) -> Result<NodeProxy, ServiceError> {
        let proxy = NodeProxy::builder(&self.connection)
            .path(format!("/org/opensuse/Agama/Storage1/iscsi_nodes/{}", id))?
            .build()
            .await?;
        Ok(proxy)
    }
}

#[derive(Serialize, utoipa::ToSchema)]
pub enum LoginResult {
    /// Successful login.
    Success = 0,
    /// Invalid startup value.
    InvalidStartup = 1,
    /// Failed login.
    Failed = 2,
}

#[derive(Debug, Error, PartialEq)]
#[error("Invalid iSCSI login result: {0}")]
pub struct InvalidLoginResult(u32);

impl TryFrom<u32> for LoginResult {
    type Error = InvalidLoginResult;

    fn try_from(value: u32) -> Result<Self, Self::Error> {
        match value {
            v if v == Self::Success as u32 => Ok(Self::Success),
            v if v == Self::InvalidStartup as u32 => Ok(Self::InvalidStartup),
            v if v == Self::Failed as u32 => Ok(Self::Failed),
            _ => Err(InvalidLoginResult(value)),
        }
    }
}

// TODO: the error description should come from the backend (as in deregister)
impl fmt::Display for LoginResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Success => write!(f, "Success"),
            Self::InvalidStartup => write!(f, "Invalid startup value"),
            Self::Failed => write!(f, "Could not login into the iSCSI node"),
        }
    }
}
