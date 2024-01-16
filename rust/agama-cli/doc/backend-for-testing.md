# How to set up a backend for testing the CLI frontend

I needed a testing instance of the Agama backend so that the
Rust command-line frontend has something to talk to.

## Summary

1. Take the container used for continuous integration (CI) testing of the
   backend
2. Give it a git checkout of this repo
3. Install the backend within the container
4. Copy the frontend binary into the container

## Considered Alternatives

My first plan had a different finale, 4. Make the D-Bus service visible
ouside the container, but I hit an issue with D-Bus authentication, hopefully
solvable. (Update: `xdg-dbus-proxy` seems to work, ask mvidner about it)

Josef wanted to test against a different container (`d-installer-backend`) but that one was a
bit old and the D-Bus API was mismatched between frontend and backend.

## Details

The container used is built in
[OBS systemsmanagement:Agama:Staging/agama-testing][agama-testing] and
downloaded from registry.o.o specified below.

[agama-testing]: https://build.opensuse.org/package/show/systemsmanagement:Agama:Staging/agama-testing

I basically picked the useful bits from the `integration-tests` part
of [.github/workflows/ci.yml][ci.yml].

[ci.yml]: https://github.com/openSUSE/agama/blob/25462f57ab695d6910beb59ff0b21a7afaeda47e/.github/workflows/ci.yml

## Resulting Script

The script, which used to be inlined here, is now at
[`/testing_using_container.sh`](../../../testing_using_container.sh).
>>>>>>> 8f2f0404 (copied the script part of rust/agama-cli/doc/backend-for-testing.md)
