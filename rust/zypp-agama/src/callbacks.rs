use std::{fmt, str::FromStr};

pub mod download_progress;
pub mod install;
pub mod pkg_download;
pub mod security;

// empty progress callback
pub fn empty_progress(_value: i64, _text: String) -> bool {
    true
}

pub enum ProblemResponse {
    RETRY,
    ABORT,
    IGNORE,
}

impl From<ProblemResponse> for zypp_agama_sys::PROBLEM_RESPONSE {
    fn from(response: ProblemResponse) -> Self {
        match response {
            ProblemResponse::ABORT => zypp_agama_sys::PROBLEM_RESPONSE_PROBLEM_ABORT,
            ProblemResponse::IGNORE => zypp_agama_sys::PROBLEM_RESPONSE_PROBLEM_IGNORE,
            ProblemResponse::RETRY => zypp_agama_sys::PROBLEM_RESPONSE_PROBLEM_RETRY,
        }
    }
}

impl FromStr for ProblemResponse {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Retry" => Ok(ProblemResponse::RETRY),
            "Ignore" => Ok(ProblemResponse::IGNORE),
            "Abort" => Ok(ProblemResponse::ABORT),
            _ => Err(format!("Unknown action {:?}", s)),
        }
    }
}

impl fmt::Display for ProblemResponse {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            ProblemResponse::ABORT => "Abort",
            ProblemResponse::IGNORE => "Ignore",
            ProblemResponse::RETRY => "Retry",
        };
        write!(f, "{}", s)
    }
}
