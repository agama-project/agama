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

use crate::Message;
use agama_locale_data::{KeymapId, LocaleId};
use agama_utils::dbus::{get_property, to_owned_hash};
use tokio::sync::mpsc;
use tokio_stream::StreamExt;
use zbus::fdo::PropertiesProxy;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Monitor could not send the message to the service")]
    Send(#[from] mpsc::error::SendError<Message>),
    #[error(transparent)]
    DBus(#[from] zbus::Error),
}

pub struct Monitor<'a> {
    channel: mpsc::UnboundedSender<Message>,
    proxy: PropertiesProxy<'a>,
}

impl<'a> Monitor<'a> {
    pub async fn new(channel: mpsc::UnboundedSender<Message>) -> Result<Self, Error> {
        let dbus = zbus::Connection::system().await?;
        let proxy = PropertiesProxy::builder(&dbus)
            .path("/org/freedesktop/locale1")?
            .destination("org.freedesktop.locale1")?
            .build()
            .await?;
        Ok(Self { channel, proxy })
    }

    pub async fn run(&mut self) -> Result<(), Error> {
        let mut stream = self
            .proxy
            .receive_properties_changed()
            .await
            .map_err(Error::DBus)?;

        while let Some(changes) = stream.next().await {
            let Ok(args) = changes.args() else {
                continue;
            };

            let changes = args.changed_properties();
            let Ok(changes) = to_owned_hash(changes) else {
                continue;
            };

            if let Ok(locales) = get_property::<Vec<String>>(&changes, "Locale") {
                let Some(locale) = locales.first() else {
                    continue;
                };

                let locale_id = locale
                    .strip_prefix("LANG=")
                    .and_then(|l| l.parse::<LocaleId>().ok());

                if let Some(locale_id) = locale_id {
                    _ = self
                        .channel
                        .send(Message::UpdateLocale { locale: locale_id });
                }
            }
            if let Ok(keymap) = get_property::<String>(&changes, "VConsoleKeymap") {
                if let Ok(keymap) = keymap.parse::<KeymapId>() {
                    _ = self.channel.send(Message::UpdateKeymap { keymap })?;
                }
            }
        }

        Ok(())
    }
}
