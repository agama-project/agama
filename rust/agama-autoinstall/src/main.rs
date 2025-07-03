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

use agama_autoinstall::{AutoInstallRunner, CmdlineArgs};
use agama_lib::{auth::AuthToken, http::BaseHTTPClient};
use anyhow::anyhow;

const CMDLINE_FILE: &str = "/run/agama/cmdline.d/agama.conf";
const KNOWN_LOCATIONS: [&str; 6] = [
    "label://OEMDRV/autoinst.jsonnet",
    "label://OEMDRV/autoinst.json",
    "label://OEMDRV/autoinst.xml",
    "file:///autoinst.jsonnet",
    "file:///autoinst.json",
    "file:///autoinst.xml",
];
const API_URL: &str = "http://localhost/api";

// async fn run_auto_install() -> anyhow::Result<()> {
// }

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = CmdlineArgs::parse_file(CMDLINE_FILE)?;
    let token = AuthToken::master().ok_or(anyhow!("Could not find the master token"))?;
    let http = BaseHTTPClient::new(API_URL)?.authenticated(&token)?;

    let mut runner = AutoInstallRunner::new(http, &KNOWN_LOCATIONS)?;
    if let Some(user_url) = args.get("inst.auto") {
        runner.with_user_url(user_url);
    }
    runner.run().await?;
    Ok(())
}
