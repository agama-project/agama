use anyhow;
use gethostname::gethostname;
use openssl::asn1::Asn1Time;
use openssl::bn::{BigNum, MsbOption};
use openssl::error::ErrorStack;
use openssl::hash::MessageDigest;
use openssl::pkey::{PKey, Private};
use openssl::rsa::Rsa;
use std::{ fs, path::Path };
use openssl::x509::extension::{BasicConstraints, SubjectAlternativeName, SubjectKeyIdentifier};
use openssl::x509::{X509NameBuilder, X509};

// TODO: move the certificate related functions into a struct
//
// struct Certificate {
//     certificate: X509,
//     key: PKey<Private>,
// }
//
// impl Certificate {
//     // read from file, support some default location
//     // (like /etc/agama.d/ssl/{certificate,key}.pem ?)
//     pub read(cert: &str, key: &str) -> Result<Self>;
//     // generate a self-signed certificate
//     pub new() -> Self
//     // dump to file
//     pub write(...)
// }

const DEFAULT_CERT_FILE: &str = "/run/agama/cert.pem";
const DEFAULT_KEY_FILE: &str = "/run/agama/key.pem";

/// Writes the certificate and the key to the well known location
pub fn write_certificate(cert: X509, key: PKey<Private>) -> anyhow::Result<()> {
    if let Ok(bytes) = cert.to_pem() {
        fs::write(Path::new(DEFAULT_CERT_FILE), bytes)?;
    }
    if let Ok(bytes) = key.public_key_to_pem() {
        fs::write(Path::new(DEFAULT_KEY_FILE), bytes)?;
    }

    Ok(())
}

/// Generates a self-signed SSL certificate
/// see https://github.com/sfackler/rust-openssl/blob/master/openssl/examples/mk_certs.rs
pub fn create_certificate() -> Result<(X509, PKey<Private>), ErrorStack> {
    let rsa = Rsa::generate(2048)?;
    let key = PKey::from_rsa(rsa)?;

    let hostname = gethostname().into_string().unwrap_or(String::from("localhost"));
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

    // for debugging you might dump the certificate to a file:
    // use std::io::Write;
    // let mut cert_file = std::fs::File::create("agama_cert.pem").unwrap();
    // let mut key_file = std::fs::File::create("agama_key.pem").unwrap();
    // cert_file.write_all(cert.to_pem().unwrap().as_ref()).unwrap();
    // key_file.write_all(key.private_key_to_pem_pkcs8().unwrap().as_ref()).unwrap();

    Ok((cert, key))
}
