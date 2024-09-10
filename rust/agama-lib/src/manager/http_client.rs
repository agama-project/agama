use crate::{base_http_client::BaseHTTPClient, error::ServiceError};

pub struct ManagerHTTPClient {
    client: BaseHTTPClient,
}

impl ManagerHTTPClient {
    pub fn new() -> Result<Self, ServiceError> {
        Ok(Self {
            client: BaseHTTPClient::new()?,
        })
    }

    pub fn new_with_base(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    pub async fn probe(&self) -> Result<(), ServiceError> {
        // BaseHTTPClient did not anticipate POST without request body
        // so we pass () which is rendered as `null`
        self.client.post_void("/manager/probe_sync", &()).await
    }
}
