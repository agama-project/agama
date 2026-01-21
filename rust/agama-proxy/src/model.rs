use agama_utils::kernel_cmdline::KernelCmdline;
use strum::{Display, EnumIter, EnumString, IntoEnumIterator};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("The URL looks wrong")]
    WrongUrl,
    #[error("Failed to write configuration: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Default, Display, PartialEq, EnumIter, EnumString)]
#[strum(serialize_all = "camelCase")]
pub enum Protocol {
    FTP,
    #[default]
    HTTP,
    HTTPS,
    GOPHER,
    SOCKS,
}

#[derive(Debug, PartialEq)]
pub struct ProxyConfig {
    pub proxies: Vec<Proxy>,
    pub socks5_server: Option<String>,
    pub enabled: bool,
}

impl ProxyConfig {
    pub fn from_cmdline() -> Option<Self> {
        let paths = ["/run/agama/cmdline.d/kernel.conf", "/etc/cmdline-menu.conf"];

        for path in paths {
            if let Ok(cmdline) = KernelCmdline::parse_file(path) {
                if let Some(url) = cmdline.get_last("proxy") {
                    let mut proxies = vec![];
                    for protocol in Protocol::iter() {
                        if [Protocol::GOPHER, Protocol::SOCKS].contains(&protocol) {
                            continue;
                        }
                        proxies.push(Proxy::new(url.clone(), protocol));
                    }
                    return Some(ProxyConfig {
                        proxies,
                        socks5_server: None,
                        enabled: true,
                    });
                }
            } else {
                tracing::info!("No proxy is configured, skipping configuration");
            }
        }
        None
    }

    pub fn write(&self) -> Result<(), Error> {
        self.write_to("/etc/sysconfig/proxy")
    }

    pub fn write_to<P: AsRef<std::path::Path>>(&self, path: P) -> Result<(), Error> {
        use std::collections::{HashMap, HashSet};
        use std::io::{BufRead, Write};

        let mut settings = HashMap::new();

        let enabled = if self.enabled { "yes" } else { "no" };
        settings.insert("PROXY_ENABLED".to_string(), enabled.to_string());

        for protocol in Protocol::iter() {
            let key = format!("{}_PROXY", protocol.to_string().to_uppercase());

            let url = self
                .proxies
                .iter()
                .find(|p| p.protocol == protocol)
                .map(|p| p.url.as_str())
                .unwrap_or("");

            settings.insert(key, url.to_string());
        }

        let socks5 = self.socks5_server.as_deref().unwrap_or("");
        settings.insert("SOCKS5_SERVER".to_string(), socks5.to_string());

        settings.insert("NO_PROXY".to_string(), "".to_string());

        let path = path.as_ref();
        let mut lines = Vec::new();

        if path.exists() {
            let file = std::fs::File::open(path)?;
            let reader = std::io::BufReader::new(file);
            for line in reader.lines() {
                lines.push(line?);
            }
        }

        let mut new_lines = Vec::new();
        let mut processed_keys = HashSet::new();

        for line in lines {
            let mut replaced = false;
            let trimmed = line.trim_start();
            for (key, val) in &settings {
                if trimmed.starts_with(&format!("{}=", key)) {
                    new_lines.push(format!("{}=\"{}\"", key, val));
                    processed_keys.insert(key.to_string());
                    replaced = true;
                    break;
                }
            }
            if !replaced {
                new_lines.push(line);
            }
        }

        let order = [
            "PROXY_ENABLED",
            "FTP_PROXY",
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "GOPHER_PROXY",
            "SOCKS_PROXY",
            "SOCKS5_SERVER",
            "NO_PROXY",
        ];

        for key in order {
            if !processed_keys.contains(key) {
                if let Some(val) = settings.get(key) {
                    new_lines.push(format!("{}=\"{}\"", key, val));
                }
            }
        }

        let mut file = std::fs::File::create(path)?;
        for line in new_lines {
            writeln!(file, "{}", line)?;
        }

        Ok(())
    }
}

#[derive(Debug, PartialEq)]
pub struct Proxy {
    pub protocol: Protocol,
    pub url: String,
}

impl Proxy {
    pub fn new(url: String, protocol: Protocol) -> Self {
        Self { url, protocol }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // use agama_utils::kernel_cmdline::KernelCmdline;

    /*
    #[test]
    fn test_from_cmdline() {
        let content =
            "BOOT_IMAGE=/boot/vmlinuz root=/dev/sda1 proxy=http://proxy.example.com:8080 quiet";
        let cmdline = KernelCmdline::parse_str(content);
        assert_eq!(
            Proxy::from_cmdline(&cmdline),
            Some(Proxy::new("http://proxy.example.com:8080".to_string()))
        );

        let content = "no_proxy_here";
        let cmdline = KernelCmdline::parse_str(content);
        assert_eq!(Proxy::from_cmdline(&cmdline), None);
    }
    */

    #[test]
    fn test_write() {
        let config = ProxyConfig {
            proxies: vec![
                Proxy::new("http://proxy.example.com".to_string(), Protocol::HTTP),
                Proxy::new("ftp://proxy.example.com".to_string(), Protocol::FTP),
            ],
            socks5_server: Some("socks.example.com".to_string()),
            enabled: true,
        };

        let path = "test_proxy_config";
        config.write_to(path).unwrap();

        let content = std::fs::read_to_string(path).unwrap();
        std::fs::remove_file(path).unwrap();

        assert!(content.contains("PROXY_ENABLED=\"yes\""));
        assert!(content.contains("HTTP_PROXY=\"http://proxy.example.com\""));
        assert!(content.contains("FTP_PROXY=\"ftp://proxy.example.com\""));
        assert!(content.contains("SOCKS5_SERVER=\"socks.example.com\""));
        assert!(content.contains("NO_PROXY=\"\""));
    }

    #[test]
    fn test_write_preserve_content() {
        let path = "test_proxy_config_preserve";

        // Create initial file with some extra content
        {
            use std::io::Write;
            let mut file = std::fs::File::create(path).unwrap();
            writeln!(file, "SOME_OTHER_VAR=\"value\"").unwrap();
            writeln!(file, "HTTP_PROXY=\"old_value\"").unwrap();
            writeln!(file, "# A comment").unwrap();
        }

        let config = ProxyConfig {
            proxies: vec![Proxy::new(
                "http://new.proxy.com".to_string(),
                Protocol::HTTP,
            )],
            socks5_server: None,
            enabled: true,
        };

        config.write_to(path).unwrap();

        let content = std::fs::read_to_string(path).unwrap();
        std::fs::remove_file(path).unwrap();

        assert!(content.contains("SOME_OTHER_VAR=\"value\""));
        assert!(content.contains("HTTP_PROXY=\"http://new.proxy.com\""));
        assert!(!content.contains("HTTP_PROXY=\"old_value\""));
        assert!(content.contains("# A comment"));
        assert!(content.contains("PROXY_ENABLED=\"yes\""));
    }
}

