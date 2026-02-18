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

use zbus::{message::Type as MessageType, zvariant::OwnedObjectPath, MatchRule, MessageStream};

use crate::nm::error::NmError;

#[derive(Debug, Clone)]
pub enum NmChange {
    DeviceAdded(OwnedObjectPath),
    DeviceUpdated(OwnedObjectPath),
    DeviceRemoved(OwnedObjectPath),
    IP4ConfigChanged(OwnedObjectPath),
    IP6ConfigChanged(OwnedObjectPath),
    ConnectionAdded(OwnedObjectPath),
    ConnectionRemoved(OwnedObjectPath),
    ActiveConnectionAdded(OwnedObjectPath),
    ActiveConnectionUpdated(OwnedObjectPath),
    ActiveConnectionRemoved(OwnedObjectPath),
}

pub async fn build_added_and_removed_stream(
    connection: &zbus::Connection,
) -> Result<MessageStream, NmError> {
    let rule = MatchRule::builder()
        .msg_type(MessageType::Signal)
        .path("/org/freedesktop")?
        .interface("org.freedesktop.DBus.ObjectManager")?
        .build();
    let stream = MessageStream::for_match_rule(rule, connection, Some(1)).await?;
    Ok(stream)
}

/// Returns a stream of properties changes to be used by DeviceChangedStream.
///
/// It listens for changes in several objects that are related to a network device.
pub async fn build_properties_changed_stream(
    connection: &zbus::Connection,
) -> Result<MessageStream, NmError> {
    let rule = MatchRule::builder()
        .msg_type(MessageType::Signal)
        .interface("org.freedesktop.DBus.Properties")?
        .member("PropertiesChanged")?
        .build();
    let stream = MessageStream::for_match_rule(rule, connection, Some(1)).await?;
    Ok(stream)
}
