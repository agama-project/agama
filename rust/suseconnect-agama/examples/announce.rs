use std::env;

use suseconnect_agama::{announce_system, ConnectParams};

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

    let result = announce_system(params, "sles16");
    println!("{:?}", result);
}
