//! Implements the store for the software settings.

use std::collections::HashMap;

use super::{SoftwareHTTPClient, SoftwareSettings};
use crate::error::ServiceError;

/// Loads and stores the software settings from/to the D-Bus service.
pub struct SoftwareStore {
    software_client: SoftwareHTTPClient,
}

impl SoftwareStore {
    pub fn new() -> Result<SoftwareStore, ServiceError> {
        Ok(Self {
            software_client: SoftwareHTTPClient::new()?,
        })
    }

    pub async fn load(&self) -> Result<SoftwareSettings, ServiceError> {
        let patterns = self.software_client.user_selected_patterns().await?;
        Ok(SoftwareSettings { patterns })
    }

    pub async fn store(&self, settings: &SoftwareSettings) -> Result<(), ServiceError> {
        let patterns: HashMap<String, bool> = settings
            .patterns
            .iter()
            .map(|name| (name.to_owned(), true))
            .collect();
        self.software_client.select_patterns(patterns).await?;

        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::base_http_client::BaseHTTPClient;
    use httpmock::prelude::*;
    use std::error::Error;
    use tokio::test; // without this, "error: async functions cannot be used for tests"

    fn software_store(mock_server_url: String) -> SoftwareStore {
        let mut bhc = BaseHTTPClient::default();
        bhc.base_url = mock_server_url;
        let client = SoftwareHTTPClient::new_with_base(bhc);
        SoftwareStore {
            software_client: client,
        }
    }

    #[test]
    async fn test_getting_software() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let software_mock = server.mock(|when, then| {
            when.method(GET).path("/api/software/config");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                    "patterns": {"xfce":true},
                    "product": "Tumbleweed"
                }"#,
                );
        });
        let url = server.url("/api");

        let store = software_store(url);
        let settings = store.load().await?;

        let expected = SoftwareSettings {
            patterns: vec!["xfce".to_owned()],
        };
        // main assertion
        assert_eq!(settings, expected);

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        software_mock.assert();
        Ok(())
    }

    // === attempting to rewrite the above test_getting_software in a more readable way ===
    // One major idea, where the borrow checker wins over me, is this:
    // automate the `software_mock.assert();` by wrapping MockServer in MyMockServer,
    // which will remember all mocks that it hands out and will call assert on them at the end.

    struct CountMockServer {
        delegate: httpmock::MockServer,
        num_mocks: u32,
    }

    impl CountMockServer {
        pub fn start() -> Self {
            Self {
                delegate: MockServer::start(),
                num_mocks: 0,
            }
        }

        pub fn url<S: Into<String>>(&self, path: S) -> String {
            self.delegate.url(path)
        }

        fn mock<F>(&mut self, config_fn: F)
        where
            F: FnOnce(httpmock::When, httpmock::Then),
        {
            let _mock = self.delegate.mock(config_fn);
            self.num_mocks = self.num_mocks + 1;
        }

        // wanted this to be &self, but &mut self does not help either
        fn assert(&self) {
            assert!(self.num_mocks > 0);
        }
    }

    struct MyMockServer<'a> {
        delegate: &'a httpmock::MockServer,
        // Mock has a reference to its originating MockServer,
        // so we must name that lifetimes
        mocks: Vec<httpmock::Mock<'a>>,
    }

    impl<'a> MyMockServer<'a> {
        pub fn start(server: &'a MockServer) -> Self {
            Self {
                delegate: server,
                mocks: vec![],
            }
        }

        pub fn url<S: Into<String>>(&self, path: S) -> String {
            self.delegate.url(path)
        }

        fn mock<F>(&mut self, config_fn: F)
        where
            F: FnOnce(httpmock::When, httpmock::Then),
        {
            let mock = self.delegate.mock(config_fn);
            self.mocks.push(mock);
        }

        // wanted this to be &self, but &mut self does not help either
        fn assert(&self) {
            for mock in &self.mocks {
                mock.assert();
            }
        }
    }

    fn before_this(server: &MockServer) -> (SoftwareStore, MyMockServer) {
        let server = MyMockServer::start(server);
        let url = server.url("/api");
        let store = software_store(url);

        (store, server)
    }

    fn after_this(_store: SoftwareStore, server: &MyMockServer) -> Result<(), Box<dyn Error>> {
        server.assert();
        Ok(())
    }

    #[test]
    async fn test_getting_software_bdd() -> Result<(), Box<dyn Error>> {
        let urserver = MockServer::start();
        let (store, mut server) = before_this(&urserver);

        server.mock(|when, then| {
            when.method(GET).path("/api/software/config");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                        "patterns": {"xfce":true},
                        "product": "Tumbleweed"
                    }"#,
                );
        });

        let settings = store.load().await?;

        let expected = SoftwareSettings {
            patterns: vec!["xfce".to_owned()],
        };
        assert_eq!(settings, expected);

        after_this(store, &server)
    }

    #[test]
    async fn test_setting_software_ok() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let software_mock = server.mock(|when, then| {
            when.method(PUT)
                .path("/api/software/config")
                .header("content-type", "application/json")
                .body(r#"{"patterns":{"xfce":true},"product":null}"#);
            then.status(200);
        });
        let url = server.url("/api");

        let store = software_store(url);
        let settings = SoftwareSettings {
            patterns: vec!["xfce".to_owned()],
        };

        let result = store.store(&settings).await;

        // main assertion
        result?;

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        software_mock.assert();
        Ok(())
    }
}
