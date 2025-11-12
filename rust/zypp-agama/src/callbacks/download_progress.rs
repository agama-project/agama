use std::os::raw::{c_char, c_int, c_void};

use crate::{
    callbacks::ProblemResponse,
    helpers::{as_c_void, string_from_ptr},
};

// generic trait to
pub trait Callback {
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

fn get_problem<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadProblemCallback
where
    F: FnMut(String, c_int, String) -> ProblemResponse,
{
    Some(problem::<F>)
}

unsafe extern "C" fn finish<F>(
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

fn get_finish<F>(_closure: &F) -> zypp_agama_sys::ZyppDownloadFinishCallback
where
    F: FnMut(String, c_int, String),
{
    Some(finish::<F>)
}

pub(crate) fn with_callback<R, F>(callbacks: &impl Callback, block: &mut F) -> R
where
    F: FnMut(zypp_agama_sys::DownloadProgressCallbacks) -> R,
{
    let mut start_call = |url: String, localfile: String| callbacks.start(&url, &localfile);
    let cb_start = get_start(&start_call);
    let mut progress_call = |value, url: String, bps_avg, bps_current| {
        callbacks.progress(value, &url, bps_avg, bps_current)
    };
    let cb_progress = get_progress(&progress_call);
    let mut problem_call =
        |url: String, error, description: String| callbacks.problem(&url, error, &description);
    let cb_problem = get_problem(&problem_call);
    let mut finish_call =
        |url: String, error, description: String| callbacks.finish(&url, error, &description);
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
