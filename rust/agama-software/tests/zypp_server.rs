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

use agama_software::zypp_server::ZyppServer;
use tempfile::tempdir;

#[tokio::test]
async fn test_start_zypp_server() {
    // This is a skeleton test for ZyppServer.
    // It ensures that the server can be started without panicking.
    // The test uses a temporary directory for the Zypp target, so it does not
    // affect the host system.
    let root_dir = tempdir().unwrap();
    let _client = ZyppServer::start(root_dir.path()).unwrap();
}
