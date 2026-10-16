## Sys Crate for libstorage-ng

Low level FFI bindings to a small C layer (`c-layer/`) on top of
[libstorage-ng](https://github.com/openSUSE/libstorage-ng). libstorage-ng is a C++ library, so
the C layer exposes a plain C API (opaque handles, no exceptions) that bindgen can process.

### Requirements

* `libstorage-ng-devel` >= 4.5.362 (it does not ship a `pkg-config` file).
* `libxml2-devel` and the boost headers (`libboost_headers-devel`), which are included by the
  libstorage-ng headers.
* `gcc-c++`, `make` and `clang-devel` (for bindgen).

To build against a libstorage-ng installed in a non-default location:

* `LIBSTORAGE_NG_INCLUDE_DIR`: directory containing the `storage/` headers.
* `LIBSTORAGE_NG_LIB_DIR`: directory containing `libstorage-ng.so`.

### Bindings

`build.rs` regenerates `src/bindings.rs` from `c-layer/include/headers.h` (the file is only
rewritten when the content changes). Commit the result when the C API changes.

### Tests

`cargo test -p libstorage-ng-agama-sys` probes a mockup file (`tests/fixtures`), so it does not
require root. The test that probes the real system is ignored; run it as root with
`cargo test -p libstorage-ng-agama-sys -- --ignored`.
