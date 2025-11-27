use std::ffi::CString;

use serde_json::{json, Value};

// Safety requirements: inherited from https://doc.rust-lang.org/std/ffi/struct.CStr.html#method.from_ptr
pub(crate) unsafe fn string_from_ptr(c_ptr: *const i8) -> String {
    String::from_utf8_lossy(std::ffi::CStr::from_ptr(c_ptr).to_bytes()).into_owned()
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
}

/// checks response from suseconnect for errors
///
/// ruby counterpart is at https://github.com/SUSE/connect-ng/blob/main/third_party/yast/lib/suse/toolkit/shim_utils.rb#L32
fn check_error(response: &Value) -> Result<(), Error> {
    if let Some(error) = response.get("err_type") {
        match error.as_str().unwrap() {
            "APIError" => {
                let message = response
                    .get("message")
                    .and_then(|i| i.as_str())
                    .unwrap_or("No message");
                let code = response.get("code").and_then(|i| i.as_u64()).unwrap_or(400);
                return Err(Error::ApiError {
                    message: message.to_string(),
                    code,
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
    login: String,
    password: String,
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
        let params_c = CString::new(param_json).unwrap();
        let distroc_ = CString::new(target_distro).unwrap();
        let result =
            suseconnect_agama_sys::announce_system(params_c.into_raw(), distroc_.into_raw());
        string_from_ptr(result)
    };

    let response: Value = serde_json::from_str(&result_s)?;
    check_error(&response)?;

    response.try_into()
}
