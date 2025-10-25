use serde::Serialize;

/// Represents a software product
#[derive(Clone, Default, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    /// Product ID (eg., "ALP", "Tumbleweed", etc.)
    pub id: String,
    /// Product name (e.g., "openSUSE Tumbleweed")
    pub name: String,
    /// Product description
    pub description: String,
    /// Product icon (e.g., "default.svg")
    pub icon: String,
    /// Registration requirement
    pub registration: bool,
    /// License ID
    pub license: Option<String>,
}
