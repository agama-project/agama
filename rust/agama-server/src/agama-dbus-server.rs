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

use agama_server::{
    l10n::{self, helpers},
    logs::init_logging,
    questions,
};

use agama_lib::connection_to;
use anyhow::Context;
use std::future::pending;

const ADDRESS: &str = "unix:path=/run/agama/bus";
const SERVICE_NAME: &str = "org.opensuse.Agama1";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let locale = helpers::init_locale()?;
    init_logging().context("Could not initialize the logger")?;

    let connection = connection_to(ADDRESS)
        .await
        .expect("Could not connect to the D-Bus daemon");

    // When adding more services here, the order might be important.
    questions::export_dbus_objects(&connection).await?;
    log::info!("Started questions interface");
    l10n::export_dbus_objects(&connection, &locale).await?;
    log::info!("Started locale interface");

    connection
        .request_name(SERVICE_NAME)
        .await
        .context(format!("Requesting name {SERVICE_NAME}"))?;

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
