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
