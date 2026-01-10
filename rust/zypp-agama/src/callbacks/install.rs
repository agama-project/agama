use std::{
    fmt::Display,
    os::raw::{c_char, c_void},
};

use crate::{
    callbacks::ProblemResponse,
    helpers::{as_c_void, string_from_ptr},
};

#[derive(Debug)]
pub enum InstallError {
    NoError,
    NotFound,
    Io,
    Invalid,
}

impl From<zypp_agama_sys::ZyppInstallPackageError> for InstallError {
    fn from(error: zypp_agama_sys::ZyppInstallPackageError) -> Self {
        match error {
            zypp_agama_sys::ZyppInstallPackageError_PI_NO_ERROR => InstallError::NoError,
            zypp_agama_sys::ZyppInstallPackageError_PI_NOT_FOUND => InstallError::NotFound,
            zypp_agama_sys::ZyppInstallPackageError_PI_IO => InstallError::Io,
            zypp_agama_sys::ZyppInstallPackageError_PI_INVALID => InstallError::Invalid,
            _ => {
                tracing::error!("Unknown install error code {:?}", error);
                InstallError::Invalid
            }
        }
    }
}

impl Display for InstallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let str = match self {
            InstallError::NoError => "NoError",
            InstallError::NotFound => "NotFound",
            InstallError::Io => "Io",
            InstallError::Invalid => "Invalid",
        };
        write!(f, "{}", str)
    }
}

/// A trait for handling package installation callbacks from `libzypp`.
pub trait Callback {
    /// Called when the installation of a package starts.
    fn package_start(&self, _package_name: String) {}

    /// Called when a problem occurs during package installation.
    fn package_problem(
        &self,
        _package_name: String,
        _error: InstallError,
        _description: String,
    ) -> ProblemResponse {
        ProblemResponse::ABORT
    }

    /// Called when a problem occurs in a package installation script (e.g., post-install).
    fn script_problem(&self, _description: String) -> ProblemResponse {
        ProblemResponse::ABORT
    }

    /// Called when the installation of a package finishes.
    fn package_finish(&self, _package_name: String) {}

    /// Executes a block of code with the callbacks configured.
    fn with<R, F>(&mut self, block: &mut F) -> R
    where
        F: FnMut(zypp_agama_sys::InstallCallbacks) -> R,
    {
        let mut start_call = |name| self.package_start(name);
        let cb_start = get_package_start(&start_call);

        let mut problem_call =
            |name, error, description| self.package_problem(name, error, description);
        let cb_problem = get_package_problem(&problem_call);

        let mut script_problem_call = |description| self.script_problem(description);
        let cb_script_problem = get_script_problem(&script_problem_call);

        let mut finish_call = |name| self.package_finish(name);
        let cb_finish = get_package_finish(&finish_call);

        let callbacks = zypp_agama_sys::InstallCallbacks {
            package_start: cb_start,
            package_start_data: as_c_void(&mut start_call),
            package_problem: cb_problem,
            package_problem_data: as_c_void(&mut problem_call),
            script_problem: cb_script_problem,
            script_problem_data: as_c_void(&mut script_problem_call),
            package_finish: cb_finish,
            package_finish_data: as_c_void(&mut finish_call),
        };
        block(callbacks)
    }
}

pub struct EmptyCallback;
impl Callback for EmptyCallback {}

unsafe extern "C" fn package_start<F>(package_name: *const c_char, user_data: *mut c_void)
where
    F: FnMut(String),
{
    let user_data = &mut *(user_data as *mut F);
    user_data(string_from_ptr(package_name));
}

fn get_package_start<F>(_closure: &F) -> zypp_agama_sys::ZyppInstallPackageStartCallback
where
    F: FnMut(String),
{
    Some(package_start::<F>)
}

unsafe extern "C" fn package_problem<F>(
    package_name: *const c_char,
    error: zypp_agama_sys::ZyppInstallPackageError,
    description: *const c_char,
    user_data: *mut c_void,
) -> zypp_agama_sys::PROBLEM_RESPONSE
where
    F: FnMut(String, InstallError, String) -> ProblemResponse,
{
    let user_data = &mut *(user_data as *mut F);
    user_data(
        string_from_ptr(package_name),
        error.into(),
        string_from_ptr(description),
    )
    .into()
}

fn get_package_problem<F>(_closure: &F) -> zypp_agama_sys::ZyppInstallPackageProblemCallback
where
    F: FnMut(String, InstallError, String) -> ProblemResponse,
{
    Some(package_problem::<F>)
}

unsafe extern "C" fn script_problem<F>(
    description: *const c_char,
    user_data: *mut c_void,
) -> zypp_agama_sys::PROBLEM_RESPONSE
where
    F: FnMut(String) -> ProblemResponse,
{
    let user_data = &mut *(user_data as *mut F);
    user_data(string_from_ptr(description)).into()
}

fn get_script_problem<F>(_closure: &F) -> zypp_agama_sys::ZyppInstallScriptProblemCallback
where
    F: FnMut(String) -> ProblemResponse,
{
    Some(script_problem::<F>)
}

unsafe extern "C" fn package_finish<F>(package_name: *const c_char, user_data: *mut c_void)
where
    F: FnMut(String),
{
    let user_data = &mut *(user_data as *mut F);
    user_data(string_from_ptr(package_name));
}

fn get_package_finish<F>(_closure: &F) -> zypp_agama_sys::ZyppInstallPackageFinishCallback
where
    F: FnMut(String),
{
    Some(package_finish::<F>)
}
