use libstorage_ng_agama_sys::*;
use std::ffi::{CStr, CString};
use std::path::Path;
use std::ptr;

fn mockup_path() -> CString {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/disk-mockup.xml");
    CString::new(path.to_str().unwrap()).unwrap()
}

fn error_message(status: &mut Status) -> String {
    let message = unsafe { CStr::from_ptr(status.message) }
        .to_string_lossy()
        .into_owned();
    unsafe { storage_status_free(status) };
    message
}

#[test]
fn test_probed_disks() {
    let input = mockup_path();
    let mut status = Status::default();

    unsafe {
        let handle = storage_new(
            true,
            ProbeMode_PROBE_READ_MOCKUP,
            input.as_ptr(),
            &mut status,
        );
        assert!(status.ok);
        assert!(!handle.is_null());

        storage_probe(handle, &mut status);
        assert!(status.ok);

        let mut list = storage_probed_disks(handle, &mut status);
        assert!(status.ok);

        let disks = std::slice::from_raw_parts(list.disks, list.len);
        let mut names: Vec<_> = disks
            .iter()
            .map(|d| CStr::from_ptr(d.name).to_str().unwrap().to_string())
            .collect();
        names.sort();
        assert_eq!(names, vec!["/dev/sda", "/dev/sdb"]);

        for disk in disks {
            assert!(disk.size > 0);
            assert!(!CStr::from_ptr(disk.sysfs_path).to_bytes().is_empty());
        }

        storage_disk_list_free(&mut list);
        assert!(list.disks.is_null());
        assert_eq!(list.len, 0);

        storage_free(handle);
    }
}

#[test]
fn test_missing_mockup_file() {
    let input = CString::new("/this/does/not/exist.xml").unwrap();
    let mut status = Status::default();

    unsafe {
        let handle = storage_new(
            true,
            ProbeMode_PROBE_READ_MOCKUP,
            input.as_ptr(),
            &mut status,
        );
        if status.ok {
            // The file is read when probing.
            assert!(!handle.is_null());
            storage_probe(handle, &mut status);
            storage_free(handle);
        }
        assert!(!status.ok);
        assert!(!error_message(&mut status).is_empty());
    }
}

#[test]
fn test_mockup_without_input() {
    let mut status = Status::default();

    unsafe {
        let handle = storage_new(true, ProbeMode_PROBE_READ_MOCKUP, ptr::null(), &mut status);
        assert!(handle.is_null());
        assert!(!status.ok);
        assert_eq!(error_message(&mut status), "A mockup file is required");
    }
}

/// Probing the real system needs root.
#[test]
#[ignore]
fn test_probe_system() {
    let mut status = Status::default();

    unsafe {
        let handle = storage_new(true, ProbeMode_PROBE_STANDARD, ptr::null(), &mut status);
        assert!(status.ok);

        storage_probe(handle, &mut status);
        assert!(status.ok);

        let mut list = storage_probed_disks(handle, &mut status);
        assert!(status.ok);
        storage_disk_list_free(&mut list);
        storage_free(handle);
    }
}
