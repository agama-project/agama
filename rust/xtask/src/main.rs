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

    /// Generate CLI strings for translation.
    pub fn generate_cli_strings() -> std::io::Result<()> {
        use clap::Command;
        let cmd = Cli::command();

        let out_dir = output_dir()?;
        let path = out_dir.join("cli_strings.rs");
        let mut file = std::fs::File::create(&path)?;

        writeln!(file, "fn dummy_cli_strings() {{")?;

        fn write_extracted_strings(
            file: &mut std::fs::File,
            context: &str,
            short: Option<String>,
            long: Option<String>,
        ) -> std::io::Result<()> {
            if let Some(ref s) = short {
                writeln!(file, "    // TRANSLATORS: command: {}", context)?;
                writeln!(file, "    gettext_noop!({:?});", s)?;
            }
            if let Some(ref l) = long {
                if let Some(ref s) = short {
                    if l.starts_with(s) && l != s {
                        let suffix = &l[s.len()..];
                        writeln!(
                            file,
                            "    // TRANSLATORS: command: {} (long suffix)",
                            context
                        )?;
                        writeln!(file, "    gettext_noop!({:?});", suffix)?;
                    } else if l != s {
                        writeln!(file, "    // TRANSLATORS: command: {} (long)", context)?;
                        writeln!(file, "    gettext_noop!({:?});", l)?;
                    }
                } else {
                    writeln!(file, "    // TRANSLATORS: command: {} (long)", context)?;
                    writeln!(file, "    gettext_noop!({:?});", l)?;
                }
            }
            Ok(())
        }

        fn extract_strings(
            cmd: &Command,
            file: &mut std::fs::File,
            path: &[&str],
        ) -> std::io::Result<()> {
            let mut current_path = path.to_vec();
            current_path.push(cmd.get_name());
            let context = current_path.join(" ");

            let about = cmd.get_about().map(|a| a.to_string());
            let long_about = cmd.get_long_about().map(|a| a.to_string());

            write_extracted_strings(file, &context, about, long_about)?;

            fn format_arg(arg: &clap::Arg) -> String {
                use std::fmt::Write;
                let mut s = String::new();
                if let Some(long) = arg.get_long() {
                    write!(s, "--{}", long).unwrap();
                } else if let Some(short) = arg.get_short() {
                    write!(s, "-{}", short).unwrap();
                } else {
                    // Positional argument
                    write!(s, "<{}>", arg.get_id().as_str().to_uppercase()).unwrap();
                    return s;
                }

                if arg.get_action().takes_values() {
                    if let Some(names) = arg.get_value_names() {
                        write!(s, " <{}>", names.join(" ")).unwrap();
                    } else {
                        write!(s, " <{}>", arg.get_id().as_str().to_uppercase()).unwrap();
                    }
                }
                s
            }

            for arg in cmd.get_arguments() {
                let arg_name = format_arg(arg);
                let help = arg.get_help().map(|h| h.to_string());
                let long_help = arg.get_long_help().map(|h| h.to_string());
                let arg_context = format!("{} {}", context, arg_name);

                write_extracted_strings(file, &arg_context, help, long_help)?;
            }

            for subcmd in cmd.get_subcommands() {
                extract_strings(subcmd, file, &current_path)?;
            }

            Ok(())
        }

        extract_strings(&cmd, &mut file, &[])?;
        writeln!(file, "}}")?;

        println!("Generated CLI strings at {}.", path.display());
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

fn print_help() {
    println!("Usage: cargo xtask <task>");
    println!("\nTasks:");
    println!("  completions    Generate auto-completion snippets for common shells");
    println!("  markdown       Generate Agama's CLI documentation in markdown format");
    println!("  manpages       Generate Agama's CLI man pages");
    println!("  openapi        Generate Agama's OpenAPI specification");
    println!("  cli-strings    Generate CLI strings for translation");
    println!("  help           Print this help message");
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let Some(task) = env::args().nth(1) else {
        eprintln!("You must specify a xtask");
        print_help();
        std::process::exit(1);
    };

    match task.as_str() {
        "completions" => tasks::generate_completions(),
        "markdown" => tasks::generate_markdown(),
        "manpages" => tasks::generate_manpages(),
        "openapi" => tasks::generate_openapi().await,
        "cli-strings" => tasks::generate_cli_strings(),
        "help" | "-h" | "--help" => {
            print_help();
            Ok(())
        }
        other => {
            eprintln!("Unknown task '{}'", other);
            print_help();
            std::process::exit(1);
        }
    }
}
