use std::{env, path::PathBuf};

mod tasks {
    use std::path::PathBuf;

    use agama_cli::Cli;
    use clap::CommandFactory;
    use clap_markdown::MarkdownOptions;

    pub fn generate_markdown() -> std::io::Result<()> {
        let options = MarkdownOptions::new()
            .title("Command-line reference".to_string())
            .show_footer(false);
        let markdown = clap_markdown::help_markdown_custom::<Cli>(&options);
        print!("{}", markdown);
        Ok(())
    }

    pub fn generate_manpage(dir: &PathBuf) -> std::io::Result<()> {
        let cmd = Cli::command();
        clap_mangen::generate_to(cmd, dir)
    }
}

fn main() -> std::io::Result<()> {
    let out_dir = std::env::var_os("OUT_DIR")
        .map(PathBuf::from)
        .unwrap_or(PathBuf::from("out"));

    let Some(task) = env::args().nth(1) else {
        eprintln!("You must specify a xtask");
        std::process::exit(1);
    };

    match task.as_str() {
        "markdown" => tasks::generate_markdown(),
        "manpage" => tasks::generate_manpage(&out_dir),
        other => {
            eprintln!("Unknown task '{}'", other);
            std::process::exit(1);
        }
    }
}
