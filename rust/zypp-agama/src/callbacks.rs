use std::{
    os::raw::{c_char, c_int, c_void},
    str::FromStr,
};

use crate::helpers::string_from_ptr;

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

// generic trait to
pub trait DownloadProgress {
    // callback when download start
    fn start(&self, _url: &str, _localfile: &str) {}
    // callback when download is in progress
    fn progress(&self, _value: i32, _url: &str, _bps_avg: f64, _bps_current: f64) -> bool {
        true
    }
    // callback when problem occurs
    fn problem(&self, _url: &str, _error_id: i32, _description: &str) -> ProblemResponse {
        ProblemResponse::ABORT
    }
    // callback when download finishes either successfully or with error
    fn finish(&self, _url: &str, _error_id: i32, _reason: &str) {}
}

// Default progress that do nothing
pub struct EmptyDownloadProgress;
impl DownloadProgress for EmptyDownloadProgress {}

unsafe extern "C" fn download_progress_start<F>(
    url: *const c_char,
    localfile: *const c_char,
    user_data: *mut c_void,
) where
    F: FnMut(String, String),
{
    let user_data = &mut *(user_data as *mut F);
    user_data(string_from_ptr(url), string_from_ptr(localfile));
}

fn get_download_progress_start<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadStartCallback
where
    F: FnMut(String, String),
{
    Some(download_progress_start::<F>)
}

unsafe extern "C" fn download_progress_progress<F>(
    value: c_int,
    url: *const c_char,
    bps_avg: f64,
    bps_current: f64,
    user_data: *mut c_void,
) -> bool
where
    F: FnMut(i32, String, f64, f64) -> bool,
{
    let user_data = &mut *(user_data as *mut F);
    user_data(value, string_from_ptr(url), bps_avg, bps_current)
}

fn get_download_progress_progress<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadProgressCallback
where
    F: FnMut(i32, String, f64, f64) -> bool,
{
    Some(download_progress_progress::<F>)
}

unsafe extern "C" fn download_progress_problem<F>(
    url: *const c_char,
    error: c_int,
    description: *const c_char,
    user_data: *mut c_void,
) -> zypp_agama_sys::PROBLEM_RESPONSE
where
    F: FnMut(String, c_int, String) -> ProblemResponse,
{
    let user_data = &mut *(user_data as *mut F);
    let res = user_data(string_from_ptr(url), error, string_from_ptr(description));
    res.into()
}

fn get_download_progress_problem<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadProblemCallback
where
    F: FnMut(String, c_int, String) -> ProblemResponse,
{
    Some(download_progress_problem::<F>)
}

unsafe extern "C" fn download_progress_finish<F>(
    url: *const c_char,
    error: c_int,
    reason: *const c_char,
    user_data: *mut c_void,
) where
    F: FnMut(String, c_int, String),
{
    let user_data = &mut *(user_data as *mut F);
    user_data(string_from_ptr(url), error, string_from_ptr(reason));
}

fn get_download_progress_finish<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadFinishCallback
where
    F: FnMut(String, c_int, String),
{
    Some(download_progress_finish::<F>)
}

pub(crate) fn with_c_download_callbacks<R, F>(callbacks: &impl DownloadProgress, block: &mut F) -> R
where
    F: FnMut(zypp_agama_sys::DownloadProgressCallbacks) -> R,
{
    let mut start_call = |url: String, localfile: String| callbacks.start(&url, &localfile);
    let cb_start = get_download_progress_start(&start_call);
    let mut progress_call = |value, url: String, bps_avg, bps_current| {
        callbacks.progress(value, &url, bps_avg, bps_current)
    };
    let cb_progress = get_download_progress_progress(&progress_call);
    let mut problem_call =
        |url: String, error, description: String| callbacks.problem(&url, error, &description);
    let cb_problem = get_download_progress_problem(&problem_call);
    let mut finish_call =
        |url: String, error, description: String| callbacks.finish(&url, error, &description);
    let cb_finish = get_download_progress_finish(&finish_call);

    let callbacks = zypp_agama_sys::DownloadProgressCallbacks {
        start: cb_start,
        start_data: &mut start_call as *mut _ as *mut c_void,
        progress: cb_progress,
        progress_data: &mut progress_call as *mut _ as *mut c_void,
        problem: cb_problem,
        problem_data: &mut problem_call as *mut _ as *mut c_void,
        finish: cb_finish,
        finish_data: &mut finish_call as *mut _ as *mut c_void,
    };
    block(callbacks)
}

pub enum DownloadResolvableError {
    NoError,
    NotFound, // the requested Url was not found
    IO,       // IO error
    Invalid,  // the downloaded file is invalid
}

impl From<zypp_agama_sys::DownloadResolvableError> for DownloadResolvableError {
    fn from(error: zypp_agama_sys::DownloadResolvableError) -> Self {
        match error {
            zypp_agama_sys::DownloadResolvableError_DRE_NO_ERROR => {
                DownloadResolvableError::NoError
            }
            zypp_agama_sys::DownloadResolvableError_DRE_NOT_FOUND => {
                DownloadResolvableError::NotFound
            }
            zypp_agama_sys::DownloadResolvableError_DRE_IO => DownloadResolvableError::IO,
            zypp_agama_sys::DownloadResolvableError_DRE_INVALID => DownloadResolvableError::Invalid,
            _ => {
                tracing::error!("Unknown error code {:?}", error);
                DownloadResolvableError::Invalid
            }
        }
    }
}

impl ToString for DownloadResolvableError {
    fn to_string(&self) -> String {
        match self {
            DownloadResolvableError::NoError => "NoError".to_string(),
            DownloadResolvableError::NotFound => "NotFound".to_string(),
            DownloadResolvableError::IO => "IO".to_string(),
            DownloadResolvableError::Invalid => "Invalid".to_string(),
        }
    }
}

pub enum GPGCheckPackageResult {
    Ok,         // Signature is OK.
    NotFound,   // Signature is unknown type.
    Fail,       // Signature does not verify.
    NotTrusted, // Signature is OK, but key is not trusted.
    NoKey,      // Public key is unavailable.
    Error,      // File does not exist or can't be opened.
    NoSig,      // File has no gpg signature (only digests).
}

impl From<zypp_agama_sys::GPGCheckPackageResult> for GPGCheckPackageResult {
    fn from(value: zypp_agama_sys::GPGCheckPackageResult) -> Self {
        match value {
            zypp_agama_sys::GPGCheckPackageResult_CHK_OK => GPGCheckPackageResult::Ok,
            zypp_agama_sys::GPGCheckPackageResult_CHK_NOTFOUND => GPGCheckPackageResult::NotFound,
            zypp_agama_sys::GPGCheckPackageResult_CHK_FAIL => GPGCheckPackageResult::Fail,
            zypp_agama_sys::GPGCheckPackageResult_CHK_NOTTRUSTED => {
                GPGCheckPackageResult::NotTrusted
            }
            zypp_agama_sys::GPGCheckPackageResult_CHK_NOKEY => GPGCheckPackageResult::NoKey,
            zypp_agama_sys::GPGCheckPackageResult_CHK_ERROR => GPGCheckPackageResult::Error,
            zypp_agama_sys::GPGCheckPackageResult_CHK_NOSIG => GPGCheckPackageResult::NoSig,
            _ => {
                tracing::error!("Unknown error code {:?}", value);
                GPGCheckPackageResult::Error
            }
        }
    }
}

pub enum DownloadResolvableFileError {
    NoError,
    NotFound,     // the requested Url was not found
    IO,           // IO error
    AccessDenied, // user authent. failed while accessing restricted file
    Error,        // other error
}

impl From<zypp_agama_sys::DownloadResolvableFileError> for DownloadResolvableFileError {
    fn from(error: zypp_agama_sys::DownloadResolvableFileError) -> Self {
        match error {
            zypp_agama_sys::DownloadResolvableFileError_DRFE_NO_ERROR => {
                DownloadResolvableFileError::NoError
            }
            zypp_agama_sys::DownloadResolvableFileError_DRFE_NOT_FOUND => {
                DownloadResolvableFileError::NotFound
            }
            zypp_agama_sys::DownloadResolvableFileError_DRFE_IO => DownloadResolvableFileError::IO,
            zypp_agama_sys::DownloadResolvableFileError_DRFE_ACCESS_DENIED => {
                DownloadResolvableFileError::AccessDenied
            }
            zypp_agama_sys::DownloadResolvableFileError_DRFE_ERROR => {
                DownloadResolvableFileError::Error
            }
            _ => {
                tracing::error!("Unknown error code {:?}", error);
                DownloadResolvableFileError::Error
            }
        }
    }
}

// generic trait to
pub trait PkgDownloadCallbacks {
    // callback when start preloading packages during commit phase
    fn start_preload(&self) {}
    // callback when problem occurs during download of resolvable
    fn problem(
        &self,
        _name: &str,
        _error: DownloadResolvableError,
        _description: &str,
    ) -> ProblemResponse {
        ProblemResponse::ABORT
    }
    // callback after gpg check is done
    fn gpg_check(
        &self,
        _resolvable_name: &str,
        _repo_url: &str,
        _check_result: GPGCheckPackageResult,
    ) -> ProblemResponse {
        ProblemResponse::ABORT
    }
    // callback when download finishes either successfully or with error
    fn finish(
        &self,
        _url: &str,
        _local_path: &str,
        _error: DownloadResolvableFileError,
        _error_details: &str,
    ) {
    }
}

// Default progress that do nothing
pub struct EmptyPkgDownloadCallbacks;
impl PkgDownloadCallbacks for EmptyPkgDownloadCallbacks {}

unsafe extern "C" fn pkg_download_progress_start_preload<F>(user_data: *mut c_void)
where
    F: FnMut(),
{
    let user_data = &mut *(user_data as *mut F);
    user_data();
}

fn get_pkg_download_progress_start_preload<F>(
    _closure: &F,
) -> zypp_agama_sys::ZyppDownloadResolvableStartCallback
where
    F: FnMut(),
{
    Some(pkg_download_progress_start_preload::<F>)
}

unsafe extern "C" fn pkg_download_progress_problem<F>(
    resolvable_name: *const c_char,
    error: zypp_agama_sys::DownloadResolvableError,
    description: *const c_char,
    user_data: *mut c_void,
) -> zypp_agama_sys::PROBLEM_RESPONSE
where
    F: FnMut(String, DownloadResolvableError, String) -> ProblemResponse,
{
    let user_data = &mut *(user_data as *mut F);
    let res = user_data(
        string_from_ptr(resolvable_name),
        error.into(),
        string_from_ptr(description),
    );
    res.into()
}

fn get_pkg_download_problem<F>(
    _closure: &F,
) -> zypp_agama_sys::ZyppDownloadResolvableProblemCallback
where
    F: FnMut(String, DownloadResolvableError, String) -> ProblemResponse,
{
    Some(pkg_download_progress_problem::<F>)
}

unsafe extern "C" fn pkg_download_gpg_check<F>(
    resolvable_name: *const c_char,
    repo_url: *const c_char,
    check_result: zypp_agama_sys::GPGCheckPackageResult,
    user_data: *mut c_void,
) -> zypp_agama_sys::PROBLEM_RESPONSE
where
    F: FnMut(String, String, GPGCheckPackageResult) -> ProblemResponse,
{
    let user_data = &mut *(user_data as *mut F);
    let res = user_data(
        string_from_ptr(resolvable_name),
        string_from_ptr(repo_url),
        check_result.into(),
    );
    res.into()
}

fn get_pkg_download_gpg_check<F>(
    _closure: &F,
) -> zypp_agama_sys::ZyppDownloadResolvableGpgCheckCallback
where
    F: FnMut(String, String, GPGCheckPackageResult) -> ProblemResponse,
{
    Some(pkg_download_gpg_check::<F>)
}

unsafe extern "C" fn pkg_download_file_finish<F>(
    url: *const c_char,
    local_path: *const c_char,
    error: zypp_agama_sys::DownloadResolvableFileError,
    details: *const c_char,
    user_data: *mut c_void,
) where
    F: FnMut(String, String, DownloadResolvableFileError, String),
{
    let user_data = &mut *(user_data as *mut F);
    user_data(
        string_from_ptr(url),
        string_from_ptr(local_path),
        error.into(),
        string_from_ptr(details),
    );
}

fn get_pkg_download_file_finish<F>(
    _closure: &F,
) -> zypp_agama_sys::ZyppDownloadResolvableFileFinishCallback
where
    F: FnMut(String, String, DownloadResolvableFileError, String),
{
    Some(pkg_download_file_finish::<F>)
}

pub(crate) fn with_c_commit_download_callbacks<R, F>(
    callbacks: &impl PkgDownloadCallbacks,
    block: &mut F,
) -> R
where
    F: FnMut(zypp_agama_sys::DownloadResolvableCallbacks) -> R,
{
    let mut start_call = || callbacks.start_preload();
    let cb_start = get_pkg_download_progress_start_preload(&start_call);
    let mut problem_call =
        |name: String, error, description: String| callbacks.problem(&name, error, &description);
    let cb_problem = get_pkg_download_problem(&problem_call);
    let mut gpg_check = |name: String, url: String, check_result: GPGCheckPackageResult| {
        callbacks.gpg_check(&name, &url, check_result)
    };
    let cb_gpg_check = get_pkg_download_gpg_check(&gpg_check);
    let mut finish_call = |url: String, local_path: String, error, details: String| {
        callbacks.finish(&url, &local_path, error, &details)
    };
    let cb_finish = get_pkg_download_file_finish(&finish_call);

    let callbacks = zypp_agama_sys::DownloadResolvableCallbacks {
        start_preload: cb_start,
        start_preload_data: &mut start_call as *mut _ as *mut c_void,
        problem: cb_problem,
        problem_data: &mut problem_call as *mut _ as *mut c_void,
        gpg_check: cb_gpg_check,
        gpg_check_data: &mut gpg_check as *mut _ as *mut c_void,
        file_finish: cb_finish,
        file_finish_data: &mut finish_call as *mut _ as *mut c_void,
    };
    block(callbacks)
}
