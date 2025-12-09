use std::ffi::{CString, IntoStringError};

use serde_json::{json, Value};

// Safety requirements: inherited from https://doc.rust-lang.org/std/ffi/struct.CStr.html#method.from_ptr
// expects that rust get control of string pointer
// note: it is different then libzypp bindings where string is still owned by libzypp
pub(crate) unsafe fn string_from_ptr(c_ptr: *mut i8) -> Result<String, IntoStringError> {
    let c_str = CString::from_raw(c_ptr);
    c_str.into_string()
}

/// parameters for SUSE Connect calls.
///
/// Based on https://github.com/SUSE/connect-ng/blob/main/internal/connect/config.go#L45
#[derive(serde::Serialize)]
pub struct ConnectParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    // TODO: maybe use url instead of string?
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
}

/// Represents a product to be registered.
#[derive(serde::Serialize, Debug, Clone)]
pub struct Product {
    /// The architecture of the product (e.g., "x86_64").
    pub arch: String,
    /// The product identifier (e.g., "SLES").
    pub identifier: String,
    /// The product version (e.g., "15.4").
    pub version: String,
}

/// Represents a service returned from registration to be added to libzypp.
#[derive(serde::Serialize, Debug, Clone)]
pub struct Service {
    /// The name of the service that can be used in libzypp.
    pub name: String,
    /// The URL of the service.
    pub url: String,
}

impl TryFrom<Value> for Service {
    type Error = Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        let Some(name) = value.get("name").and_then(|c| c.as_str()) else {
            return Err(Error::UnexpectedResponse("Missing name key".to_string()));
        };
        let Some(url) = value.get("url").and_then(|c| c.as_str()) else {
            return Err(Error::UnexpectedResponse("Missing url key".to_string()));
        };

        Ok(Self {
            url: url.to_string(),
            name: name.to_string(),
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{message}")]
    ApiError {
        message: String,
        // HTTP error code from API
        code: u64,
    },
    #[error("Unknown error:{0}")]
    UknownError(String),
    #[error("Unexpected response from suse connect: {0}")]
    UnexpectedResponse(String),
    #[error(transparent)]
    JsonParseError(#[from] serde_json::Error),
    #[error("Malformed SCC credentials file: {0}")]
    MalformedSccCredentialsFile(String),
    #[error("Missing SCC credentials file: {0}")]
    MissingCredentialsFile(String),
    #[error("JSON error: {0}")]
    JSONError(String),
    #[error("Network error: {0}")]
    NetError(String),
    #[error("Timeout: {0}")]
    Timeout(String),
    // FIXME use enum for code
    #[error("SSL error: {message} (code: {code})")]
    SSLError {
        message: String,
        code: u64,
        current_certificate: String,
    },
    #[error(transparent)]
    UTF8Error(#[from] std::ffi::IntoStringError),
}

/// checks response from suseconnect for errors
///
/// ruby counterpart is at https://github.com/SUSE/connect-ng/blob/main/third_party/yast/lib/suse/toolkit/shim_utils.rb#L32
fn check_error(response: &Value) -> Result<(), Error> {
    if let Some(error) = response.get("err_type") {
        let Some(error_str) = error.as_str() else {
            return Err(Error::UnexpectedResponse(response.to_string()));
        };
        let message = response
            .get("message")
            .and_then(|i| i.as_str())
            .unwrap_or("No message")
            .to_string();

        match error_str {
            "APIError" => {
                let code = response.get("code").and_then(|i| i.as_u64()).unwrap_or(400);
                return Err(Error::ApiError { message, code });
            }
            "MalformedSccCredentialsFile" => {
                return Err(Error::MalformedSccCredentialsFile(message))
            }
            "MissingCredentialsFile" => return Err(Error::MissingCredentialsFile(message)),
            "JSONError" => return Err(Error::JSONError(message)),
            "NetError" => return Err(Error::NetError(message)),
            "Timeout" => return Err(Error::Timeout(message)),
            "SSLError" => {
                let code = response.get("code").and_then(|i| i.as_u64()).unwrap_or(0);
                let current_certificate = response
                    .get("data")
                    .and_then(|i| i.as_str())
                    .unwrap_or("")
                    .to_string();
                return Err(Error::SSLError {
                    message,
                    code,
                    current_certificate,
                });
            }
            _ => {
                return Err(Error::UknownError(response.to_string()));
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
        let Some(credentials) = value.get("credentials").and_then(|c| c.as_array()) else {
            return Err(Error::UnexpectedResponse(
                "Missing credentials key".to_string(),
            ));
        };
        let Some(login) = credentials.get(0).and_then(|c| c.as_str()) else {
            return Err(Error::UnexpectedResponse("Missing login key".to_string()));
        };
        let Some(password) = credentials.get(1).and_then(|c| c.as_str()) else {
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
        let params_c_ptr = CString::new(param_json).unwrap().into_raw();
        let distro_c_ptr = CString::new(target_distro).unwrap().into_raw();

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
    product: Product,
    params: ConnectParams,
    email: &str,
) -> Result<Service, Error> {
    let result_s = unsafe {
        let product_json = json!(product).to_string();
        let params_json = json!(params).to_string();

        let product_c_ptr = CString::new(product_json).unwrap().into_raw();
        let params_c_ptr = CString::new(params_json).unwrap().into_raw();
        let email_c_ptr = CString::new(email).unwrap().into_raw();

        let result_ptr =
            suseconnect_agama_sys::activate_product(product_c_ptr, params_c_ptr, email_c_ptr);

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
pub fn create_credentials_file(login: &str, pwd: &str, path: &str) -> () {
    unsafe {
        // unwrap should not happen we do not construct invalid strings
        let login = CString::new(login).unwrap().into_raw();
        let pwd = CString::new(pwd).unwrap().into_raw();
        let path = CString::new(path).unwrap().into_raw();
        let empty = CString::new("").unwrap().into_raw();

        suseconnect_agama_sys::create_credentials_file(login, pwd, empty, path);

        // Retake ownership to free memory
        let _ = CString::from_raw(login);
        let _ = CString::from_raw(pwd);
        let _ = CString::from_raw(path);
        let _ = CString::from_raw(empty);
    }
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
        let params_c_ptr = CString::new(param_json).unwrap().into_raw();

        let result_ptr = suseconnect_agama_sys::write_config(params_c_ptr);
        let _ = CString::from_raw(params_c_ptr);

        string_from_ptr(result_ptr)
    }?;

    let response: Value = serde_json::from_str(&result_s)?;
    check_error(&response)
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
            Err(Error::ApiError { message, code }) => {
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
            Err(Error::ApiError { message, code }) => {
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
            Err(Error::UknownError(msg)) => {
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
            Err(Error::JSONError(msg)) => {
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
            Err(Error::NetError(msg)) => {
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
            Err(Error::SSLError {
                message,
                code,
                current_certificate,
            }) => {
                assert_eq!(message, "Certificate expired");
                assert_eq!(code, 10);
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

        create_credentials_file(login, password, path_str);

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
}
