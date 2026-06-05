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

use agama_cli::{build_cli, run_command, CliResult};
use agama_l10n::helpers as l10n_helpers;

#[tokio::main]
async fn main() -> CliResult {
    _ = l10n_helpers::init_locale();
    let matches = build_cli().get_matches();

    if let Err(error) = run_command(matches).await {
        eprintln!("{:?}", error);
        return CliResult::Error;
    }
    CliResult::Ok
}
