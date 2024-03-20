use openssl::asn1::Asn1Time;
use openssl::bn::{BigNum, MsbOption};
use openssl::error::ErrorStack;
use openssl::hash::MessageDigest;
use openssl::pkey::{PKey, Private};
use openssl::rsa::Rsa;
use openssl::x509::extension::{
    BasicConstraints, KeyUsage, SubjectAlternativeName, SubjectKeyIdentifier,
};
use openssl::x509::{X509NameBuilder, X509};

/// Generates a self-signed SSL certificate
/// see https://github.com/sfackler/rust-openssl/blob/master/openssl/examples/mk_certs.rs
pub fn create_certificate() -> Result<(X509, PKey<Private>), ErrorStack> {
    let rsa = Rsa::generate(2048)?;
    let key = PKey::from_rsa(rsa)?;

    let mut x509_name = X509NameBuilder::new()?;
    x509_name.append_entry_by_text("O", "Agama")?;
    x509_name.append_entry_by_text("CN", "localhost")?;
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
    builder.set_pubkey(&key)?;

    let not_before = Asn1Time::days_from_now(0)?;
    builder.set_not_before(&not_before)?;
    let not_after = Asn1Time::days_from_now(365)?;
    builder.set_not_after(&not_after)?;

    builder.append_extension(BasicConstraints::new().critical().ca().build()?)?;
    builder.append_extension(
        KeyUsage::new()
            .critical()
            .key_cert_sign()
            .crl_sign()
            .build()?,
    )?;

    builder.append_extension(
        SubjectAlternativeName::new()
            // use the default Agama host name
            .dns("agama")
            // use the default name for the mDNS/Avahi
            .dns("agama.local")
            .build(&builder.x509v3_context(None, None))?,
    )?;

    let subject_key_identifier =
        SubjectKeyIdentifier::new().build(&builder.x509v3_context(None, None))?;
    builder.append_extension(subject_key_identifier)?;

    builder.sign(&key, MessageDigest::sha256())?;
    let cert = builder.build();

    Ok((cert, key))
}
