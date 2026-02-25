use std::{env, process::exit};

use suseconnect_agama::{
    activate_product, announce_system, create_credentials_file, ConnectParams,
    ProductSpecification, DEFAULT_CONFIG_FILE,
};

pub fn main() {
    tracing_subscriber::fmt::init();
    let args: Vec<String> = env::args().collect();
    let Some(code) = args.get(1) else {
        eprintln!("Provide reg code as first parameter");
        return;
    };

    let params = ConnectParams {
        language: Some("en_US".to_string()),
        url: None,
        token: Some(code.to_string()),
        email: None,
    };

    let result = announce_system(params.clone(), "sles16");
    println!("{:?}", result);
    let Ok(credentials) = result else {
        exit(1);
    };
    let result = create_credentials_file(
        &credentials.login,
        &credentials.password,
        DEFAULT_CONFIG_FILE,
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
