use std::
    str::FromStr
;

pub mod download_progress;
pub mod pkg_download;


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

impl ToString for ProblemResponse {
    fn to_string(&self) -> String {
        match self {
            ProblemResponse::ABORT => "Abort".to_string(),
            ProblemResponse::IGNORE => "Ignore".to_string(),
            ProblemResponse::RETRY => "Retry".to_string(),
        }
    }
}

