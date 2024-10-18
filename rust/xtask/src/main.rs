use std::{env, path::PathBuf};

mod tasks {
    use std::{fs::File, io::Write, path::Path};

    use agama_cli::Cli;
    use agama_server::web::docs::{
        ApiDocBuilder, L10nApiDocBuilder, ManagerApiDocBuilder, MiscApiDocBuilder,
        NetworkApiDocBuilder, QuestionsApiDocBuilder, SoftwareApiDocBuilder, StorageApiDocBuilder,
        UsersApiDocBuilder,
    };
    use clap::CommandFactory;
    use clap_complete::aot;
    use clap_markdown::MarkdownOptions;

    use crate::create_output_dir;

    /// Generate auto-completion snippets for common shells.
    pub fn generate_completions() -> std::io::Result<()> {
        let out_dir = create_output_dir("shell")?;

        let mut cmd = Cli::command();
        clap_complete::generate_to(aot::Bash, &mut cmd, "agama", &out_dir)?;
        clap_complete::generate_to(aot::Fish, &mut cmd, "agama", &out_dir)?;
        clap_complete::generate_to(aot::Zsh, &mut cmd, "agama", &out_dir)?;

        println!("Generate shell completions at {}.", out_dir.display());
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

        println!("Generate Markdown documentation at {}.", filename.display());
        Ok(())
    }

    /// Generate Agama's CLI man pages.
    pub fn generate_manpages() -> std::io::Result<()> {
        let out_dir = create_output_dir("man")?;

        let cmd = Cli::command();
        clap_mangen::generate_to(cmd, &out_dir)?;

        println!("Generate manpages documentation at {}.", out_dir.display());
        Ok(())
    }

    /// Generate Agama's OpenAPI specification.
    pub fn generate_openapi() -> std::io::Result<()> {
        let out_dir = create_output_dir("openapi")?;

        write_openapi(L10nApiDocBuilder {}, out_dir.join("l10n.json"))?;
        write_openapi(ManagerApiDocBuilder {}, out_dir.join("manager.json"))?;
        write_openapi(NetworkApiDocBuilder {}, out_dir.join("network.json"))?;
        write_openapi(SoftwareApiDocBuilder {}, out_dir.join("software.json"))?;
        write_openapi(StorageApiDocBuilder {}, out_dir.join("storage.json"))?;
        write_openapi(UsersApiDocBuilder {}, out_dir.join("users.json"))?;
        write_openapi(QuestionsApiDocBuilder {}, out_dir.join("questions.json"))?;
        write_openapi(MiscApiDocBuilder {}, out_dir.join("misc.json"))?;
        println!(
            "Generate the OpenAPI specification at {}.",
            out_dir.display()
        );
        Ok(())
    }

    fn write_openapi<T, P: AsRef<Path>>(builder: T, path: P) -> std::io::Result<()>
    where
        T: ApiDocBuilder,
    {
        let openapi = builder.build().to_pretty_json()?;
        let mut file = File::create(path)?;
        file.write_all(openapi.as_bytes())?;
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
        "completions" => tasks::generate_completions(),
        "markdown" => tasks::generate_markdown(),
        "manpages" => tasks::generate_manpages(),
        "openapi" => tasks::generate_openapi(),
        other => {
            eprintln!("Unknown task '{}'", other);
            std::process::exit(1);
        }
    }
}
