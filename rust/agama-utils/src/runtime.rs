// Copyright (c) [2026] SUSE LLC
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

//! Tokio runtime utilities.

use std::future::Future;

/// Maximum number of worker threads for the Tokio runtime.
const MAX_WORKER_THREADS: usize = 32;

/// Creates a multi-threaded Tokio runtime with a capped number of worker threads.
///
/// The runtime will use `min(available_cores, 32)` worker threads. If the number of
/// cores cannot be determined, it falls back to tokio's default behavior.
///
/// # Example
///
/// ```no_run
/// use agama_utils::runtime::create_runtime;
///
/// let runtime = create_runtime().expect("Failed to create Tokio runtime");
/// runtime.block_on(async {
///     // Your async code here
/// });
/// ```
pub fn create_runtime() -> std::io::Result<tokio::runtime::Runtime> {
    let mut builder = tokio::runtime::Builder::new_multi_thread();

    // Cap worker threads at MAX_WORKER_THREADS if we can determine the core count
    if let Ok(cores) = std::thread::available_parallelism() {
        builder.worker_threads(cores.get().min(MAX_WORKER_THREADS));
    }

    builder.enable_all().build()
}

/// Runs an async function on a custom Tokio runtime with capped worker threads.
///
/// This is a convenience wrapper that creates a runtime with `create_runtime()` and
/// executes the provided future on it. The runtime will use `min(available_cores, 32)`
/// worker threads.
///
/// # Panics
///
/// Panics if the Tokio runtime cannot be created.
///
/// # Example
///
/// ```no_run
/// use agama_utils::runtime::run_async;
///
/// fn main() -> std::io::Result<()> {
///     run_async(async {
///         // Your async code here
///         Ok(())
///     })
/// }
/// ```
pub fn run_async<F, T>(future: F) -> T
where
    F: Future<Output = T>,
{
    let runtime = create_runtime().expect("Failed to create Tokio runtime");
    runtime.block_on(future)
}
