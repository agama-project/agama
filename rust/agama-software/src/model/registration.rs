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

use agama_utils::{
    api::software::{AddonInfo, AddonStatus, RegistrationInfo},
    arch::Arch,
};
use camino::Utf8PathBuf;
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
    // The connection parameters are kept because they are needed by the
    // `to_registration_info` function.
    connect_params: ConnectParams,
    creds: Credentials,
    services: Vec<suseconnect_agama::Service>,
    // Holds the addons information because the status cannot be obtained from SCC yet
    // (e.g., whether and add-on is register or its registration code).
    addons: Vec<Addon>,
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
        let product = Self::product_specification(name, version);
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
                    let status = match self.find_registered_addon(&e.identifier) {
                        Some(addon) => AddonStatus::Registered {
                            code: addon.code.clone(),
                        },
                        None => AddonStatus::NotRegistered,
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
                        status,
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

    fn base_product(&self) -> RegistrationResult<suseconnect_agama::Product> {
        let product = suseconnect_agama::show_product(
            self.base_product_specification(),
            self.connect_params.clone(),
        )?;
        Ok(product)
    }

    fn base_product_specification(&self) -> suseconnect_agama::ProductSpecification {
        Self::product_specification(&self.product, &self.version)
    }

    fn product_specification(id: &str, version: &str) -> suseconnect_agama::ProductSpecification {
        // We do not expect this to happen.
        let arch = Arch::current().expect("Failed to determine the architecture");
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
    pub fn with_email(mut self, email: &str) -> Self {
        self.email = Some(email.to_string());
        self
    }

    /// Registers the system and return a [Registration] object.
    ///
    /// It announces the system, gets the credentials and registers the base product.
    ///
    /// * `zypp`: zypp instance.
    pub fn register(self, zypp: &zypp_agama::Zypp) -> RegistrationResult<Registration> {
        let params = suseconnect_agama::ConnectParams {
            token: self.code.clone(),
            email: self.email.clone(),
            language: "en-us".to_string().into(),
            // unwrap: it is guaranteed to be a correct URL.
            url: Some(Url::parse(suseconnect_agama::DEFAULT_SCC_URL).unwrap()),
            ..Default::default()
        };
        // https://github.com/agama-project/agama/blob/master/service/lib/agama/registration.rb#L294
        let version = self.version.split(".").next().unwrap_or("1");
        let target_distro = format!("{}-{}-{}", &self.product, version, std::env::consts::ARCH);
        tracing::debug!("Announcing system {target_distro}");
        let creds = suseconnect_agama::announce_system(params.clone(), &target_distro)?;

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
            root_dir: self.root_dir,
            connect_params: params,
            product: self.product.clone(),
            version: self.version.clone(),
            creds,
            services: vec![],
            addons: vec![],
        };

        registration.activate_product(zypp, &self.product, &self.version, None)?;
        Ok(registration)
    }
}
