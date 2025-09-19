use std::os::raw::{c_char, c_int, c_void};

use zypp_agama_sys::{
    DownloadProgressCallbacks, ZyppDownloadFinishCallback, ZyppDownloadProblemCallback,
    ZyppDownloadProgressCallback, ZyppDownloadStartCallback, PROBLEM_RESPONSE,
    PROBLEM_RESPONSE_PROBLEM_ABORT, PROBLEM_RESPONSE_PROBLEM_IGNORE,
    PROBLEM_RESPONSE_PROBLEM_RETRY,
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

impl From<ProblemResponse> for PROBLEM_RESPONSE {
    fn from(response: ProblemResponse) -> Self {
        match response {
            ProblemResponse::ABORT => PROBLEM_RESPONSE_PROBLEM_ABORT,
            ProblemResponse::IGNORE => PROBLEM_RESPONSE_PROBLEM_IGNORE,
            ProblemResponse::RETRY => PROBLEM_RESPONSE_PROBLEM_RETRY,
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

fn get_download_progress_start<F>(_closure: &F) -> ZyppDownloadStartCallback
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

fn get_download_progress_progress<F>(_closure: &F) -> ZyppDownloadProgressCallback
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
) -> PROBLEM_RESPONSE
where
    F: FnMut(String, c_int, String) -> ProblemResponse,
{
    let user_data = &mut *(user_data as *mut F);
    let res = user_data(string_from_ptr(url), error, string_from_ptr(description));
    res.into()
}

fn get_download_progress_problem<F>(_closure: &F) -> ZyppDownloadProblemCallback
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

fn get_download_progress_finish<F>(_closure: &F) -> ZyppDownloadFinishCallback
where
    F: FnMut(String, c_int, String),
{
    Some(download_progress_finish::<F>)
}

pub(crate) fn with_c_download_callbacks<R, F>(callbacks: &impl DownloadProgress, block: &mut F) -> R
where
    F: FnMut(DownloadProgressCallbacks) -> R,
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

    let callbacks = DownloadProgressCallbacks {
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
