use super::proxies::Software1Proxy;
use crate::error::ServiceError;
use serde::Serialize;
use zbus::Connection;

/// Represents a software product
#[derive(Debug, Serialize)]
pub struct Pattern {
    /// Pattern ID (eg., "aaa_base", "gnome")
    pub id: String,
    /// Pattern category (e.g., "Production")
    pub category: String,
    /// Pattern icon path locally on system
    pub icon: String,
    /// Pattern description
    pub description: String,
    /// Pattern summary
    pub summary: String,
    /// Pattern order
    pub order: String
}

/// D-Bus client for the software service
pub struct SoftwareClient<'a> {
    software_proxy: Software1Proxy<'a>,
}

impl<'a> SoftwareClient<'a> {
    pub async fn new(connection: Connection) -> Result<SoftwareClient<'a>, ServiceError> {
        Ok(Self {
            software_proxy: Software1Proxy::new(&connection).await?,
        })
    }

    /// Returns the available patterns
    pub async fn patterns(&self, filtered: bool) -> Result<Vec<Pattern>, ServiceError> {
        let patterns: Vec<Pattern> = self
            .software_proxy
            .list_patterns(filtered)
            .await?
            .into_iter()
            .map(|(id, (category, description, icon, summary, order))| {
                Pattern {
                    id,
                    category,
                    icon,
                    description,
                    summary,
                    order
                }
            })
            .collect();
        Ok(patterns)
    }
}
