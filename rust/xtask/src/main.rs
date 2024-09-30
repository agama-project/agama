use std::{env, path::PathBuf};

mod tasks {
    use std::{fs::File, io::Write};

    use agama_cli::Cli;
    use clap::CommandFactory;
    use clap_complete::aot;
    use clap_markdown::MarkdownOptions;

    use crate::create_output_dir;

    /// Generate auto-completion code for common shells.
    pub fn generate_complete() -> std::io::Result<()> {
        let out_dir = create_output_dir("shell")?;

        let mut cmd = Cli::command();
        clap_complete::generate_to(aot::Bash, &mut cmd, "agama", &out_dir)?;
        clap_complete::generate_to(aot::Fish, &mut cmd, "agama", &out_dir)?;
        clap_complete::generate_to(aot::Zsh, &mut cmd, "agama", &out_dir)?;

        println!("Generate shell completions at {}", out_dir.display());
        Ok(())
    }

    /// Generate Agama's CLI documentation in markdown format.
    pub fn generate_markdown() -> std::io::Result<()> {
        let out_dir = create_output_dir("markdown")?;

        let options = MarkdownOptions::new()
            .title("Command-line reference".to_string())
            .show_footer(false);
        let markdown = clap_markdown::help_markdown_custom::<Cli>(&options);

        let filename = out_dir.join("agama.md");
        let mut file = File::create(&filename)?;
        file.write_all(markdown.as_bytes())?;

        println!("Generate Markdown documentation at {}", filename.display());
        Ok(())
    }

    /// Generate Agama's CLI man pages.
    pub fn generate_manpages() -> std::io::Result<()> {
        let out_dir = create_output_dir("man")?;

        let cmd = Cli::command();
        clap_mangen::generate_to(cmd, &out_dir)?;

        println!("Generate manpages documentation at {}", out_dir.display());
        Ok(())
    }
}

fn create_output_dir(name: &str) -> std::io::Result<PathBuf> {
    let out_dir = std::env::var_os("OUT_DIR")
        .map(PathBuf::from)
        .unwrap_or(PathBuf::from("out"))
        .join(name);
    std::fs::create_dir_all(&out_dir)?;
    Ok(out_dir)
}

fn main() -> std::io::Result<()> {
    let Some(task) = env::args().nth(1) else {
        eprintln!("You must specify a xtask");
        std::process::exit(1);
    };

    match task.as_str() {
        "complete" => tasks::generate_complete(),
        "markdown" => tasks::generate_markdown(),
        "manpages" => tasks::generate_manpages(),
        other => {
            eprintln!("Unknown task '{}'", other);
            std::process::exit(1);
        }
    }
}
