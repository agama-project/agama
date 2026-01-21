use agama_proxy::model::ProxyConfig;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    if let Some(config) = ProxyConfig::from_cmdline() {
        tracing::info!("Proxy configuration was found, writing it to its config file");
        config.write()?;
    }
    Ok(())
}

