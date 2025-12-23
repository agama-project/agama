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

use serde::{Deserialize, Serialize};
use suseconnect_agama::{self, ConnectParams, Credentials};
use url::Url;

pub struct RegistrationBuilder {
    product: String,
    version: String,
    code: Option<String>,
    email: Option<String>,
}

impl RegistrationBuilder {
    pub fn new(product: &str, version: &str) -> Self {
        RegistrationBuilder {
            product: product.to_string(),
            version: version.to_string(),
            code: None,
            email: None,
        }
    }

    pub fn with_code(mut self, code: &str) -> Self {
        self.code = Some(code.to_string());
        self
    }

    pub fn with_email(mut self, email: &str) -> Self {
        self.email = Some(email.to_string());
        self
    }

    pub fn build(self, zypp: &zypp_agama::Zypp) -> Registration {
        let params = suseconnect_agama::ConnectParams {
            token: self.code.clone(),
            ..Default::default()
        };
        // https://github.com/agama-project/agama/blob/master/service/lib/agama/registration.rb#L294
        // FIXME: use the correct arquitecture
        let version = self.version.split(".").next().unwrap_or("1");
        let target_distro = format!("{}-{}-x86_64", &self.product, version);
        let creds = suseconnect_agama::announce_system(params, &target_distro).unwrap();
        tracing::debug!("Announced the system and got credentials {creds:?}");
        suseconnect_agama::create_credentials_file(
            &creds.login,
            &creds.password,
            suseconnect_agama::GLOBAL_CREDENTIALS_FILE,
        )
        .unwrap();

        let mut registration = Registration {
            creds,
            email: self.email,
            services: vec![],
        };

        registration.activate_product(zypp, &self.product, &self.version, None);
        registration
    }
}

const TARGET_DIR: &str = "/run/agama/zypp";

#[derive(Debug)]
pub struct Registration {
    creds: Credentials,
    email: Option<String>,
    services: Vec<suseconnect_agama::Service>,
}

impl Registration {
    pub fn builder(product: &str, version: &str) -> RegistrationBuilder {
        RegistrationBuilder::new(product, version)
    }

    // This activate_product should receive the code
    pub fn activate_product(
        &mut self,
        zypp: &zypp_agama::Zypp,
        name: &str,
        version: &str,
        code: Option<&str>,
    ) {
        let product = self.product_specification(name, version);
        let params = suseconnect_agama::ConnectParams {
            token: code.map(ToString::to_string),
            ..Default::default()
        };
        tracing::debug!("Registering product {product:?} with params {params:?}");
        let service = suseconnect_agama::activate_product(
            product,
            params,
            self.email.as_ref().map(|e| e.as_str()).unwrap_or(""),
        )
        .unwrap();

        if let Some(file) = Self::credentials_from_url(&service.url) {
            let path = format!("{}/{}", TARGET_DIR, file);
            tracing::debug!("Credentials file {} for {:?}", &path, &service);
            suseconnect_agama::create_credentials_file(
                &self.creds.login,
                &self.creds.password,
                path.as_str(),
            )
            .unwrap();
        }

        // add service
        zypp.add_service(&service.name, &service.url).unwrap();
        self.services.push(service);
    }

    fn product_specification(
        &self,
        id: &str,
        version: &str,
    ) -> suseconnect_agama::ProductSpecification {
        suseconnect_agama::ProductSpecification {
            identifier: id.to_string(),
            arch: "x86_64".to_string(),
            version: version.to_string(),
        }
    }

    fn credentials_from_url(url: &str) -> Option<String> {
        let url = Url::parse(url).unwrap();
        url.query_pairs()
            .find(|(k, _v)| k == "credentials")
            .map(|(_k, v)| v.to_string())
    }
}

/// Software service configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RegistrationParams {
    /// Registration key.
    pub key: String,
    /// Registration email.
    pub email: String,
}

/// Addon registration
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddonParams {
    // Addon identifier
    pub id: String,
    // Addon version, if not specified the version is found from the available addons
    pub version: Option<String>,
    // Optional registration code, not required for free extensions
    pub registration_code: Option<String>,
}

/// Information about registration configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationInfo {
    /// Registration status. True if base system is already registered.
    pub registered: bool,
    /// Registration key. Empty value mean key not used or not registered.
    pub key: String,
    /// Registration email. Empty value mean email not used or not registered.
    pub email: String,
    /// Registration URL. Empty value mean that de default value is used.
    pub url: String,
}

#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RegistrationError {
    /// ID of error. See dbus API for possible values
    pub id: u32,
    /// human readable error string intended to be displayed to user
    pub message: String,
}
