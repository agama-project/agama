//! Safe Rust API on top of libstorage-ng.
//!
//! It wraps the raw bindings from [libstorage_ng_agama_sys]. At this point, it only allows probing
//! the system and listing the probed disks.
//!
//! When working on the real system, libstorage-ng takes a lock when creating a [Storage] object, so
//! only one instance can exist at the same time in the whole system.
//!
//! ```no_run
//! use libstorage_ng_agama::{ProbeMode, Storage};
//!
//! # fn main() -> Result<(), libstorage_ng_agama::Error> {
//! let mut storage = Storage::new(ProbeMode::Standard)?;
//! storage.probe()?;
//! for disk in storage.probed_disks()? {
//!     println!("{}: {} bytes", disk.name, disk.size);
//! }
//! # Ok(())
//! # }
//! ```

use libstorage_ng_agama_sys as sys;
use std::{
    ffi::{CStr, CString, NulError},
    marker::PhantomData,
    os::raw::c_char,
    path::{Path, PathBuf},
    ptr::NonNull,
};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// Error reported by libstorage-ng.
    #[error("libstorage-ng error: {0}")]
    Storage(String),
    #[error("Invalid mockup path: {0}")]
    InvalidPath(#[from] NulError),
}

/// How to probe the system.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProbeMode {
    /// Probe the real system (requires root).
    Standard,
    /// Fake probing based on a mockup file (no root required).
    ReadMockup(PathBuf),
}

/// Disk found by the probing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Disk {
    /// Kernel name, e.g., "/dev/sda".
    pub name: String,
    pub sysfs_path: String,
    /// Size in bytes.
    pub size: u64,
}

/// Entry point to libstorage-ng.
pub struct Storage {
    handle: NonNull<sys::StorageHandle>,
    // libstorage-ng is not known to be thread safe.
    _not_send_sync: PhantomData<*const ()>,
}

impl Storage {
    /// Creates a new storage object, without probing the system.
    pub fn new(mode: ProbeMode) -> Result<Self, Error> {
        let (mode, input) = match mode {
            ProbeMode::Standard => (sys::ProbeMode_PROBE_STANDARD, None),
            ProbeMode::ReadMockup(path) => (
                sys::ProbeMode_PROBE_READ_MOCKUP,
                Some(path_to_cstring(&path)?),
            ),
        };
        let input_ptr = input.as_ref().map_or(std::ptr::null(), |i| i.as_ptr());

        let mut status = sys::Status::default();
        // SAFETY: the pointers are valid for the duration of the call.
        let handle = unsafe { sys::storage_new(true, mode, input_ptr, &mut status) };
        check_status(&mut status)?;

        let handle = NonNull::new(handle)
            .ok_or_else(|| Error::Storage("libstorage-ng returned no handle".to_string()))?;
        Ok(Self {
            handle,
            _not_send_sync: PhantomData,
        })
    }

    /// Probes the system.
    pub fn probe(&mut self) -> Result<(), Error> {
        let mut status = sys::Status::default();
        // SAFETY: the handle is valid until the object is dropped.
        unsafe { sys::storage_probe(self.handle.as_ptr(), &mut status) };
        check_status(&mut status)
    }

    /// Disks from the probed devicegraph.
    pub fn probed_disks(&self) -> Result<Vec<Disk>, Error> {
        let mut status = sys::Status::default();
        // SAFETY: the handle is valid until the object is dropped.
        let mut list = unsafe { sys::storage_probed_disks(self.handle.as_ptr(), &mut status) };

        let result = check_status(&mut status).map(|_| {
            // SAFETY: on success, `disks` points to `len` initialized elements.
            let disks = unsafe { raw_slice(list.disks, list.len) };
            disks
                .iter()
                .map(|d| Disk {
                    name: c_string(d.name),
                    sysfs_path: c_string(d.sysfs_path),
                    size: d.size,
                })
                .collect()
        });

        // SAFETY: the list was returned by `storage_probed_disks` and it is not used anymore.
        unsafe { sys::storage_disk_list_free(&mut list) };
        result
    }
}

impl Drop for Storage {
    fn drop(&mut self) {
        // SAFETY: the handle was created by `storage_new` and it is not used anymore.
        unsafe { sys::storage_free(self.handle.as_ptr()) };
    }
}

fn path_to_cstring(path: &Path) -> Result<CString, Error> {
    Ok(CString::new(path.to_string_lossy().as_bytes())?)
}

/// Converts a status into a result, releasing the status.
fn check_status(status: &mut sys::Status) -> Result<(), Error> {
    if status.ok {
        return Ok(());
    }

    let message = c_string(status.message);
    // SAFETY: the status was filled by the C layer.
    unsafe { sys::storage_status_free(status) };
    Err(Error::Storage(message))
}

/// Copies a C string, using an empty string for NULL.
fn c_string(ptr: *const c_char) -> String {
    if ptr.is_null() {
        return String::new();
    }
    // SAFETY: the pointer is a valid NUL-terminated string owned by the C layer.
    unsafe { CStr::from_ptr(ptr) }
        .to_string_lossy()
        .into_owned()
}

/// Builds a slice, allowing a NULL pointer for an empty list.
///
/// # Safety
///
/// If not NULL, `ptr` must point to `len` initialized elements.
unsafe fn raw_slice<'a, T>(ptr: *const T, len: usize) -> &'a [T] {
    if ptr.is_null() {
        &[]
    } else {
        std::slice::from_raw_parts(ptr, len)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mockup() -> ProbeMode {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("libstorage-ng-agama-sys/tests/fixtures/disk-mockup.xml");
        ProbeMode::ReadMockup(path)
    }

    #[test]
    fn test_probed_disks() {
        let mut storage = Storage::new(mockup()).unwrap();
        storage.probe().unwrap();

        let mut disks = storage.probed_disks().unwrap();
        disks.sort_by(|a, b| a.name.cmp(&b.name));
        let names: Vec<_> = disks.iter().map(|d| d.name.as_str()).collect();
        assert_eq!(names, vec!["/dev/sda", "/dev/sdb"]);
        assert!(disks.iter().all(|d| d.size > 0));
    }

    #[test]
    fn test_missing_mockup() {
        let mode = ProbeMode::ReadMockup(PathBuf::from("/this/does/not/exist.xml"));
        let result = Storage::new(mode).and_then(|mut s| s.probe());
        assert!(matches!(result, Err(Error::Storage(_))));
    }
}
