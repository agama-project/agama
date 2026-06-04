use std::env;
use std::fs;
use std::path::Path;
use std::process::Command;

fn update_cli_strings(manifest_path: &Path) {
    // update src/cli_strings.rs via cargo xtask cli-strings

    // Prevent infinite recursion when this build script runs inside the nested build.
    if env::var("AGAMA_CLI_BUILD_RS_ACTIVE").is_ok() {
        return;
    }

    // Use a separate target directory to avoid Cargo target lock deadlocks.
    let out_dir = env::var("OUT_DIR").expect("OUT_DIR is not set");
    let nested_target_dir = Path::new(&out_dir).join("xtask-target");

    let workspace_dir = manifest_path
        .parent()
        .expect("Failed to get parent directory");
    let xtask_toml = manifest_path.join("../xtask/Cargo.toml");

    // Run `cargo xtask cli-strings` via a nested cargo command, executing from the workspace root directory.
    let status = Command::new("cargo")
        .args([
            "run",
            "--manifest-path",
            xtask_toml.to_str().unwrap(),
            "--",
            "cli-strings",
        ])
        .current_dir(workspace_dir)
        .env("AGAMA_CLI_BUILD_RS_ACTIVE", "1")
        .env("CARGO_TARGET_DIR", nested_target_dir)
        .status()
        .expect("Failed to run cargo xtask cli-strings");

    if !status.success() {
        panic!(
            "Failed to generate cli strings: cargo xtask cli-strings exited with non-zero status"
        );
    }
}

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is not set");
    let manifest_path = Path::new(&manifest_dir);
    let src_dir = manifest_path.join("src");

    // Scan src/*.rs files in agama-cli
    if let Ok(entries) = fs::read_dir(&src_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("rs") {
                if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                    // Explicitly skip the generated cli_strings.rs to avoid infinite rebuild loops
                    if file_name != "cli_strings.rs" {
                        if let Ok(content) = fs::read_to_string(&path) {
                            if content.to_lowercase().contains("clap") {
                                println!("cargo:rerun-if-changed=src/{}", file_name);
                            }
                        }
                    }
                }
            }
        }
    }

    // Always track other relevant configuration or external files
    println!("cargo:rerun-if-changed=Cargo.toml");
    println!("cargo:rerun-if-changed=../xtask/src");
    println!("cargo:rerun-if-changed=../xtask/Cargo.toml");

    update_cli_strings(manifest_path);
}
