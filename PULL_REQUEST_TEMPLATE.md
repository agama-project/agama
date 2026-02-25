
## Problem

*Short description of the original problem.*

- *Bugzilla link*
- *openQA link*
- *Links to other related pull requests*


## Solution

*Short description of the fix.*


## Testing

- *Added a new unit test*
- *Tested manually*


## Screenshots

*If the fix affects the UI attach some screenshots here.*

## Documentation

*Remember to look at it from the user's perspective. Yes you have made the compiler happy.*
*But will the **humans** even know about your contribution? Sometimes they cannot miss it,*
*other times they need advertisement and explanation.*

*Look for relevant sections and adjust:*
- The `*.changes` files. For ALL affected packages.
- The description parts of the [JSON schema][profile.schema.json]
- Is the CLI affected? See [cli.md][] for a complete overview,
  change the `///` comments (rust doc)
  and update the .md with `cargo xtask markdown`
- <https://agama-project.github.io/> ([source][gh.io])
- Run: `git ls-files '*.md'`

[cli.md]: https://github.com/agama-project/agama-project.github.io/blob/main/docs/user/cli.md
[profile.schema.json]: https://github.com/agama-project/agama/blob/master/rust/agama-lib/share/profile.schema.json
[gh.io]: https://github.com/agama-project/agama-project.github.io/
