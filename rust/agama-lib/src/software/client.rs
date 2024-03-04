use super::proxies::Software1Proxy;
use crate::error::ServiceError;
use serde::Serialize;
use std::collections::HashMap;
use zbus::Connection;

/// Represents a software product
#[derive(Debug, Serialize, utoipa::ToSchema)]
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
    pub order: String,
}

/// Represents the reason why a pattern is selected.
#[derive(Clone, Copy)]
pub enum SelectionReason {
    /// The pattern was selected by the user.
    User = 0,
    /// The pattern was selected automatically.
    Auto = 1,
}

impl From<u8> for SelectionReason {
    fn from(value: u8) -> Self {
        match value {
            0 => Self::User,
            _ => Self::Auto,
        }
    }
}

/// D-Bus client for the software service
#[derive(Clone)]
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
            .map(
                |(id, (category, description, icon, summary, order))| Pattern {
                    id,
                    category,
                    icon,
                    description,
                    summary,
                    order,
                },
            )
            .collect();
        Ok(patterns)
    }

    /// Returns the ids of patterns selected by user
    pub async fn user_selected_patterns(&self) -> Result<Vec<String>, ServiceError> {
        let patterns: Vec<String> = self
            .software_proxy
            .selected_patterns()
            .await?
            .into_iter()
            .filter(|(_id, reason)| *reason == SelectionReason::User as u8)
            .map(|(id, _reason)| id)
            .collect();
        Ok(patterns)
    }

    /// Returns the selected pattern and the reason each one selected.
    pub async fn selected_patterns(
        &self,
    ) -> Result<HashMap<String, SelectionReason>, ServiceError> {
        let patterns = self.software_proxy.selected_patterns().await?;
        let patterns = patterns
            .into_iter()
            .map(|(id, reason)| (id, reason.into()))
            .collect();
        Ok(patterns)
    }

    /// Selects patterns by user
    pub async fn select_patterns(&self, patterns: &[String]) -> Result<(), ServiceError> {
        let patterns: Vec<&str> = patterns.iter().map(AsRef::as_ref).collect();
        let wrong_patterns = self
            .software_proxy
            .set_user_patterns(patterns.as_slice())
            .await?;
        if !wrong_patterns.is_empty() {
            Err(ServiceError::UnknownPatterns(wrong_patterns))
        } else {
            Ok(())
        }
    }
}
