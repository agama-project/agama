use std::os::raw::{c_char, c_void};

// Safety requirements: inherited from https://doc.rust-lang.org/std/ffi/struct.CStr.html#method.from_ptr
pub(crate) unsafe fn string_from_ptr(c_ptr: *const c_char) -> String {
    String::from_utf8_lossy(std::ffi::CStr::from_ptr(c_ptr).to_bytes()).into_owned()
}

/// Helper to wrap data into C to be later used from rust callbacks.
///
/// It takes a mutable reference to some data and casts it to a raw pointer
/// of type `*mut c_void`. This is useful for passing Rust data (like closures)
/// through a C layer that accepts a `void*` user data pointer, which can then
/// be cast back to its original type in a Rust callback function.
/// see https://adventures.michaelfbryan.com/posts/rust-closures-in-ffi/
pub(crate) fn as_c_void<F>(data: &mut F) -> *mut c_void {
    data as *mut _ as *mut c_void
}

// Safety requirements: ...
pub(crate) unsafe fn status_to_result<R>(
    mut status: zypp_agama_sys::Status,
    result: R,
) -> Result<R, crate::ZyppError> {
    let res = if status.state == zypp_agama_sys::Status_STATE_STATE_SUCCEED {
        Ok(result)
    } else {
        Err(crate::ZyppError::new(
            string_from_ptr(status.error).as_str(),
        ))
    };
    let status_ptr = &mut status;
    zypp_agama_sys::free_status(status_ptr as *mut _);

    res
}

// Safety requirements: ...
pub(crate) unsafe fn status_to_result_void(
    status: zypp_agama_sys::Status,
) -> Result<(), crate::ZyppError> {
    status_to_result(status, ())
}
