#![allow(non_upper_case_globals)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]

include!("bindings.rs");

impl Default for Status {
    fn default() -> Self {
        Self {
            ok: true,
            message: std::ptr::null_mut(),
        }
    }
}
