use std::{
    fmt::Display,
    os::raw::{c_char, c_int, c_void},
};

use crate::{
    callbacks::ProblemResponse,
    helpers::{as_c_void, string_from_ptr},
};

pub enum DownloadError {
    NoError,
    NotFound,     // the requested Url was not found
    IO,           // IO error
    AccessDenied, // user authent. failed while accessing restricted file
    Error,        // other error
}

impl From<zypp_agama_sys::DownloadProgressError> for DownloadError {
    fn from(error: zypp_agama_sys::DownloadProgressError) -> Self {
        match error {
            zypp_agama_sys::DownloadProgressError_DPE_NO_ERROR => DownloadError::NoError,
            zypp_agama_sys::DownloadProgressError_DPE_NOT_FOUND => DownloadError::NotFound,
            zypp_agama_sys::DownloadProgressError_DPE_ACCESS_DENIED => DownloadError::AccessDenied,
            zypp_agama_sys::DownloadProgressError_DPE_IO => DownloadError::IO,
            zypp_agama_sys::DownloadProgressError_DPE_ERROR => DownloadError::Error,
            _ => {
                tracing::error!("Unknown error code {:?}", error);
                DownloadError::Error
            }
        }
    }
}

impl Display for DownloadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let str = match self {
            DownloadError::NoError => "NoError",
            DownloadError::NotFound => "NotFound",
            DownloadError::IO => "IO",
            DownloadError::AccessDenied => "AccessDenied",
            DownloadError::Error => "Error",
        };
        write!(f, "{}", str)
    }
}

/// A trait for handling download progress callbacks from `libzypp`.
///
/// Implementors of this trait can be used to monitor download of repository
/// metadata in refresh_metadata method (usage can be extended in future).
pub trait Callback {
    /// Called when a download starts.
    ///
    /// # Parameters
    ///
    /// * `_url`: The URL of the file being downloaded.
    /// * `_localfile`: The local path where the file will be stored.
    fn start(&self, _url: String, _localfile: String) {}

    /// Called periodically to report download progress.
    ///
    /// # Parameters
    ///
    /// * `_value`: The progress of the download, typically a percentage from 0 to 100.
    /// * `_url`: The URL of the file being downloaded.
    /// * `_bps_avg`: The average download speed in bytes per second.
    /// * `_bps_current`: The current download speed in bytes per second.
    ///
    /// # Returns
    ///
    /// `true` to continue the download, `false` to abort it.
    fn progress(&self, _value: i32, _url: String, _bps_avg: f64, _bps_current: f64) -> bool {
        true
    }

    /// Called when a problem occurs during the download.
    ///
    /// # Parameters
    ///
    /// * `_url`: The URL of the file being downloaded.
    /// * `_error_id`: The type of error that occurred. [DownloadError::NoError] should not happen.
    /// * `_description`: A human-readable description of the error.
    ///
    /// # Returns
    ///
    /// A [ProblemResponse] indicating how to proceed (e.g., abort, retry, ignore).
    fn problem(
        &self,
        _url: String,
        _error_id: DownloadError,
        _description: String,
    ) -> ProblemResponse {
        ProblemResponse::ABORT
    }

    /// Called when the download finishes, either successfully or with an error.
    ///
    /// # Parameters
    ///
    /// * `_url`: The URL of the downloaded file.
    /// * `_error_id`: [DownloadError::NoError] on success, or the specific error on failure.
    /// * `_reason`: A string providing more details about the finish status.
    fn finish(&self, _url: String, _error_id: DownloadError, _reason: String) {}
}

// Default progress that do nothing
pub struct EmptyCallback;
impl Callback for EmptyCallback {}

unsafe extern "C" fn start<F>(url: *const c_char, localfile: *const c_char, user_data: *mut c_void)
where
    F: FnMut(String, String),
{
    let user_data = &mut *(user_data as *mut F);
    user_data(string_from_ptr(url), string_from_ptr(localfile));
}

fn get_start<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadStartCallback
where
    F: FnMut(String, String),
{
    Some(start::<F>)
}

unsafe extern "C" fn progress<F>(
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

fn get_progress<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadProgressCallback
where
    F: FnMut(i32, String, f64, f64) -> bool,
{
    Some(progress::<F>)
}

unsafe extern "C" fn problem<F>(
    url: *const c_char,
    error: zypp_agama_sys::DownloadProgressError,
    description: *const c_char,
    user_data: *mut c_void,
) -> zypp_agama_sys::PROBLEM_RESPONSE
where
    F: FnMut(String, DownloadError, String) -> ProblemResponse,
{
    let user_data = &mut *(user_data as *mut F);
    let res = user_data(
        string_from_ptr(url),
        error.into(),
        string_from_ptr(description),
    );
    res.into()
}

fn get_problem<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadProblemCallback
where
    F: FnMut(String, DownloadError, String) -> ProblemResponse,
{
    Some(problem::<F>)
}

unsafe extern "C" fn finish<F>(
    url: *const c_char,
    error: zypp_agama_sys::DownloadProgressError,
    reason: *const c_char,
    user_data: *mut c_void,
) where
    F: FnMut(String, DownloadError, String),
{
    let user_data = &mut *(user_data as *mut F);
    user_data(string_from_ptr(url), error.into(), string_from_ptr(reason));
}

fn get_finish<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadFinishCallback
where
    F: FnMut(String, DownloadError, String),
{
    Some(finish::<F>)
}

pub(crate) fn with_callback<R, F>(callbacks: &impl Callback, block: &mut F) -> R
where
    F: FnMut(zypp_agama_sys::DownloadProgressCallbacks) -> R,
{
    let mut start_call = |url: String, localfile: String| callbacks.start(url, localfile);
    let cb_start = get_start(&start_call);
    let mut progress_call = |value, url: String, bps_avg, bps_current| {
        callbacks.progress(value, url, bps_avg, bps_current)
    };
    let cb_progress = get_progress(&progress_call);
    let mut problem_call =
        |url: String, error, description: String| callbacks.problem(url, error, description);
    let cb_problem = get_problem(&problem_call);
    let mut finish_call = |url: String, error, reason: String| callbacks.finish(url, error, reason);
    let cb_finish = get_finish(&finish_call);

    let callbacks = zypp_agama_sys::DownloadProgressCallbacks {
        start: cb_start,
        start_data: as_c_void(&mut start_call),
        progress: cb_progress,
        progress_data: as_c_void(&mut progress_call),
        problem: cb_problem,
        problem_data: as_c_void(&mut problem_call),
        finish: cb_finish,
        finish_data: as_c_void(&mut finish_call),
    };
    block(callbacks)
}
