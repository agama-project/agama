use suseconnect_agama::{ConnectParams, ProductSpecification, show_product};

// Note: the example has to be run on registered SLES 16, otherwise it returns different errors
pub fn main() {
    tracing_subscriber::fmt::init();

    let product_spec = ProductSpecification {
            identifier: "SLES".to_string(),
            version: "16.0".to_string(),
            arch: "x86_64".to_string(),
        };
    let params = ConnectParams::default();

    let result = show_product(product_spec, params);
    println!("{:?}", result);
}