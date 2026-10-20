# Running the tests

From `rust/`:

```sh
# both crates (no root needed; they probe a mockup file)
cargo test -p libstorage-ng-agama -p libstorage-ng-agama-sys

# only one crate
cargo test -p libstorage-ng-agama-sys

# a single test, with output
cargo test -p libstorage-ng-agama-sys test_probed_disks -- --nocapture
```

The `libstorage-ng-agama` run also covers its doc test. That doc test is `no_run`, so it only
compiles.

## Real system probe (ignored by default)

```sh
sudo -E env "PATH=$PATH" cargo test -p libstorage-ng-agama-sys -- --ignored
```

It needs root. If cargo or rustup lives in your home directory, running it under `sudo` is
awkward. A simpler way is to build the test binary as yourself, then run it as root:

```sh
cargo test -p libstorage-ng-agama-sys --no-run   # prints the binary path
sudo target/debug/deps/list_disks-<hash> --ignored
```

Probing the real system is read-only here, because `storage_new` is called with
`read_only = true`. It still takes libstorage-ng's lock, so it fails if another process (for
example, the Agama service) holds it.

## Against a different libstorage-ng

```sh
LIBSTORAGE_NG_INCLUDE_DIR=/path/to/include LIBSTORAGE_NG_LIB_DIR=/path/to/lib \
  cargo test -p libstorage-ng-agama-sys
```

You may also need `LD_LIBRARY_PATH=/path/to/lib` at run time.

## Memory check (optional)

```sh
cargo test -p libstorage-ng-agama-sys --no-run
valgrind --leak-check=full target/debug/deps/list_disks-<hash> --test-threads=1 test_probed_disks
```

It is slow, and the test harness reports two unrelated "possibly lost" blocks.
