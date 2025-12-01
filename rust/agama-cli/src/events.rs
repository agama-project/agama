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

use agama_lib::http::WebSocketClient;

/// Main entry point called from Agama CLI main loop
pub async fn run(mut ws_client: WebSocketClient, pretty: bool) -> anyhow::Result<()> {
    loop {
        let event = ws_client.receive_old_events().await?;
        let conversion = if pretty {
            serde_json::to_string_pretty(&event)
        } else {
            serde_json::to_string(&event)
        };

        match conversion {
            Ok(event_json) => println!("{}", event_json),
            Err(_) => eprintln!("Could not serialize {:?}", &event),
        }
    }
}
