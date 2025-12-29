use std::{
    ffi::{CString, IntoStringError},
    fmt::Display,
};

use serde_json::{json, Value};

// Safety requirements: inherited from https://doc.rust-lang.org/std/ffi/struct.CStr.html#method.from_ptr
// expects that rust gets control of string pointer
// note: it is different than libzypp bindings where string is still owned by libzypp
pub(crate) unsafe fn string_from_ptr(c_ptr: *mut i8) -> Result<String, IntoStringError> {
    let c_str = CString::from_raw(c_ptr);
    c_str.into_string()
}

/// parameters for SUSE Connect calls.
///
/// Based on https://github.com/SUSE/connect-ng/blob/e5ca95a10faa118f04aa5d3292632592d9f02cdc/internal/connect/config.go#L45
#[derive(serde::Serialize, Default, Debug, Clone)]
pub struct ConnectParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<url::Url>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
}

/// Represents a product to be registered.
#[derive(serde::Serialize, Debug, Clone)]
pub struct ProductSpecification {
    /// The architecture of the product (e.g., "x86_64").
    pub arch: String,
    /// The product identifier (e.g., "SLES").
    pub identifier: String,
    /// The product version (e.g., "15.4").
    pub version: String,
}

/// Represents product and also extensions info from SCC.
/// list of attributes is just selection which agama uses.
#[derive(Debug, Clone)]
pub struct Product {
    pub identifier: String,
    pub version: String,
    pub friendly_name: String,
    pub available: bool,
    pub free: bool,
    pub recommended: bool,
    pub description: String,
    pub release_stage: String,
    pub extensions: Vec<Product>,
}

impl TryFrom<Value> for Product {
    type Error = Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        let Some(identifier) = value.get("identifier").and_then(Value::as_str) else {
            return Err(Error::UnexpectedResponse(
                "Missing or invalid 'identifier' in Product".to_string(),
            ));
        };
        let Some(version) = value.get("version").and_then(Value::as_str) else {
            return Err(Error::UnexpectedResponse(
                "Missing or invalid 'version' in Product".to_string(),
            ));
        };
        let Some(friendly_name) = value.get("friendly_name").and_then(Value::as_str) else {
            return Err(Error::UnexpectedResponse(
                "Missing or invalid 'friendly_name' in Product".to_string(),
            ));
        };
        let Some(available) = value.get("available").and_then(Value::as_bool) else {
            return Err(Error::UnexpectedResponse(
                "Missing or invalid 'available' in Product".to_string(),
            ));
        };
        let Some(free) = value.get("free").and_then(Value::as_bool) else {
            return Err(Error::UnexpectedResponse(
                "Missing or invalid 'free' in Product".to_string(),
            ));
        };
        let Some(recommended) = value.get("recommended").and_then(Value::as_bool) else {
            return Err(Error::UnexpectedResponse(
                "Missing or invalid 'recommended' in Product".to_string(),
            ));
        };
        let Some(description) = value.get("description").and_then(Value::as_str) else {
            return Err(Error::UnexpectedResponse(
                "Missing or invalid 'description' in Product".to_string(),
            ));
        };
        let Some(release_stage) = value.get("release_stage").and_then(Value::as_str) else {
            return Err(Error::UnexpectedResponse(
                "Missing or invalid 'release_stage' in Product".to_string(),
            ));
        };
        let empty_extensions = vec![];
        let extensions_val = value
            .get("extensions")
            .and_then(Value::as_array)
            .unwrap_or(&empty_extensions);

        let extensions = extensions_val
            .iter()
            .map(|v| Product::try_from(v.clone()))
            .collect::<Result<Vec<Product>, _>>()?;

        Ok(Product {
            identifier: identifier.to_string(),
            version: version.to_string(),
            friendly_name: friendly_name.to_string(),
            available,
            free,
            recommended,
            description: description.to_string(),
            release_stage: release_stage.to_string(),
            extensions,
        })
    }
}

/// Represents a service returned from registration to be added to libzypp.
#[derive(Debug, Clone)]
pub struct Service {
    /// The name of the service that can be used in libzypp. It can be used as alias in libzypp.
    pub name: String,
    /// The URL of the service.
    pub url: String,
}

impl TryFrom<Value> for Service {
    type Error = Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        let Some(name) = value.get("name").and_then(Value::as_str) else {
            return Err(Error::UnexpectedResponse("Missing name key".to_string()));
        };
        let Some(url) = value.get("url").and_then(Value::as_str) else {
            return Err(Error::UnexpectedResponse("Missing url key".to_string()));
        };

        Ok(Self {
            url: url.to_string(),
            name: name.to_string(),
        })
    }
}

/// SSL Error codes returned from SUSEConnect.
/// Based on https://github.com/SUSE/connect-ng/blob/5a200487c50d9c955708b34d0d35ebef47dc5a3e/third_party/libsuseconnect/libsuseconnect.go#L292
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u64)]
pub enum SSLErrorCode {
    /// Certificate has expired.
    Expired = 10,
    /// Self-signed certificate.
    SelfSignedCert = 18,
    /// Self-signed certificate in certificate chain.
    SelfSignedCertInChain = 19,
    /// Unable to get local issuer certificate.
    NoLocalIssuerCertificate = 20,
    /// Other SSL errors
    Other = 21,
}

impl Display for SSLErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Self::Expired => "Certificate has expired",
                Self::SelfSignedCert => "Self signed certificate",
                Self::SelfSignedCertInChain => "Self signed certificate in certificate chain",
                Self::NoLocalIssuerCertificate => "Unable to get local issuer certificate",
                Self::Other => "Other SSL error",
            }
        )
    }
}

impl SSLErrorCode {
    pub fn from_u64(code: u64) -> Self {
        match code {
            10 => Self::Expired,
            18 => Self::SelfSignedCert,
            19 => Self::SelfSignedCertInChain,
            20 => Self::NoLocalIssuerCertificate,
            _ => Self::Other,
        }
    }

    pub fn is_fixable_by_import(&self) -> bool {
        matches!(self, Self::SelfSignedCert | Self::SelfSignedCertInChain)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{message}")]
    SCCApi {
        message: String,
        // HTTP error code from API - It is full integer size, same as in suseconnect
        code: i64,
    },
    #[error("Unknown error: {0}")]
    Unknown(String),
    #[error("Unexpected response from SUSEConnect: {0}")]
    UnexpectedResponse(String),
    #[error(transparent)]
    JSONResponse(#[from] serde_json::Error),
    #[error("Malformed SCC credentials file: {0}")]
    MalformedSccCredentialsFile(String),
    #[error("Missing SCC credentials file: {0}")]
    MissingCredentialsFile(String),
    #[error("Passed JSON error: {0}")]
    JSONPassed(String),
    #[error("Network error: {0}")]
    Network(String),
    #[error("Timeout: {0}")]
    Timeout(String),
    // TODO: check how it will look like if code display message won't be duplicite to connect message
    #[error("SSL error: {message} (code: {code})")]
    SSL {
        message: String,
        code: SSLErrorCode,
        current_certificate: String,
    },
    #[error(transparent)]
    UTF8(#[from] std::ffi::IntoStringError),
    #[error("Malformed string with '\\0' passed to C bindings")]
    MalformedString(#[from] std::ffi::NulError),
}

/// checks response from SUSEConnect for errors
///
/// ruby counterpart is at https://github.com/SUSE/connect-ng/blob/main/third_party/yast/lib/suse/toolkit/shim_utils.rb#L32
fn check_error(response: &Value) -> Result<(), Error> {
    if let Some(error) = response.get("err_type") {
        let Some(error_str) = error.as_str() else {
            return Err(Error::UnexpectedResponse(response.to_string()));
        };
        let message = response
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("No message")
            .to_string();

        match error_str {
            "APIError" => {
                let code = response.get("code").and_then(|i| i.as_i64()).unwrap_or(400);
                return Err(Error::SCCApi { message, code });
            }
            "MalformedSccCredentialsFile" => {
                return Err(Error::MalformedSccCredentialsFile(message))
            }
            "MissingCredentialsFile" => return Err(Error::MissingCredentialsFile(message)),
            "JSONError" => return Err(Error::JSONPassed(message)),
            "NetError" => return Err(Error::Network(message)),
            "Timeout" => return Err(Error::Timeout(message)),
            "SSLError" => {
                let code = response.get("code").and_then(|i| i.as_u64()).unwrap_or(0);
                let current_certificate = response
                    .get("data")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                return Err(Error::SSL {
                    message,
                    code: SSLErrorCode::from_u64(code),
                    current_certificate,
                });
            }
            _ => {
                return Err(Error::Unknown(response.to_string()));
            }
        }
    }
    Ok(())
}

/// SCC/System credentails
///
/// Data returned from announce call at https://github.com/SUSE/connect-ng/blob/main/third_party/yast/lib/suse/connect/yast.rb#L57
#[derive(Debug, Clone)]
pub struct Credentials {
    pub login: String,
    pub password: String,
}

impl TryFrom<Value> for Credentials {
    type Error = Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        let Some(credentials) = value.get("credentials").and_then(Value::as_array) else {
            return Err(Error::UnexpectedResponse(
                "Missing credentials key".to_string(),
            ));
        };
        let Some(login) = credentials.get(0).and_then(Value::as_str) else {
            return Err(Error::UnexpectedResponse("Missing login key".to_string()));
        };
        let Some(password) = credentials.get(1).and_then(Value::as_str) else {
            return Err(Error::UnexpectedResponse(
                "Missing password key".to_string(),
            ));
        };

        Ok(Self {
            login: login.to_string(),
            password: password.to_string(),
        })
    }
}

/// Announce system to SCC to get registration credentials.
///
/// # Arguments
///
/// * `params` - Parameters for the connection, like URL or authentication token.
/// * `target_distro` - The target distribution to announce.
///
/// # Returns
///
/// On success, returns `Ok(Credentials)` containing the system credentials that can be used
/// for subsequent [Self::create_credentials_file] call.
///
/// # Errors
///
/// Returns an `Err` of type [Error] if the announcement fails due to network issues,
/// API errors, or problems parsing the response.
pub fn announce_system(params: ConnectParams, target_distro: &str) -> Result<Credentials, Error> {
    let result_s = unsafe {
        let param_json = json!(params).to_string();
        let params_c_ptr = CString::new(param_json)?.into_raw();
        let distro_c_ptr = CString::new(target_distro)?.into_raw();

        let result_ptr = suseconnect_agama_sys::announce_system(params_c_ptr, distro_c_ptr);

        // Retake ownership to free memory
        let _ = CString::from_raw(params_c_ptr);
        let _ = CString::from_raw(distro_c_ptr);

        string_from_ptr(result_ptr)
    }?;

    let response: Value = serde_json::from_str(&result_s)?;
    check_error(&response)?;

    response.try_into()
}

/// Activates a product with SUSE Customer Center.
///
/// # Arguments
///
/// * `product` - The [Product] to activate.
/// * `params` - Parameters [ConnectParams] for the connection.
/// * `email` - The email address to associate with the activation. Can be empty.
///
/// # Returns
///
/// On success, returns `Ok(Service)` containing the [Service] details for libzypp.
///
/// # Errors
///
/// Returns an `Err` of type [Error] if activation fails.
pub fn activate_product(
    product: ProductSpecification,
    params: ConnectParams,
    email: &str,
) -> Result<Service, Error> {
    let result_s = unsafe {
        let product_json = json!(product).to_string();
        let params_json = json!(params).to_string();

        let product_c_ptr = CString::new(product_json)?.into_raw();
        let params_c_ptr = CString::new(params_json)?.into_raw();
        let email_c_ptr = CString::new(email)?.into_raw();

        let result_ptr =
            suseconnect_agama_sys::activate_product(params_c_ptr, product_c_ptr, email_c_ptr);

        // Retake ownership to free memory
        let _ = CString::from_raw(product_c_ptr);
        let _ = CString::from_raw(params_c_ptr);
        let _ = CString::from_raw(email_c_ptr);

        string_from_ptr(result_ptr)
    }?;

    let response: Value = serde_json::from_str(&result_s)?;
    check_error(&response)?;

    response.try_into()
}

/// Default path to the global SUSE Customer Center credentials file.
pub const GLOBAL_CREDENTIALS_FILE: &str = "/etc/zypp/credentials.d/SCCcredentials";

/// Creates a credentials file for SUSE Customer Center.
///
/// This function writes the provided username and password to a file at the specified path
/// in the format expected by SUSEConnect.
///
/// # Arguments
///
/// * `login` - The username for the credentials file.
/// * `pwd` - The password for the credentials file.
/// * `path` - The path where the credentials file will be created.
pub fn create_credentials_file(login: &str, pwd: &str, path: &str) -> Result<(), Error> {
    // unwrap should not happen we do not construct invalid strings
    let login = CString::new(login)?.into_raw();
    let pwd = CString::new(pwd)?.into_raw();
    let path = CString::new(path)?.into_raw();
    // pass empty string same as connect do it  https://github.com/SUSE/connect-ng/blob/main/third_party/yast/lib/suse/connect/yast.rb#L169
    let empty = CString::new("")?.into_raw();

    unsafe {
        suseconnect_agama_sys::create_credentials_file(login, pwd, empty, path);

        // Retake ownership to free memory
        let _ = CString::from_raw(login);
        let _ = CString::from_raw(pwd);
        let _ = CString::from_raw(path);
        let _ = CString::from_raw(empty);
    }

    Ok(())
}

/// Reloads SUSE Customer Center certificates.
///
/// This triggers a refresh of the SSL certificates stored internally in SUSE connect.
/// It is useful after importing certificate after SSL failure.
///
/// Returns `Ok(())` on success.
///
/// # Errors
///
/// Returns an `Err` of type [Error] if reloading certificates fails, for example due
/// to network errors or if the server response indicates a problem.
pub fn reload_certificates() -> Result<(), Error> {
    let result_s = unsafe {
        let result_ptr = suseconnect_agama_sys::reload_certificates();
        string_from_ptr(result_ptr)
    }?;

    let response: Value = serde_json::from_str(&result_s)?;
    check_error(&response)
}

/// scc config path
///
/// source: https://github.com/SUSE/connect-ng/blob/main/third_party/yast/lib/suse/connect/config.rb#L9
pub const DEFAULT_CONFIG_FILE: &str = "/etc/SUSEConnect";
/// default URL used if not specified otherwise
pub const DEFAULT_SCC_URL: &str = "https://scc.suse.com";
///
/// Writes the config file with the given parameters, overwriting any existing contents.
///
/// Attributes not defined in `params` will not be modified.
///
/// # Arguments
///
/// * `params` - Parameters [ConnectParams] to override the SUSEConnect config.
///
/// # Errors
/// Returns an `Err` of type `Error` if writing the configuration fails.
pub fn write_config(params: ConnectParams) -> Result<(), Error> {
    let result_s = unsafe {
        let param_json = json!(params).to_string();
        let params_c_ptr = CString::new(param_json)?.into_raw();

        let result_ptr = suseconnect_agama_sys::write_config(params_c_ptr);
        let _ = CString::from_raw(params_c_ptr);

        string_from_ptr(result_ptr)
    }?;

    let response: Value = serde_json::from_str(&result_s)?;
    check_error(&response)
}

pub fn show_product(
    product: ProductSpecification,
    params: ConnectParams,
) -> Result<Product, Error> {
    let result_s = unsafe {
        let params_json = json!(params).to_string();
        let product_json = json!(product).to_string();

        let params_c_ptr = CString::new(params_json)?.into_raw();
        let product_c_ptr = CString::new(product_json)?.into_raw();

        let result_ptr = suseconnect_agama_sys::show_product(params_c_ptr, product_c_ptr);

        // Retake ownership to free memory
        let _ = CString::from_raw(params_c_ptr);
        let _ = CString::from_raw(product_c_ptr);

        string_from_ptr(result_ptr)
    }?;

    tracing::info!("show_product result: {result_s}");
    let response: Value = serde_json::from_str(&result_s)?;
    check_error(&response)?;

    response.try_into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use tempfile;

    #[test]
    fn test_check_error_success() {
        let response = json!({"status": "ok"});
        assert!(check_error(&response).is_ok());
    }

    #[test]
    fn test_check_error_api_error() {
        let response = json!({
            "err_type": "APIError",
            "message": "Invalid token",
            "code": 401
        });
        match check_error(&response) {
            Err(Error::SCCApi { message, code }) => {
                assert_eq!(message, "Invalid token");
                assert_eq!(code, 401);
            }
            _ => panic!("Expected ApiError"),
        }
    }

    #[test]
    fn test_check_error_api_error_defaults() {
        let response = json!({
            "err_type": "APIError"
        });
        match check_error(&response) {
            Err(Error::SCCApi { message, code }) => {
                assert_eq!(message, "No message");
                assert_eq!(code, 400);
            }
            _ => panic!("Expected ApiError"),
        }
    }

    #[test]
    fn test_check_error_unknown_error() {
        let response = json!({
            "err_type": "SomeOtherError",
            "details": "Something went wrong"
        });
        match check_error(&response) {
            Err(Error::Unknown(msg)) => {
                assert_eq!(msg, response.to_string());
            }
            _ => panic!("Expected UknownError"),
        }
    }

    #[test]
    fn test_check_error_missing_credentials_file() {
        let response = json!({
            "err_type": "MissingCredentialsFile",
            "message": "File not found"
        });
        match check_error(&response) {
            Err(Error::MissingCredentialsFile(msg)) => {
                assert_eq!(msg, "File not found");
            }
            _ => panic!("Expected MissingCredentialsFile"),
        }
    }

    #[test]
    fn test_check_error_malformed_scc_credentials_file() {
        let response = json!({
            "err_type": "MalformedSccCredentialsFile",
            "message": "File is corrupted"
        });
        match check_error(&response) {
            Err(Error::MalformedSccCredentialsFile(msg)) => {
                assert_eq!(msg, "File is corrupted");
            }
            _ => panic!("Expected MalformedSccCredentialsFile"),
        }
    }

    #[test]
    fn test_check_error_json_error() {
        let response = json!({
            "err_type": "JSONError",
            "message": "Invalid JSON"
        });
        match check_error(&response) {
            Err(Error::JSONPassed(msg)) => {
                assert_eq!(msg, "Invalid JSON");
            }
            _ => panic!("Expected JSONError"),
        }
    }

    #[test]
    fn test_check_error_net_error() {
        let response = json!({
            "err_type": "NetError",
            "message": "Network is down"
        });
        match check_error(&response) {
            Err(Error::Network(msg)) => {
                assert_eq!(msg, "Network is down");
            }
            _ => panic!("Expected NetError"),
        }
    }

    #[test]
    fn test_check_error_timeout() {
        let response = json!({
            "err_type": "Timeout",
            "message": "Connection timed out"
        });
        match check_error(&response) {
            Err(Error::Timeout(msg)) => {
                assert_eq!(msg, "Connection timed out");
            }
            _ => panic!("Expected Timeout"),
        }
    }

    #[test]
    fn test_check_error_ssl_error() {
        let cert = "-----BEGIN CERTIFICATE-----\n...";
        let response = json!({
            "err_type": "SSLError",
            "message": "Certificate expired",
            "code": 10,
            "data": cert
        });
        match check_error(&response) {
            Err(Error::SSL {
                message,
                code,
                current_certificate,
            }) => {
                assert_eq!(message, "Certificate expired");
                assert_eq!(code, SSLErrorCode::Expired);
                assert_eq!(current_certificate, cert);
            }
            _ => panic!("Expected SSLError"),
        }
    }

    #[test]
    fn test_create_credentials_file() {
        let temp_file = tempfile::NamedTempFile::new().unwrap();
        let path_str = temp_file.path().to_str().unwrap();

        let login = "test_user";
        let password = "test_password";

        let _ = create_credentials_file(login, password, path_str);

        let content =
            fs::read_to_string(temp_file.path()).expect("Failed to read credentials file");

        assert!(
            content.contains(&format!("username={}", login)),
            "Missing/Wrong username section in {content}"
        );
        assert!(
            content.contains(&format!("password={}", password)),
            "Missing/Wrong password section in {content}"
        );
    }

    #[test]
    fn test_credentials_try_from_success() {
        let value = json!({
            "credentials": ["user", "pass"]
        });
        let credentials = Credentials::try_from(value).unwrap();
        assert_eq!(credentials.login, "user");
        assert_eq!(credentials.password, "pass");
    }

    #[test]
    fn test_credentials_try_from_missing_credentials_key() {
        let value = json!({});
        let result = Credentials::try_from(value);
        assert!(matches!(result, Err(Error::UnexpectedResponse(_))));
    }

    #[test]
    fn test_credentials_try_from_credentials_not_array() {
        let value = json!({"credentials": "not-an-array"});
        let result = Credentials::try_from(value);
        assert!(matches!(result, Err(Error::UnexpectedResponse(_))));
    }

    #[test]
    fn test_credentials_try_from_missing_login() {
        let value = json!({"credentials": []});
        let result = Credentials::try_from(value);
        assert!(matches!(result, Err(Error::UnexpectedResponse(_))));
    }

    #[test]
    fn test_credentials_try_from_missing_password() {
        let value = json!({"credentials": ["user"]});
        let result = Credentials::try_from(value);
        assert!(matches!(result, Err(Error::UnexpectedResponse(_))));
    }

    #[test]
    fn test_credentials_try_from_wrong_types() {
        let value = json!({"credentials": [123, 456]});
        let result = Credentials::try_from(value);
        assert!(matches!(result, Err(Error::UnexpectedResponse(_))));
    }

    #[test]
    fn test_reload_certificates_smoke() {
        // This is a smoke test to ensure the FFI call can be executed
        // without panicking. It calls the actual underlying C function.
        // The expectation is that in a test environment, this call is a no-op
        // and succeeds without altering system certificates.
        let result = reload_certificates();
        assert!(result.is_ok(), "reload_certificates() failed: {:?}", result);
    }

    #[test]
    fn test_product_try_from_success() {
        let value = json!({
            "identifier": "SLES",
            "version": "15-SP4",
            "friendly_name": "SUSE Linux Enterprise Server 15 SP4",
            "available": true,
            "free": false,
            "recommended": true,
            "description": "SUSE Linux Enterprise Server 15 SP4",
            "release_stage": "released",
            "extensions": [
                {
                    "identifier": "sle-module-basesystem",
                    "version": "15-SP4",
                    "friendly_name": "Basesystem Module",
                    "available": true,
                    "free": true,
                    "recommended": false,
                    "description": "Basesystem Module",
                    "release_stage": "beta"
                }
            ]
        });
        let product = Product::try_from(value).unwrap();
        assert_eq!(product.identifier, "SLES");
        assert_eq!(product.version, "15-SP4");
        assert_eq!(product.friendly_name, "SUSE Linux Enterprise Server 15 SP4");
        assert!(product.available);
        assert!(!product.free);
        assert!(product.recommended);
        assert_eq!(product.description, "SUSE Linux Enterprise Server 15 SP4");
        assert_eq!(product.release_stage, "released");
        assert_eq!(product.extensions.len(), 1);

        let extension = &product.extensions[0];
        assert_eq!(extension.identifier, "sle-module-basesystem");
        assert_eq!(extension.version, "15-SP4");
        assert_eq!(extension.friendly_name, "Basesystem Module");
        assert!(extension.available);
        assert!(extension.free);
        assert!(!extension.recommended);
        assert_eq!(extension.description, "Basesystem Module");
        assert_eq!(extension.release_stage, "beta");
        assert!(extension.extensions.is_empty());
    }

    #[test]
    fn test_product_try_from_missing_field() {
        let value = json!({ "version": "15-SP4" });
        let result = Product::try_from(value);
        assert!(matches!(result, Err(Error::UnexpectedResponse(_))));
    }
}
