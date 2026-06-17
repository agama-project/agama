use std::{
    env, fs,
    path::Path,
    process::{exit, Command},
};

use suseconnect_agama::{
    activate_product, announce_system, create_credentials_file, ConnectParams, ProductSpecification,
};
use url::Url;

pub fn main() {
    tracing_subscriber::fmt::init();
    let args: Vec<String> = env::args().collect();

    let Some(url) = args.get(1) else {
        eprintln!("Usage: rmt <url> [<cert_path>]");
        exit(1);
    };

    let params = ConnectParams {
        language: Some("en_US".to_string()),
        url: Some(Url::parse(&url).unwrap()),
        token: None,
        email: None,
    };

    if let Some(cert) = &args.get(2) {
        println!("Certificate path provided: {}. Processing...", cert);

        let dest_dir = Path::new("/etc/pki/trust/anchors");
        let cert_filename = Path::new(cert)
            .file_name()
            .expect("Invalid certificate path: missing filename");
        let dest_path = dest_dir.join(cert_filename);

        match fs::copy(cert, &dest_path) {
            Ok(bytes) => println!("Copied {} bytes to {}", bytes, dest_path.display()),
            Err(e) => {
                eprintln!("Error copying certificate: {}", e);
                exit(1);
            }
        }

        println!("Running update-ca-certificates...");
        let output = Command::new("update-ca-certificates")
            .output()
            .expect("Failed to execute update-ca-certificates");

        if output.status.success() {
            println!("CA certificates updated successfully.");
        } else {
            eprintln!(
                "update-ca-certificates failed with status: {}",
                output.status
            );
            eprintln!("Stderr: {}", String::from_utf8_lossy(&output.stderr));
            exit(1);
        }
    }

    let result = announce_system(params.clone(), "sles16");
    println!("{:?}", result);
    let Ok(credentials) = result else {
        exit(1);
    };
    let result = create_credentials_file(
        &credentials.login,
        &credentials.password,
        suseconnect_agama::GLOBAL_CREDENTIALS_FILE,
    );
    println!("{:?}", result);
    if result.is_err() {
        exit(1);
    };
    let product_spec = ProductSpecification {
        identifier: "SLES".to_string(),
        version: "16.0".to_string(),
        arch: "x86_64".to_string(),
    };
    let result = activate_product(product_spec, params, "");
    println!("{:?}", result);
}
