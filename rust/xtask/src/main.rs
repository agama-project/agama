use std::{env, path::PathBuf};

mod tasks {
    use std::{fs::File, io::Write};

    use agama_cli::Cli;
    use clap::CommandFactory;
    use clap_complete::aot;
    use clap_markdown::MarkdownOptions;

    use crate::output_dir;

    /// Generate auto-completion snippets for common shells.
    pub fn generate_completions() -> std::io::Result<()> {
        let out_dir = output_dir()?.join("shell");
        std::fs::create_dir_all(&out_dir)?;

        let mut cmd = Cli::command();
        clap_complete::generate_to(aot::Bash, &mut cmd, "agama", &out_dir)?;
        clap_complete::generate_to(aot::Fish, &mut cmd, "agama", &out_dir)?;
        clap_complete::generate_to(aot::Zsh, &mut cmd, "agama", &out_dir)?;

        println!("Generate shell completions at {}.", out_dir.display());
        Ok(())
    }

    const GENERATED: &str =
        "---\nNOTE: This documentation is generated. Run `cargo xtask markdown` to update it.\n";

    /// Generate Agama's CLI documentation in markdown format.
    pub fn generate_markdown() -> std::io::Result<()> {
        let options = MarkdownOptions::new()
            .title("Command-line reference".to_string())
            .show_footer(false);
        let markdown = clap_markdown::help_markdown_custom::<Cli>(&options);

        let path = output_dir()?.join("agama.md");
        let mut file = File::create(&path)?;
        file.write_all(markdown.as_bytes())?;
        file.write_all(GENERATED.as_bytes())?;

        println!("Generate Markdown documentation at {}.", path.display());
        Ok(())
    }

    /// Generate Agama's CLI man pages.
    pub fn generate_manpages() -> std::io::Result<()> {
        let out_dir = output_dir()?.join("man");
        std::fs::create_dir_all(&out_dir)?;

        let cmd = Cli::command();
        clap_mangen::generate_to(cmd, &out_dir)?;

        println!("Generate manpages documentation at {}.", out_dir.display());
        Ok(())
    }

    /// Generate Agama's OpenAPI specification.
    pub async fn generate_openapi() -> std::io::Result<()> {
        use agama_server::web::docs;

        let out_dir = output_dir()?;

        // Generate JSON format (includes post-processing for aide serialization quirks)
        let json_value = docs::build_json().await.map_err(std::io::Error::other)?;

        let json = serde_json::to_string_pretty(&json_value)?;
        let json_path = out_dir.join("openapi.json");
        let mut json_file = File::create(&json_path)?;
        json_file.write_all(json.as_bytes())?;
        println!(
            "Generated OpenAPI specification (JSON) at {}.",
            json_path.display()
        );

        // Generate YAML format
        let yaml = serde_yaml::to_string(&json_value).map_err(std::io::Error::other)?;
        let yaml_path = out_dir.join("openapi.yaml");
        let mut yaml_file = File::create(&yaml_path)?;
        yaml_file.write_all(yaml.as_bytes())?;
        println!(
            "Generated OpenAPI specification (YAML) at {}.",
            yaml_path.display()
        );

        Ok(())
    }
}

fn output_dir() -> std::io::Result<PathBuf> {
    let out_dir = std::env::var_os("OUT_DIR")
        .map(PathBuf::from)
        .unwrap_or(PathBuf::from("out"));
    std::fs::create_dir_all(&out_dir)?;
    Ok(out_dir)
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let Some(task) = env::args().nth(1) else {
        eprintln!("You must specify a xtask");
        std::process::exit(1);
    };

    match task.as_str() {
        "completions" => tasks::generate_completions(),
        "markdown" => tasks::generate_markdown(),
        "manpages" => tasks::generate_manpages(),
        "openapi" => tasks::generate_openapi().await,
        other => {
            eprintln!("Unknown task '{}'", other);
            std::process::exit(1);
        }
    }
}
