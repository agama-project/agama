#![allow(non_upper_case_globals)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]

include!("bindings.rs");

impl Default for Status {
    fn default() -> Self {
        Self {
            state: Status_STATE_STATE_SUCCEED,
            error: std::ptr::null_mut(),
        }
    }
}
