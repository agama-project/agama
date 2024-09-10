use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Software service configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SoftwareConfig {
    /// A map where the keys are the pattern names and the values whether to install them or not.
    pub patterns: Option<HashMap<String, bool>>,
    /// Name of the product to install.
    pub product: Option<String>,
}

/// Software service configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RegistrationParams {
    /// Registration key.
    pub key: String,
    /// Registration email.
    pub email: String,
}

/// Information about registration configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationInfo {
    /// Registration key. Empty value mean key not used or not registered.
    pub key: String,
    /// Registration email. Empty value mean email not used or not registered.
    pub email: String,
    /// if registration is required, optional or not needed for current product.
    /// Change only if selected product is changed.
    pub requirement: RegistrationRequirement,
}

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub enum RegistrationRequirement {
    /// Product does not require registration
    NotRequired = 0,
    /// Product has optional registration
    Optional = 1,
    /// It is mandatory to register the product
    Mandatory = 2,
}

impl TryFrom<u32> for RegistrationRequirement {
    type Error = ();

    fn try_from(v: u32) -> Result<Self, Self::Error> {
        match v {
            x if x == RegistrationRequirement::NotRequired as u32 => {
                Ok(RegistrationRequirement::NotRequired)
            }
            x if x == RegistrationRequirement::Optional as u32 => {
                Ok(RegistrationRequirement::Optional)
            }
            x if x == RegistrationRequirement::Mandatory as u32 => {
                Ok(RegistrationRequirement::Mandatory)
            }
            _ => Err(()),
        }
    }
}
