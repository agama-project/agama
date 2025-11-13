use std::os::raw::{c_char, c_void};

use crate::{
    callbacks::ProblemResponse,
    helpers::{as_c_void, string_from_ptr},
};

pub enum DownloadError {
    NoError,
    NotFound, // the requested Url was not found
    IO,       // IO error
    Invalid,  // the downloaded file is invalid
}

impl From<zypp_agama_sys::DownloadResolvableError> for DownloadError {
    fn from(error: zypp_agama_sys::DownloadResolvableError) -> Self {
        match error {
            zypp_agama_sys::DownloadResolvableError_DRE_NO_ERROR => DownloadError::NoError,
            zypp_agama_sys::DownloadResolvableError_DRE_NOT_FOUND => DownloadError::NotFound,
            zypp_agama_sys::DownloadResolvableError_DRE_IO => DownloadError::IO,
            zypp_agama_sys::DownloadResolvableError_DRE_INVALID => DownloadError::Invalid,
            _ => {
                tracing::error!("Unknown error code {:?}", error);
                DownloadError::Invalid
            }
        }
    }
}

impl ToString for DownloadError {
    fn to_string(&self) -> String {
        match self {
            DownloadError::NoError => "NoError".to_string(),
            DownloadError::NotFound => "NotFound".to_string(),
            DownloadError::IO => "IO".to_string(),
            DownloadError::Invalid => "Invalid".to_string(),
        }
    }
}

pub enum GPGCheckResult {
    Ok,         // Signature is OK.
    NotFound,   // Signature is unknown type.
    Fail,       // Signature does not verify.
    NotTrusted, // Signature is OK, but key is not trusted.
    NoKey,      // Public key is unavailable.
    Error,      // File does not exist or can't be opened.
    NoSig,      // File has no gpg signature (only digests).
}

impl From<zypp_agama_sys::GPGCheckPackageResult> for GPGCheckResult {
    fn from(value: zypp_agama_sys::GPGCheckPackageResult) -> Self {
        match value {
            zypp_agama_sys::GPGCheckPackageResult_CHK_OK => GPGCheckResult::Ok,
            zypp_agama_sys::GPGCheckPackageResult_CHK_NOTFOUND => GPGCheckResult::NotFound,
            zypp_agama_sys::GPGCheckPackageResult_CHK_FAIL => GPGCheckResult::Fail,
            zypp_agama_sys::GPGCheckPackageResult_CHK_NOTTRUSTED => GPGCheckResult::NotTrusted,
            zypp_agama_sys::GPGCheckPackageResult_CHK_NOKEY => GPGCheckResult::NoKey,
            zypp_agama_sys::GPGCheckPackageResult_CHK_ERROR => GPGCheckResult::Error,
            zypp_agama_sys::GPGCheckPackageResult_CHK_NOSIG => GPGCheckResult::NoSig,
            _ => {
                tracing::error!("Unknown error code {:?}", value);
                GPGCheckResult::Error
            }
        }
    }
}

pub enum PreloadError {
    NoError,
    NotFound,     // the requested Url was not found
    IO,           // IO error
    AccessDenied, // user authent. failed while accessing restricted file
    Error,        // other error
}

impl From<zypp_agama_sys::DownloadResolvableFileError> for PreloadError {
    fn from(error: zypp_agama_sys::DownloadResolvableFileError) -> Self {
        match error {
            zypp_agama_sys::DownloadResolvableFileError_DRFE_NO_ERROR => PreloadError::NoError,
            zypp_agama_sys::DownloadResolvableFileError_DRFE_NOT_FOUND => PreloadError::NotFound,
            zypp_agama_sys::DownloadResolvableFileError_DRFE_IO => PreloadError::IO,
            zypp_agama_sys::DownloadResolvableFileError_DRFE_ACCESS_DENIED => {
                PreloadError::AccessDenied
            }
            zypp_agama_sys::DownloadResolvableFileError_DRFE_ERROR => PreloadError::Error,
            _ => {
                tracing::error!("Unknown error code {:?}", error);
                PreloadError::Error
            }
        }
    }
}

/// Callbacks for the download phase of a zypp commit.
///
/// This trait provides hooks into the package download process, which consists of two main phases:
///
/// 1.  A parallel preload phase that attempts to download all required packages.
/// 2.  A verification phase that checks the downloaded content, including GPG signatures.
///     In this phase it should also allow to retry of download of specific package ( TODO: verify it )
///
/// These callbacks are a combination of libzypp's `DownloadResolvableReport` and
/// `CommitPreloadReport`. If more callbacks are needed, it can be extended as need arise.
pub trait Callback {
    // callback when start preloading packages during commit phase
    fn start_preload(&self) {}
    // callback when problem occurs during download of resolvable
    fn problem(&self, _name: &str, _error: DownloadError, _description: &str) -> ProblemResponse {
        ProblemResponse::ABORT
    }
    /// Callback after a GPG check is performed on a package.
    ///
    /// This method is called for every package after its GPG signature has been checked,
    /// including when the check is successful (`GPGCheckResult::Ok`). The result of the
    /// check is passed in the `check_result` parameter.
    ///
    /// The implementation can return an `Option<ProblemResponse>` to decide how to proceed.
    /// If `None` is returned, any potential issue (like a failed GPG check) might be
    /// propagated and handled by other callbacks or mechanisms within libzypp.
    fn gpg_check(
        &self,
        _resolvable_name: &str,
        _repo_url: &str,
        _check_result: GPGCheckResult,
    ) -> Option<ProblemResponse> {
        None
    }
    // callback when preload finishes with file either successfully or with error
    fn finish_preload(
        &self,
        _url: &str,
        _local_path: &str,
        _error: PreloadError,
        _error_details: &str,
    ) {
    }
}

// Default progress that do nothing
pub struct EmptyCallback;
impl Callback for EmptyCallback {}

unsafe extern "C" fn start_preload<F>(user_data: *mut c_void)
where
    F: FnMut(),
{
    let user_data = &mut *(user_data as *mut F);
    user_data();
}

fn get_start_preload<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadResolvableStartCallback
where
    F: FnMut(),
{
    Some(start_preload::<F>)
}

unsafe extern "C" fn problem<F>(
    resolvable_name: *const c_char,
    error: zypp_agama_sys::DownloadResolvableError,
    description: *const c_char,
    user_data: *mut c_void,
) -> zypp_agama_sys::PROBLEM_RESPONSE
where
    F: FnMut(String, DownloadError, String) -> ProblemResponse,
{
    let user_data = &mut *(user_data as *mut F);
    let res = user_data(
        string_from_ptr(resolvable_name),
        error.into(),
        string_from_ptr(description),
    );
    res.into()
}

fn get_problem<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadResolvableProblemCallback
where
    F: FnMut(String, DownloadError, String) -> ProblemResponse,
{
    Some(problem::<F>)
}

unsafe extern "C" fn gpg_check<F>(
    resolvable_name: *const c_char,
    repo_url: *const c_char,
    check_result: zypp_agama_sys::GPGCheckPackageResult,
    user_data: *mut c_void,
) -> zypp_agama_sys::OPTIONAL_PROBLEM_RESPONSE
where
    F: FnMut(String, String, GPGCheckResult) -> Option<ProblemResponse>,
{
    let user_data = &mut *(user_data as *mut F);
    let res = user_data(
        string_from_ptr(resolvable_name),
        string_from_ptr(repo_url),
        check_result.into(),
    );
    match res {
        Some(response) => response.into(),
        None => zypp_agama_sys::OPTIONAL_PROBLEM_RESPONSE_OPROBLEM_NONE,
    }
}

fn get_gpg_check<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadResolvableGpgCheckCallback
where
    F: FnMut(String, String, GPGCheckResult) -> Option<ProblemResponse>,
{
    Some(gpg_check::<F>)
}

unsafe extern "C" fn preload_finish<F>(
    url: *const c_char,
    local_path: *const c_char,
    error: zypp_agama_sys::DownloadResolvableFileError,
    details: *const c_char,
    user_data: *mut c_void,
) where
    F: FnMut(String, String, PreloadError, String),
{
    let user_data = &mut *(user_data as *mut F);
    user_data(
        string_from_ptr(url),
        string_from_ptr(local_path),
        error.into(),
        string_from_ptr(details),
    );
}

fn get_preload_finish<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadResolvableFileFinishCallback
where
    F: FnMut(String, String, PreloadError, String),
{
    Some(preload_finish::<F>)
}

pub(crate) fn with_callback<R, F>(callback: &impl Callback, block: &mut F) -> R
where
    F: FnMut(zypp_agama_sys::DownloadResolvableCallbacks) -> R,
{
    let mut start_call = || callback.start_preload();
    let cb_start = get_start_preload(&start_call);
    let mut problem_call =
        |name: String, error, description: String| callback.problem(&name, error, &description);
    let cb_problem = get_problem(&problem_call);
    let mut gpg_check = |name: String, url: String, check_result: GPGCheckResult| {
        callback.gpg_check(&name, &url, check_result)
    };
    let cb_gpg_check = get_gpg_check(&gpg_check);
    let mut finish_call = |url: String, local_path: String, error, details: String| {
        callback.finish_preload(&url, &local_path, error, &details)
    };
    let cb_finish = get_preload_finish(&finish_call);

    let callbacks = zypp_agama_sys::DownloadResolvableCallbacks {
        start_preload: cb_start,
        start_preload_data: as_c_void(&mut start_call),
        problem: cb_problem,
        problem_data: as_c_void(&mut problem_call),
        gpg_check: cb_gpg_check,
        gpg_check_data: as_c_void(&mut gpg_check),
        file_finish: cb_finish,
        file_finish_data: as_c_void(&mut finish_call),
    };
    block(callbacks)
}
