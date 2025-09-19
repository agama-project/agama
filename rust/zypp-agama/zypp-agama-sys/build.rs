use bindgen::builder;
use std::{env, fs, path::Path, process::Command};

// Write *contents* to *file_path* (panicking on problems)
// but do not update existing file if the exact contents is already there.
// Thus prevent needless rebuilds.
fn update_file(file_path: &str, contents: &str) {
    let should_write = if Path::new(file_path).exists() {
        match fs::read_to_string(file_path) {
            Ok(existing_content) => existing_content != contents,
            Err(_) => true, // File exists but can't read it, write anyway
        }
    } else {
        true // File doesn't exist, write it
    };

    if should_write {
        fs::write(file_path, contents)
            .unwrap_or_else(|_| panic!("Couldn't write {}", file_path));
    }
}

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let mut cmd = Command::new("make");
    cmd.arg("-C");
    cmd.arg(Path::new(&manifest_dir).join("c-layer").as_os_str());
    let result = cmd.status().expect("Failed to start make process");
    if !result.success() {
        panic!("Building C library failed.\n");
    }

    let bindings = builder()
        .header("c-layer/include/headers.h")
        .merge_extern_blocks(true)
        .clang_arg("-I")
        .clang_arg("../../c-layer/include")
        .generate()
        .expect("Unable to generate bindings");
    update_file("src/bindings.rs", &bindings.to_string());

    println!(
        "cargo::rustc-link-search=native={}",
        Path::new(&manifest_dir).join("c-layer").display()
    );
    println!("cargo::rustc-link-lib=static=agama-zypp");
    println!("cargo::rustc-link-lib=dylib=zypp");
    // NOTE: install the matching library for your compiler version, for example
    // libstdc++6-devel-gcc13.rpm
    println!("cargo::rustc-link-lib=dylib=stdc++");
}
