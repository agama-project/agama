This directory contains commands that replaces real ones during CI testing. The reason is that these
commands might not work in the CI environment (e.g., systemd related commands).

To use these "binaries" in the tests, just set the right PATH:

```
PATH=$PWD/share/bin:$PATH cargo test
```
