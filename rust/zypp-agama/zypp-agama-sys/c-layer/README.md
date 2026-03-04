## C-Layer on top of Libzypp

Goal of this part is to provide C API on top of libzypp. Goal is to have it as thin layer
that allows to call easily libzypp functionality from languages that have issue to call C++ code (so almost all).

### Directories

- `/include` is official public C API
- `/internal` is internal only C++ headers when parts of code need to communicate

### Reminders

- if new header file is added to `/include` add it also to `../rust/zypp-agama-sys/headers.h`

### Coding Conventions

- All public methods are `noexcept`. Instead it should get `status` parameter that is properly filled in both case if exception happen and also if call succeed.
- If method progress can be observed, then use progress parameter. It can have two forms:
  1. just single method pointer and void* for data.
  2. one struct that contain multiple method pointers and for each pointer its void* data.
  Selection of variant depends on what libzypp provides. If libzypp use global progress Receiver, then
  it should be still parameter to method and it should be set at the beginning of method and unset at the end.
- if method provide any pointer, then memory is owned by caller who should deallocate it.
- if pointer provided by method is non-trivial ( usually struct ), then there have to be API call to free it.
- if method gets any pointer, it is still owned by caller who is responsible for its deallocation.
- if callback method receive any pointer, it is owned by library and library will deallocate it after callback finish.
- if a pointer is owned by the library (and should not be freed by the caller), it must be explicitly documented (e.g. `///< library owned`).
- ideally C layer should only have runtime dependency on libzypp and libstdc++
