The `*.bus.xml` files here are produced by introspecting actual objects
exported by the Agama services.

The files are produced by `seed.sh`.
- FIXME: run it in CI.
- FIXME: make it easy to run it *and* commit the result to git.

Each file name represents a D-Bus **interface** that we want to document.
That is why some files have symlinks pointing to them (and why you see no
`org.freedesktop.DBus.*` filenames, we don't need to document those interfaces)

The interfaces implemented in Rust already have documentation in them
(courtesy of Rust macro magic) but it is not in the exact format that
`gdbus-codegen` understands :sob:.

You are expected to copy a new `foo.bus.xml` to `../foo.doc.xml`, remove the
`<interface>` elements other than `foo`, and add meaningful documentation.
Run `make check`.

FIXME: Storage1.ZFCP and Storage1.DASD needs an s390 machine to run,
we should expose them on x86 too (returning errors), perhaps guarded by an
`AGAMA_IGNORE_ARCH` flag?
