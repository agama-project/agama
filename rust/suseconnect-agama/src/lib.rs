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
                return Err(Error::ApiError {
                    message,
                    code,
                });
            }
            "MalformedSccCredentialsFile" => return Err(Error::MalformedSccCredentialsFile(message)),
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

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
                assert_eq!(message, "Certificate validation failed");
                assert_eq!(code, 5);
                assert_eq!(current_certificate, cert);
            }
            _ => panic!("Expected SSLError"),
        }
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
}
