#![cfg_attr(docsrs, feature(doc_cfg))]

pub use ffi;

/// No-op.
macro_rules! skip_assert_initialized {
    () => {};
}

macro_rules! assert_initialized_main_thread {
    () => {
        // TODO: check how to verify that library is initialized
    };
}

pub use auto::*;
mod auto;
pub use auto::traits::InfoBaseExt;
