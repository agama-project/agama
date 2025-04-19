use zbus::proxy;
#[proxy(
    interface = "org.opensuse.Agama.Security",
    default_service = "org.opensuse.Agama.Software1",
    default_path = "/org/opensuse/Agama/Software1",
    assume_defaults = true
)]
pub trait Security {
    /// SslFingerprints property
    #[zbus(property)]
    fn ssl_fingerprints(&self) -> zbus::Result<Vec<(String, String)>>;
    #[zbus(property)]
    fn set_ssl_fingerprints(&self, value: &[(&str, &str)]) -> zbus::Result<()>;
}
