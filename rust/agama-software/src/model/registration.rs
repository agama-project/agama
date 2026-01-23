// Copyright (c) [2025] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

//! This module implements support for registering a system.
//!
//! It interacts with SUSEConnect-ng (using the [suseconnect_agama] crate) to register
//! the system and its add-ons and with libzypp (through [zypp_agama]) to add the
//! corresponding services to `libzypp`.

use agama_security as security;
use agama_utils::{
    actor::Handler,
    api::software::{AddonInfo, AddonRegistration, RegistrationInfo},
    arch::Arch,
    helpers::copy_dir_all,
};
use camino::Utf8PathBuf;
use openssl::x509::X509;
use suseconnect_agama::{self, ConnectParams, Credentials};
use url::Url;

use crate::state::Addon;

#[derive(thiserror::Error, Debug)]
pub enum RegistrationError {
    #[error(transparent)]
    Registration(#[from] suseconnect_agama::Error),
    #[error("Failed to add the service {0}: {1}")]
    AddService(String, #[source] zypp_agama::ZyppError),
    #[error("Failed to refresh the service {0}: {1}")]
    RefreshService(String, #[source] zypp_agama::ZyppError),
    #[error("Failed to copy file {0}: {1}")]
    IO(String, #[source] std::io::Error),
    #[error(transparent)]
    Security(#[from] security::service::Error),
}

type RegistrationResult<T> = Result<T, RegistrationError>;

/// Represents a registered system.
///
/// It is used to activate products and add the corresponding services.
/// It is created from a [RegistrationBuilder].
#[derive(Debug)]
pub struct Registration {
    root_dir: Utf8PathBuf,
    product: String,
    version: String,
    arch: Arch,
    // The connection parameters are kept because they are needed by the
    // `to_registration_info` function.
    connect_params: ConnectParams,
    creds: Credentials,
    services: Vec<suseconnect_agama::Service>,
    // Holds the addons information because the status cannot be obtained from SCC yet
    // (e.g., whether and add-on is register or its registration code).
    addons: Vec<Addon>,
    // Holds all config files it created, later it will be copied to target system
    config_files: Vec<Utf8PathBuf>,
}

impl Registration {
    pub fn builder(root_dir: Utf8PathBuf, product: &str, version: &str) -> RegistrationBuilder {
        RegistrationBuilder::new(root_dir, product, version)
    }

    /// Registers the given add-on.
    ///
    /// * `zypp`: zypp instance.
    /// * `addon`: add-on to register.
    pub fn register_addon(
        &mut self,
        zypp: &zypp_agama::Zypp,
        addon: &Addon,
    ) -> RegistrationResult<()> {
        // Use the product's version as default.
        let version = addon.version.clone().unwrap_or(self.version.clone());
        let code = addon.code.as_ref().map(|c| c.as_str());
        self.activate_product(&zypp, &addon.id, &version, code)?;
        self.addons.push(addon.clone());
        Ok(())
    }

    /// Determines whether an add-on is registered.
    ///
    /// It searches for a registered add-on with the same id.
    ///
    /// * `addon`: add-on to check.
    pub fn is_addon_registered(&self, addon: &Addon) -> bool {
        self.find_registered_addon(&addon.id).is_some()
    }

    // Activates the product with the given code.
    fn activate_product(
        &mut self,
        zypp: &zypp_agama::Zypp,
        name: &str,
        version: &str,
        code: Option<&str>,
    ) -> RegistrationResult<()> {
        let product = Self::product_specification(name, version, self.arch);
        let mut params = self.connect_params.clone();
        params.token = code.map(ToString::to_string);

        tracing::debug!("Registering product {product:?}");
        let service = suseconnect_agama::activate_product(
            product,
            params,
            self.connect_params
                .email
                .as_ref()
                .map(|e| e.as_str())
                .unwrap_or(""),
        )?;

        if let Some(file) = Self::credentials_from_url(&service.url) {
            let path = self
                .root_dir
                .join(format!("etc/zypp/credentials.d/{}", file));
            tracing::debug!(
                "Creating the credentials file for {} at {}",
                &service.name,
                &path
            );
            suseconnect_agama::create_credentials_file(
                &self.creds.login,
                &self.creds.password,
                path.as_str(),
            )?;
            self.config_files.push(path);
        }

        // Add the libzypp service
        zypp.add_service(&service.name, &service.url)
            .map_err(|e| RegistrationError::AddService(service.name.clone(), e))?;
        let name = service.name.clone();
        self.services.push(service);
        zypp.refresh_service(&name)
            .map_err(|e| RegistrationError::RefreshService(name, e))?;
        Ok(())
    }

    /// Returns the registration information.
    ///
    /// It includes not only the basic data (like the registration code or the e-mail),
    /// but the list of extensions.
    pub fn to_registration_info(&self) -> RegistrationInfo {
        let addons: Vec<AddonInfo> = match self.base_product() {
            Ok(product) => product
                .extensions
                .into_iter()
                .map(|e| {
                    let registration = match self.find_registered_addon(&e.identifier) {
                        Some(addon) => AddonRegistration::Registered {
                            code: addon.code.clone(),
                        },
                        None => AddonRegistration::NotRegistered,
                    };

                    AddonInfo {
                        id: e.identifier,
                        version: e.version,
                        label: e.friendly_name,
                        available: e.available,
                        free: e.free,
                        recommended: e.recommended,
                        description: e.description,
                        release: e.release_stage,
                        registration,
                    }
                })
                .collect(),
            Err(error) => {
                tracing::error!("Failed to get the product from the registration server: {error}");
                vec![]
            }
        };

        RegistrationInfo {
            code: self.connect_params.token.clone(),
            email: self.connect_params.email.clone(),
            url: self.connect_params.url.clone(),
            addons,
        }
    }

    /// Writes to target system all registration configuration that is needed
    ///
    /// Beware that, if a certificate was imported, it is copied by the agama-security service.
    pub fn finish(&mut self, install_dir: &Utf8PathBuf) -> Result<(), RegistrationError> {
        suseconnect_agama::write_config(self.connect_params.clone())?;
        self.config_files
            .push(suseconnect_agama::DEFAULT_CONFIG_FILE.into());
        self.copy_files(install_dir)?;

        // FIXME: Copy services files. Temporarily solution because, most probably,
        // it should be handled by libzypp itself.
        if let Err(error) = copy_dir_all(
            self.root_dir.join("etc/zypp/services.d"),
            install_dir.join("etc/zypp/services.d"),
        ) {
            tracing::error!("Failed to copy the libzypp services files: {error}");
        };
        Ok(())
    }

    fn copy_files(&self, target_dir: &Utf8PathBuf) -> Result<(), RegistrationError> {
        for path in &self.config_files {
            let target_path = match path.strip_prefix(&self.root_dir) {
                Ok(relative_path) => target_dir.join(&relative_path),
                Err(_) => {
                    let relative_path = path.strip_prefix("/").unwrap_or(path);
                    target_dir.join(relative_path)
                }
            };
            tracing::info!("Copying credentials file {path} to {target_path}");
            std::fs::copy(path, target_path)
                .map_err(|e| RegistrationError::IO(path.to_string(), e))?;
        }

        Ok(())
    }

    fn base_product(&self) -> RegistrationResult<suseconnect_agama::Product> {
        let product = suseconnect_agama::show_product(
            self.base_product_specification(),
            self.connect_params.clone(),
        )?;
        Ok(product)
    }

    fn base_product_specification(&self) -> suseconnect_agama::ProductSpecification {
        Self::product_specification(&self.product, &self.version, self.arch)
    }

    fn product_specification(
        id: &str,
        version: &str,
        arch: Arch,
    ) -> suseconnect_agama::ProductSpecification {
        // We do not expect this to happen.
        suseconnect_agama::ProductSpecification {
            identifier: id.to_string(),
            arch: arch.to_string(),
            version: version.to_string(),
        }
    }

    fn credentials_from_url(url: &str) -> Option<String> {
        let url = Url::parse(url)
            .inspect_err(|e| tracing::warn!("Could not parse the service URL: {e}"))
            .ok()?;
        url.query_pairs()
            .find(|(k, _v)| k == "credentials")
            .map(|(_k, v)| v.to_string())
    }

    fn find_registered_addon(&self, id: &str) -> Option<&Addon> {
        self.addons.iter().find(|a| a.id == id)
    }
}

/// A builder for a [Registration] object.
///
/// It is used to configure the build a registration object. It allows to configure
/// the registration parameters like the product and version, the registration code,
/// the e-mail, etc.
/// [Registration] object.
#[derive(Debug)]
pub struct RegistrationBuilder {
    root_dir: Utf8PathBuf,
    product: String,
    version: String,
    code: Option<String>,
    email: Option<String>,
    url: Option<Url>,
}

impl RegistrationBuilder {
    /// Creates a new builder.
    ///
    /// It receives the mandatory arguments for registering a system.
    ///
    /// * `root_dir`: root directory where libzypp configuration lives.
    /// * `product`: product name (e.g., "SLES").
    /// * `version`: product version (e.g., "16.1").
    pub fn new(root_dir: Utf8PathBuf, product: &str, version: &str) -> Self {
        RegistrationBuilder {
            root_dir,
            product: product.to_string(),
            version: version.to_string(),
            code: None,
            email: None,
            url: None,
        }
    }

    /// Sets the registration code to use.
    ///
    /// * `code`: registration code.
    pub fn with_code(mut self, code: &str) -> Self {
        self.code = Some(code.to_string());
        self
    }

    /// Sets the e-mail associated to the registration.
    ///
    /// * `email`: registration e-mail.
    pub fn with_email(mut self, email: &str) -> Self {
        self.email = Some(email.to_string());
        self
    }

    /// Sets the URL of the registration server.
    ///
    /// * `url`: server URL.
    pub fn with_url(mut self, url: &Url) -> Self {
        self.url = Some(url.clone());
        self
    }

    /// Registers the system and return a [Registration] object.
    ///
    /// It announces the system, gets the credentials and registers the base product.
    ///
    /// * `zypp`: zypp instance.
    pub fn register(
        &self,
        zypp: &zypp_agama::Zypp,
        security_srv: &Handler<security::Service>,
    ) -> RegistrationResult<Registration> {
        let params = suseconnect_agama::ConnectParams {
            token: self.code.clone(),
            email: self.email.clone(),
            language: "en-us".to_string().into(),
            url: self.url.clone(),
            ..Default::default()
        };
        // https://github.com/agama-project/agama/blob/master/service/lib/agama/registration.rb#L294
        let version = self.version.split(".").next().unwrap_or("1");
        let arch = Arch::current().expect("Failed to determine the architecture");
        let target_distro = format!("{}-{}-{}", &self.product, version, arch.to_string());
        tracing::debug!("Announcing system {target_distro}");
        let creds = handle_registration_error(
            || suseconnect_agama::announce_system(params.clone(), &target_distro),
            security_srv,
        )?;

        // suseconnect_agama::announce_system(params.clone(), &target_distro)?;

        tracing::debug!(
            "Creating the base credentials file at {}",
            suseconnect_agama::GLOBAL_CREDENTIALS_FILE
        );
        suseconnect_agama::create_credentials_file(
            &creds.login,
            &creds.password,
            suseconnect_agama::GLOBAL_CREDENTIALS_FILE,
        )?;

        let mut registration = Registration {
            root_dir: self.root_dir.clone(),
            connect_params: params,
            product: self.product.clone(),
            version: self.version.clone(),
            arch,
            creds,
            services: vec![],
            addons: vec![],
            config_files: vec![suseconnect_agama::GLOBAL_CREDENTIALS_FILE.into()],
        };

        registration.activate_product(zypp, &self.product, &self.version, None)?;
        Ok(registration)
    }
}

/// Ancillary function to handle registration errors.
///
/// Runs the given function and handles potential SSL errors. If there is an SSL
/// error and it can be solved by importing the certificate, it asks the security
/// service whether to trust the certificate.
///
/// It returns the result if the given function runs successfully or return any
/// other kind of error.
fn handle_registration_error<T, F>(
    func: F,
    security_srv: &Handler<security::Service>,
) -> Result<T, RegistrationError>
where
    F: Fn() -> Result<T, suseconnect_agama::Error>,
{
    loop {
        let result = func();

        if let Err(suseconnect_agama::Error::SSL {
            code,
            message: _,
            current_certificate,
        }) = &result
        {
            if code.is_fixable_by_import() {
                let x509 = X509::from_pem(&current_certificate.as_bytes()).unwrap();
                match should_trust_certificate(&x509, security_srv) {
                    Ok(true) => {
                        if let Err(error) = suseconnect_agama::reload_certificates() {
                            tracing::error!("Could not reload the certificates: {error}");
                        }
                        continue;
                    }
                    Ok(false) => tracing::warn!("Do not trust the certificate"),
                    Err(error) => tracing::error!("Error processing the certificate: {error}"),
                }
            }
        }

        return Ok(result?);
    }
}

pub fn should_trust_certificate(
    certificate: &X509,
    security_srv: &Handler<security::Service>,
) -> Result<bool, security::service::Error> {
    // unwrap OK: unwrap is fine because, if we eat all I/O resources, there is not solution
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let security_srv = security_srv.clone();
    let certificate = certificate.clone();
    let handle = rt.spawn(async move {
        security_srv
            .call(security::message::CheckCertificate::new(
                certificate,
                "registration_server",
            ))
            .await
    });
    rt.block_on(handle).unwrap()
}
