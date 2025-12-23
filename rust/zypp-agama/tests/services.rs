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

use std::{fs, io, path::Path};

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}


#[test]
fn test_services() {
    let root_dir =
        env!("CARGO_MANIFEST_DIR").to_string() + "/fixtures/zypp_services_root";
    
    let zypp_root =
        env!("CARGO_MANIFEST_DIR").to_string() + "/fixtures/zypp_root_tmp";
    if fs::exists(&zypp_root).unwrap() {
        fs::remove_dir_all(&zypp_root).unwrap();
    }
    fs::create_dir_all(&zypp_root).unwrap();

    copy_dir_all(Path::new(&root_dir), Path::new(&zypp_root)).unwrap();

    let zypp = zypp_agama::Zypp::init_target(&zypp_root, |_,_,_| {}).unwrap();

    let service_url = "file:///service";
    println!("{}", service_url);
    
    zypp.add_service("test", service_url).unwrap();
    zypp.refresh_service("test").unwrap();

    let repos = zypp.list_repositories().unwrap();
    assert!(repos.len() == 2, "Unexpected repos count. Repos: {:#?}", repos);
}
