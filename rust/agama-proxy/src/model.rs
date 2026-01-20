use std::default;

use agama_utils::kernel_cmdline::KernelCmdline;
use strum::{EnumIter, EnumString, IntoEnumIterator};
use url::Url;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("The URL looks wrong")]
    WrongUrl,
}

#[derive(Debug, Default, PartialEq, EnumIter, EnumString)]
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
    proxies: Vec<Proxy>,
    socks5_server: Option<String>,
    enabled: bool,
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
                }
            } else {
                tracing::info("No proxy is configured, skipping configuration");
            }
        }
        None
    }
    pub fn write() {}
}

#[derive(Debug, PartialEq)]
pub struct Proxy {
    protocol: Protocol,
    url: String,
}

impl Proxy {
    pub fn new(url: String, protocol: Protocol) -> Self {
        Self { url, protocol }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agama_utils::kernel_cmdline::KernelCmdline;

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
}
