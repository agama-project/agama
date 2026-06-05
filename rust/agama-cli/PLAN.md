# CLI Refactoring Plan: Derive to Builder API

The goal of this refactoring is to replace the `clap` Derive API with the Builder API in `agama-cli` so that all help texts and descriptions can be wrapped in `gettext(...)` (from `gettext-rs`). This makes them dynamically translatable at runtime and extractable by `xgettext`.

## 1. Setup and Global Types (`lib.rs` & `main.rs`)
- [ ] Remove `#[derive(Parser)]` and `#[derive(Args)]` from `Cli` and `GlobalOpts`.
- [ ] Create a central `build_cli() -> clap::Command` function.
- [ ] Define the global arguments (`--host`, `--insecure`, `--local`) using `clap::Arg` in `build_cli()`.
- [ ] Use `gettext("...")` for all `about`, `long_about`, and `help` strings.
- [ ] Update `main.rs` and `lib.rs` to call `build_cli().get_matches()`.

## 2. Refactor Top-Level Commands (`commands.rs`)
- [ ] Remove `#[derive(Subcommand)]` from `Commands`.
- [ ] Map each top-level command (`Config`, `Probe`, `Install`, `Questions`, `Logs`, `Auth`, `Download`, `Finish`, `Monitor`, `Status`, `Events`) into a `Command::new(...)`.
- [ ] Attach these commands to `build_cli()` via `.subcommand(...)`.
- [ ] Update the dispatch logic in `lib.rs` (or `commands.rs`) to match on the string name of the subcommand (e.g., `matches.subcommand()`).
- [ ] Retrieve values directly from `ArgMatches` instead of typed structs.

## 3. Refactor Subcommand Modules
For each of the following, remove `#[derive(Subcommand)]` / `#[derive(Args)]`, create a `build_*_cmd()` function that returns a `Command`, and update the `run(...)` execution functions to accept `&clap::ArgMatches`.

- [ ] `config.rs` (`ConfigCommands`)
  - Subcommands: `generate`, `show`, `load`.
- [ ] `auth.rs` (`AuthCommands`)
  - Subcommands: `login`, `logout`, `status`.
- [ ] `logs.rs` (`LogsCommands`)
  - Subcommands: `store`.
- [ ] `questions.rs` (`QuestionsCommands`, `ModesArgs`)
  - Subcommands: `ask`, `answer`, `list`.

## 4. Retain Enums Using `ValueEnum`
- [ ] Keep `#[derive(ValueEnum)]` for `Format` (`commands.rs`), `Modes` (`questions.rs`), and `FinishMethod` (`api` crate, if applicable).
- [ ] Map them in the builder using `.value_parser(clap::value_parser!(Format))`.

## 5. Wrapping up & Verification
- [ ] Wrap all string descriptions in `.help(gettext("..."))` and `.about(gettext("..."))`.
- [ ] Format the code: `cargo fmt`.
- [ ] Lint the code: `cargo clippy`.
- [ ] Test the string extraction process: Run `../build_pot --container` and verify `agama.pot` contains the translated strings.
