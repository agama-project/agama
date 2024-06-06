use anyhow;
use gethostname::gethostname;
use openssl::asn1::Asn1Time;
use openssl::bn::{BigNum, MsbOption};
use openssl::hash::MessageDigest;
use openssl::pkey::{PKey, Private};
use openssl::rsa::Rsa;
use openssl::x509::extension::{BasicConstraints, SubjectAlternativeName, SubjectKeyIdentifier};
use openssl::x509::{X509NameBuilder, X509};
use std::{fs, io::Write, os::unix::fs::OpenOptionsExt, path::Path};

const DEFAULT_CERT_DIR: &str = "/etc/agama.d/ssl";

/// Structure to handle and store certificate and private key which is later
/// used for establishing HTTPS connection
pub struct Certificate {
    pub cert: X509,
    pub key: PKey<Private>,
}

impl Certificate {
    /// Writes cert, key to (for now well known) location(s)
    pub fn write(&self) -> anyhow::Result<()> {
        // check and create default dir if needed
        if !Path::new(DEFAULT_CERT_DIR).is_dir() {
            std::fs::create_dir_all(DEFAULT_CERT_DIR)?;
        }

        if let Ok(bytes) = self.cert.to_pem() {
            fs::write(Path::new(DEFAULT_CERT_DIR).join("cert.pem"), bytes)?;
        }
        if let Ok(bytes) = self.key.private_key_to_pem_pkcs8() {
            let path = Path::new(DEFAULT_CERT_DIR).join("key.pem");
            let mut file = fs::OpenOptions::new()
                .create(true)
                .truncate(true)
                .write(true)
                .mode(0o400)
                .open(path)?;
            file.write_all(&bytes)?;
        }

        Ok(())
    }

    /// Reads certificate and corresponding private key from given paths
    pub fn read<T: AsRef<Path>>(cert: T, key: T) -> anyhow::Result<Self> {
        let cert_bytes = std::fs::read(cert)?;
        let key_bytes = std::fs::read(key)?;

        let cert = X509::from_pem(&cert_bytes.as_slice());
        let key = PKey::private_key_from_pem(&key_bytes.as_slice());

        match (cert, key) {
            (Ok(c), Ok(k)) => Ok(Certificate { cert: c, key: k }),
            _ => Err(anyhow::anyhow!("Failed to read certificate")),
        }
    }

    /// Creates a self-signed certificate
    pub fn new() -> anyhow::Result<Self> {
        let rsa = Rsa::generate(2048)?;
        let key = PKey::from_rsa(rsa)?;

        let hostname = gethostname()
            .into_string()
            .unwrap_or(String::from("localhost"));
        let mut x509_name = X509NameBuilder::new()?;
        x509_name.append_entry_by_text("O", "Agama")?;
        x509_name.append_entry_by_text("CN", hostname.as_str())?;
        let x509_name = x509_name.build();

        let mut builder = X509::builder()?;
        builder.set_version(2)?;
        let serial_number = {
            let mut serial = BigNum::new()?;
            serial.rand(159, MsbOption::MAYBE_ZERO, false)?;
            serial.to_asn1_integer()?
        };
        builder.set_serial_number(&serial_number)?;
        builder.set_subject_name(&x509_name)?;
        builder.set_issuer_name(&x509_name)?;
        builder.set_pubkey(&key)?;

        let not_before = Asn1Time::days_from_now(0)?;
        builder.set_not_before(&not_before)?;
        let not_after = Asn1Time::days_from_now(365)?;
        builder.set_not_after(&not_after)?;

        builder.append_extension(BasicConstraints::new().critical().ca().build()?)?;

        builder.append_extension(
            SubjectAlternativeName::new()
                // use the default Agama host name
                // TODO: use the gethostname crate and use the current real hostname
                .dns("agama")
                // use the default name for the mDNS/Avahi
                // TODO: check which name is actually used by mDNS, to avoid
                // conflicts it might actually use something like agama-2.local
                .dns("agama.local")
                .build(&builder.x509v3_context(None, None))?,
        )?;

        let subject_key_identifier =
            SubjectKeyIdentifier::new().build(&builder.x509v3_context(None, None))?;
        builder.append_extension(subject_key_identifier)?;

        builder.sign(&key, MessageDigest::sha256())?;
        let cert = builder.build();

        Ok(Certificate {
            cert: cert,
            key: key,
        })
    }
}
