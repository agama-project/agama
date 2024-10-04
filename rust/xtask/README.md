# Agama project tasks

This package implements a set of project tasks following the [xtask
pattern](https://github.com/matklad/cargo-xtask). This pattern allows writing the typical
maintenance tasks using Rust code.

## Defined tasks

- `manpages`: generates manpages for the command-line interface.
- `completions`: generates shell completion snippets for Bash, Fish and Zsh.
- `markdown`: generates a manual page for the command-line interface in Markdown format. Useful to
  be included in our website.

## Running a task

To run a task, just type `cargo xtask TASK` where `TASK` is the name of the task (check the [Defined
tasks](#defined-tasks) section).

```shell
cargo xtask manpages
```

Most of the artifacts are generated in an `out` directory. You can modify the target by setting the
`OUT_DIR` environment variable.

## Writing a new task

Tasks are defined using regular Rust code. Check the [main.rs](src/main.rs) file for further
information.
