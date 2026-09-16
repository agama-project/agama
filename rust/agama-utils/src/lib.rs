// Copyright (c) [2025-2026] SUSE LLC
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
pub mod arch;
pub mod command;
pub mod dbus;
pub mod issue;
pub mod licenses;
pub mod logging;
pub mod message;
pub mod products;
pub mod progress;
pub mod question;
pub mod runtime;
pub mod test;

// `api`, `kernel_cmdline` and `openapi` live in their own crate
// (agama-api-types), which carries almost all of the schema/derive-heavy
// code in what used to be agama-utils. Re-exporting them here keeps every
// existing `agama_utils::api::...`/`agama_utils::kernel_cmdline::...`/
// `agama_utils::openapi::...` path working unchanged, while letting Cargo
// treat the derive-heavy code as a separate compilation unit: touching an
// unrelated part of agama-utils (this crate) no longer forces recompiling
// it, and vice versa. See spec/0003-reduce-build-time/plan.md.
pub use agama_api_types as api;
pub use agama_api_types::kernel_cmdline;
pub use agama_api_types::openapi;

mod resolvable;
pub use resolvable::{Resolvable, ResolvableType};

use std::future::Future;
use std::pin::Pin;

/// A pinned, boxed, and sendable future.
pub type BoxFuture<T> = Pin<Box<dyn Future<Output = T> + Send + 'static>>;

/// Does nothing at runtime, marking the text for translation.
///
/// This is useful when you need both the untranslated id
/// and its translated label, for example.
pub fn gettext_noop(text: &str) -> &str {
    text
}

/// Build an argument for clap::Command::long_about
///
/// This is related to not repeating .about(short) as a prefix of .long_about(long),
/// to not duplicate work of human translators.
pub fn make_long(short: &str, long_tail: &str) -> String {
    short.to_owned() + ".\n\n" + long_tail
}

pub mod helpers {
    use camino::Utf8Path;
    use fs_err as fs;

    /// Recursively copies a directory.
    ///
    /// It copies the content of the `source` directory to the `target` directory.
    /// It preserves the directory structure and the files content.
    ///
    /// Symlinks are recreated pointing to the same target as the original one.
    pub fn copy_dir_all(source: &Utf8Path, target: &Utf8Path) -> Result<(), std::io::Error> {
        fs::create_dir_all(target)?;
        for entry in source.read_dir_utf8()? {
            let entry = entry?;
            let ty = fs::symlink_metadata(entry.path())?;
            let dst = target.join(entry.file_name());
            if ty.is_dir() {
                copy_dir_all(entry.path(), &dst)?;
            } else if ty.is_symlink() {
                // we need special handling of symlinks as libzypp do
                // some tricks with danglinks symlinks and we should not
                // break it
                let link_dest = entry.path().read_link_utf8()?;
                tracing::info!(
                    "Recreating symlink from {} to {} pointing to {}",
                    entry.path().to_string(),
                    dst.to_string(),
                    link_dest.to_string(),
                );
                fs_err::os::unix::fs::symlink(link_dest, &dst)?;
            } else {
                tracing::info!(
                    "Copying from {} to {}",
                    entry.path().to_string(),
                    dst.to_string()
                );
                fs::copy(entry.path(), &dst)?;
            }
        }

        Ok(())
    }
}
