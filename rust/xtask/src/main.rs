use std::{env, path::PathBuf};

use agama_utils::runtime::run_async;

mod tasks {
    use std::{
        fs::File,
        io::Write,
        path::Path,
    };

    use agama_cli::build_cli;

    use clap_complete::aot;

    use crate::output_dir;

    /// Generate auto-completion snippets for common shells.
    pub fn generate_completions() -> std::io::Result<()> {
        let out_dir = output_dir()?.join("shell");
        std::fs::create_dir_all(&out_dir)?;

        let mut cmd = build_cli();
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
        let cmd = build_cli();
        let options = clap_markdown::MarkdownOptions::new()
            .title("Command-line reference".to_string())
            .show_footer(false);
        let markdown = clap_markdown::help_markdown_command_custom(&cmd, &options);

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

        let cmd = build_cli();
        clap_mangen::generate_to(cmd, &out_dir)?;

        println!("Generate manpages documentation at {}.", out_dir.display());
        Ok(())
    }

    /// Generate Agama's OpenAPI specification.
    pub async fn generate_openapi() -> std::io::Result<()> {
        use agama_server::web::docs;

        let out_dir = output_dir()?;

        // Generate JSON format (includes post-processing for aide serialization quirks)
        let mut json_value = docs::build_json().await.map_err(std::io::Error::other)?;

        // Generate fully resolved openapi_full.json and openapi_full.yaml (monolithic, without external schema references)
        let full_json = serde_json::to_string_pretty(&json_value).map_err(std::io::Error::other)?;
        let full_json_path = out_dir.join("openapi_full.json");
        let mut full_json_file = File::create(&full_json_path)?;
        full_json_file.write_all(full_json.as_bytes())?;
        println!(
            "Generated fully resolved OpenAPI specification (JSON) at {}.",
            full_json_path.display()
        );

        let full_yaml = serde_yaml::to_string(&json_value).map_err(std::io::Error::other)?;
        let full_yaml_path = out_dir.join("openapi_full.yaml");
        let mut full_yaml_file = File::create(&full_yaml_path)?;
        full_yaml_file.write_all(full_yaml.as_bytes())?;
        println!(
            "Generated fully resolved OpenAPI specification (YAML) at {}.",
            full_yaml_path.display()
        );

        let schemas_dir = out_dir.join("schemas");
        std::fs::create_dir_all(&schemas_dir)?;

        extract_schema(&mut json_value, &schemas_dir, "Config", "config.schema.json")?;
        extract_schema(&mut json_value, &schemas_dir, "Proposal", "proposal.schema.json")?;
        extract_schema(&mut json_value, &schemas_dir, "SystemInfo", "system.schema.json")?;

        let json = serde_json::to_string_pretty(&json_value).map_err(std::io::Error::other)?;
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

    /// Extracts a schema component from the OpenAPI definition, wraps it as a standalone
    /// JSON schema, and replaces the component with an external $ref pointer.
    fn extract_schema(
        api_val: &mut serde_json::Value,
        schemas_dir: &Path,
        component_name: &str,
        file_name: &str,
    ) -> std::io::Result<()> {
        let component = api_val
            .pointer_mut(&format!("/components/schemas/{}", component_name))
            .map(|v| v.take())
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("Component {} not found in OpenAPI specification", component_name),
                )
            })?;

        let mut schema_obj = component;
        if let Some(map) = schema_obj.as_object_mut() {
            map.insert(
                "$schema".to_string(),
                serde_json::json!("https://json-schema.org/draft/2019-09/schema"),
            );
            map.insert(
                "$id".to_string(),
                serde_json::json!(format!(
                    "file:///usr/share/agama/openapi/latest/schemas/{}",
                    file_name
                )),
            );
            if let Some(components) = api_val.get("components") {
                map.insert("components".to_string(), components.clone());
            }
        }

        let schema_path = schemas_dir.join(file_name);
        let mut f = File::create(&schema_path)?;
        f.write_all(serde_json::to_string_pretty(&schema_obj).map_err(std::io::Error::other)?.as_bytes())?;

        let target = api_val
            .pointer_mut(&format!("/components/schemas/{}", component_name))
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("Failed to re-insert ref for component {}", component_name),
                )
            })?;
        *target = serde_json::json!({
            "$ref": format!("schemas/{}", file_name)
        });

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
    println!("  help           Print this help message");
}

fn main() -> std::io::Result<()> {
    run_async(async {
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
    })
}
