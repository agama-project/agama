### 1. Fix `Format` Enum Help Descriptions
- **Issue:** The Derive API automatically pulled the doc comments of `Format` variants into the man page. In Builder API, unless we bind the Enum strongly to `Arg`'s help, it skips variant descriptions.
- **Fix:** Verify the `Format` type derivations in `commands.rs`. Adding `.value_name("FORMAT")` might be enough to restore the default output, but we may also need to explicitly append the help string to the format argument if clap 4.0 doesn't auto-expand Enum variants identically in Builder.
