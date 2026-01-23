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

//! This crate offers a set of utility struct and functions to be used accross
//! other Agama's crates.

pub mod actor;
pub mod api;
pub mod arch;
pub mod command;
pub mod dbus;
pub mod issue;
pub mod kernel_cmdline;
pub mod licenses;
pub mod openapi;
pub mod products;
pub mod progress;
pub mod question;
pub mod test;

/// Does nothing at runtime, marking the text for translation.
///
/// This is useful when you need both the untranslated id
/// and its translated label, for example.
pub fn gettext_noop(text: &str) -> &str {
    text
}

pub mod helpers {
    use std::{fs, io, path::Path};

    /// Copy the files in the `src` directory to `dst`.
    ///
    /// It does not perform a recursive copy.
    pub fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> io::Result<()> {
        fs::create_dir_all(&dst)?;

        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let file_type = entry.file_type()?;

            if file_type.is_file() {
                std::fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
            }
        }

        Ok(())
    }
}
