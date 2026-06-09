### 1. Fix Subcommand Requirements (`[COMMAND]` vs `<COMMAND>`)
- **Issue:** In the Derive API, `#[command(subcommand)]` automatically makes the subcommand required and prompts with `<COMMAND>`. In the Builder API, `.subcommand()` does not enforce this by default, resulting in `[COMMAND]`.
- **Fix:** Add `.subcommand_required(true)` and `.arg_required_else_help(true)` to `Command::new("agama")` and all top-level subcommands that group other commands (e.g., `config`, `questions`, `logs`, `auth`).

### 2. Fix Argument Value Names (Capitalization)
- **Issue:** The Derive API infers the argument placeholder name by uppercasing the struct field (e.g., `url_or_path` becomes `<URL_OR_PATH>`). The Builder API defaults to the lowercase string ID.
- **Fix:** Explicitly define `.value_name("URL_OR_PATH")`, `.value_name("HOST")`, `.value_name("DESTINATION")`, `.value_name("FORMAT")`, `.value_name("PATH")`, `.value_name("METHOD")`, etc., on the respective `Arg` definitions.

### 3. Strip Trailing Periods in Short Descriptions (`.about()`)
- **Issue:** The Derive API automatically strips trailing periods (`.`) from the first line of doc comments when using them as the short `.about()` text. When we converted these to `gettext("...")`, we included the trailing periods.
- **Fix:** Remove the trailing periods from all `.about(gettext("..."))` calls to match the original formatting (e.g., `"Inspect or change the installation settings"` instead of `"Inspect or change the installation settings."`).

### 4. Remove Hardcoded Newlines in `.help()` Strings
- **Issue:** The Derive API unwraps newlines in doc comments for the short `.help()` messages (but preserves them for `.long_help()`). Our Builder conversion kept the `\n` literals, leading to weird text alignments in the man pages and shell completions.
- **Fix:** Replace `\n` with spaces in short `.help()` texts (e.g., the `--local` flag and the `download` URL argument) or use `.long_help()` instead.

### 5. Restore Markdown Title (`xtask`)
- **Issue:** Originally, `xtask` used `MarkdownOptions` to override the page title to `Command-line reference`. We removed that because `help_markdown_command` doesn't accept `MarkdownOptions`. The default title is now `# Command-Line Help for agama`.
- **Fix:** Post-process the generated markdown string in `xtask/src/main.rs` via a simple `.replace("# Command-Line Help for `agama`", "# Command-line reference")`.

### 6. Fix `Format` Enum Help Descriptions
- **Issue:** The Derive API automatically pulled the doc comments of `Format` variants into the man page. In Builder API, unless we bind the Enum strongly to `Arg`'s help, it skips variant descriptions.
- **Fix:** Verify the `Format` type derivations in `commands.rs`. Adding `.value_name("FORMAT")` might be enough to restore the default output, but we may also need to explicitly append the help string to the format argument if clap 4.0 doesn't auto-expand Enum variants identically in Builder.
