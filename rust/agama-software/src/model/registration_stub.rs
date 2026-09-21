// STUB module for 32 bit architectures where suse-connect is not available.
// Basically it do nothing and registration ends with error

use agama_security as security;
use agama_utils::{actor::Handler, api::software::RegistrationInfo};
use camino::Utf8PathBuf;
use url::Url;

use crate::callbacks;
use crate::state::Addon;

#[derive(thiserror::Error, Debug)]
pub enum RegistrationError {
    #[error("Registration is not supported on 32-bit architectures")]
    NotSupported,
    #[error("Failed to add the service {0}: {1}")]
    AddService(String, #[source] zypp_agama::ZyppError),
    #[error("Failed to refresh the service {0}: {1}")]
    RefreshService(String, #[source] zypp_agama::ZyppError),
    #[error("Failed to select product from service {0}: {1}")]
    SelectProduct(String, #[source] zypp_agama::ZyppError),
    #[error("Failed to copy file {0}: {1}")]
    IO(String, #[source] std::io::Error),
    #[error(transparent)]
    Security(#[from] security::service::Error),
}

type RegistrationResult<T> = Result<T, RegistrationError>;

#[derive(Debug)]
pub struct Registration {}

impl Registration {
    pub fn builder(_root_dir: Utf8PathBuf, _product: &str, _version: &str) -> RegistrationBuilder {
        RegistrationBuilder {}
    }

    pub fn register_addon(
        &mut self,
        _zypp: &zypp_agama::Zypp,
        _security: &mut callbacks::Security,
        _addon: &Addon,
    ) -> RegistrationResult<()> {
        Err(RegistrationError::NotSupported)
    }

    pub fn is_addon_registered(&self, _addon: &Addon) -> bool {
        false
    }

    pub fn to_registration_info(&self) -> RegistrationInfo {
        RegistrationInfo {
            code: None,
            email: None,
            url: None,
            addons: vec![],
        }
    }

    pub fn finish(&mut self, _install_dir: &Utf8PathBuf) -> Result<(), RegistrationError> {
        Ok(())
    }

    pub fn base_product_service_name(&self) -> Option<String> {
        None
    }

    pub fn addon_product_service_names(&self) -> Vec<String> {
        vec![]
    }
}

#[derive(Debug)]
pub struct RegistrationBuilder {}

impl RegistrationBuilder {
    pub fn new(_root_dir: Utf8PathBuf, _product: &str, _version: &str) -> Self {
        RegistrationBuilder {}
    }

    pub fn with_code(self, _code: &str) -> Self {
        self
    }

    pub fn with_email(self, _email: &str) -> Self {
        self
    }

    pub fn with_url(self, _url: &Url) -> Self {
        self
    }

    pub fn register(
        &self,
        _zypp: &zypp_agama::Zypp,
        _security: &mut callbacks::Security,
        _security_srv: &Handler<security::Service>,
    ) -> RegistrationResult<Registration> {
        Err(RegistrationError::NotSupported)
    }
}
