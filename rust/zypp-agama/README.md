## Zypp Agama

crate which purpose is to have thin layer to libzypp for agama purpose.

### How to Add New Libzypp Call

- at first create its C API in `zypp-agama-sys/c-layer/include` directory and write its implementation to cxx file.
- generate new FFI bindings (in low level, unsafe Rust),  in `rust/zypp-agama-sys` by running cargo build
- write a (regular, safe) Rust wrapper,  in `src`

### Libzypp Notes

- libzypp is not thread safe
- for seeing how it works see yast2-pkg-bindings and zypper as some parameters in calls are ignored
- goal is to have thin layer close to libzypp and build logic on top of it in more advanced language

### Interesting Resources

- https://doc.rust-lang.org/nomicon/ffi.html
- https://adventures.michaelfbryan.com/posts/rust-closures-in-ffi/
- https://www.khoury.northeastern.edu/home/lth/larceny/notes/note7-ffi.html
- https://cliffle.com/blog/not-thread-safe/ ( interesting part how to ensure in rust that some data is not thread safe )