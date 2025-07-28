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

use std::str::FromStr;

use agama_autoinstall::{ConfigAutoLoader, KernelCmdline, ScriptsRunner};
use agama_lib::{
    auth::AuthToken,
    http::BaseHTTPClient,
    manager::{FinishMethod, ManagerHTTPClient},
};
use anyhow::anyhow;

const CMDLINE_FILE: &str = "/run/agama/cmdline.d/agama.conf";
const API_URL: &str = "http://localhost/api";

pub fn build_base_client() -> anyhow::Result<BaseHTTPClient> {
    let token = AuthToken::master().ok_or(anyhow!("Could not find the master token"))?;
    Ok(BaseHTTPClient::new(API_URL)?.authenticated(&token)?)
}

pub fn insecure_from(cmdline: &KernelCmdline, key: &str) -> bool {
    let value = cmdline.get_last(key);
    Some("1".to_string()) == value
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = KernelCmdline::parse_file(CMDLINE_FILE)?;
    let http = build_base_client()?;
    let manager_client = ManagerHTTPClient::new(http.clone());

    let scripts = args.get("inst.script");
    let script_insecure = insecure_from(&args, "inst.script_insecure");
    let mut runner = ScriptsRunner::new(http.clone(), "/run/agama/inst-scripts", script_insecure);
    for url in scripts {
        println!("Running script from {}", &url);
        if let Err(error) = runner.run(&url).await {
            eprintln!("Error running the script from {url}: {}", error);
        }
    }

    let auto_insecure = insecure_from(&args, "inst.auto_insecure");
    let loader = ConfigAutoLoader::new(http.clone(), auto_insecure)?;
    let urls = args.get("inst.auto");
    if let Err(error) = loader.load(&urls).await {
        eprintln!("Skipping the auto-installation: {error}");
        return Ok(());
    }

    if let Some(should_install) = args.get("inst.install").first() {
        if should_install == "0" {
            println!("Skipping the auto-installation on user's request (inst.install=0)");
            return Ok(());
        }
    }

    manager_client.install().await?;

    let method = args
        .get("inst.finish")
        .first()
        .and_then(|m| FinishMethod::from_str(m).ok())
        .unwrap_or_default();
    manager_client.finish(method).await?;

    Ok(())
}
