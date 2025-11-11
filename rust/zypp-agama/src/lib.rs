use std::{
    ffi::CString,
    os::raw::{c_char, c_uint, c_void},
    sync::Mutex,
};

pub use callbacks::DownloadProgress;
use errors::ZyppResult;
use zypp_agama_sys::{
    get_patterns_info, PatternNames, ProgressCallback, ProgressData, Status, ZyppProgressCallback,
};

pub mod errors;
pub use errors::ZyppError;

mod helpers;
use helpers::{status_to_result, status_to_result_void, string_from_ptr};

use crate::callbacks::PkgDownloadCallbacks;

pub mod callbacks;

#[derive(Debug)]
pub struct Repository {
    pub enabled: bool,
    pub url: String,
    pub alias: String,
    pub user_name: String,
}

impl Repository {
    /// check if url points to local repository.
    /// Can be Err if url is invalid
    pub fn is_local(&self) -> Result<bool, ZyppError> {
        unsafe {
            let c_url = CString::new(self.url.as_str()).unwrap();
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let result = zypp_agama_sys::is_local_url(c_url.as_ptr(), status_ptr);
            status_to_result(status, result)
        }
    }
}

#[derive(Debug)]
pub struct MountPoint {
    pub directory: String,
    pub filesystem: String,
    pub grow_only: bool,
    pub used_size: i64,
}

// TODO: should we add also e.g. serd serializers here?
#[derive(Debug)]
pub struct PatternInfo {
    pub name: String,
    pub category: String,
    pub icon: String,
    pub description: String,
    pub summary: String,
    pub order: String,
    pub selected: ResolvableSelected,
}

// TODO: is there better way how to use type from ProgressCallback binding type?
unsafe extern "C" fn zypp_progress_callback<F>(
    zypp_data: ProgressData,
    user_data: *mut c_void,
) -> bool
where
    F: FnMut(i64, String) -> bool,
{
    let user_data = &mut *(user_data as *mut F);
    user_data(zypp_data.value, string_from_ptr(zypp_data.name))
}

fn get_zypp_progress_callback<F>(_closure: &F) -> ZyppProgressCallback
where
    F: FnMut(i64, String) -> bool,
{
    Some(zypp_progress_callback::<F>)
}

unsafe extern "C" fn progress_callback<F>(
    text: *const c_char,
    stage: c_uint,
    total: c_uint,
    user_data: *mut c_void,
) where
    F: FnMut(String, u32, u32),
{
    let user_data = &mut *(user_data as *mut F);
    user_data(string_from_ptr(text), stage, total);
}

fn get_progress_callback<F>(_closure: &F) -> ProgressCallback
where
    F: FnMut(String, u32, u32),
{
    Some(progress_callback::<F>)
}

/// protection ensure that there is just single zypp lock with single target living
static GLOBAL_LOCK: Mutex<bool> = Mutex::new(false);

/// The only instance of Zypp on which all zypp calls should be invoked.
/// It is intentionally !Send and !Sync as libzypp gives no guarantees regarding
/// threads, so it should be run only in single thread and sequentially.
#[derive(Debug)]
pub struct Zypp {
    ptr: *mut zypp_agama_sys::Zypp,
}

impl Zypp {
    pub fn init_target<F>(root: &str, progress: F) -> ZyppResult<Self>
    where
        // cannot be FnOnce, the whole point of progress callbacks is
        // to provide feedback multiple times
        F: FnMut(String, u32, u32),
    {
        let mut locked = GLOBAL_LOCK
            .lock()
            .map_err(|_| ZyppError::new("thread with zypp lock panic"))?;
        if *locked {
            return Err(ZyppError::new("There is already initialized target"));
        }

        unsafe {
            let mut closure = progress;
            let cb = get_progress_callback(&closure);
            let c_root = CString::new(root).unwrap();
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let inner_zypp = zypp_agama_sys::init_target(
                c_root.as_ptr(),
                status_ptr,
                cb,
                &mut closure as *mut _ as *mut c_void,
            );
            helpers::status_to_result_void(status)?;
            // lock only after we successfully get pointer
            *locked = true;
            let res = Self { ptr: inner_zypp };
            Ok(res)
        }
    }

    pub fn switch_target(&self, root: &str) -> ZyppResult<()> {
        let mut status: Status = Status::default();
        let status_ptr = &mut status as *mut _;
        let c_root = CString::new(root).unwrap();
        unsafe {
            zypp_agama_sys::switch_target(self.ptr, c_root.as_ptr(), status_ptr);
            helpers::status_to_result_void(status)
        }
    }

    pub fn commit(&self, report: &impl PkgDownloadCallbacks) -> ZyppResult<bool> {
        let mut status: Status = Status::default();
        let status_ptr = &mut status as *mut _;
        unsafe {
            let mut commit_fn = |mut callbacks| {
                zypp_agama_sys::commit(self.ptr, status_ptr, &mut callbacks)
            };
            let res = callbacks::with_c_commit_download_callbacks(report, &mut commit_fn);
            helpers::status_to_result(status, res)
        }
    }

    pub fn count_disk_usage(
        &self,
        mut mount_points: Vec<MountPoint>,
    ) -> ZyppResult<Vec<MountPoint>> {
        let mut status: Status = Status::default();
        let status_ptr = &mut status as *mut _;
        unsafe {
            // we need to hold dirs and fss here to ensure that CString lives long enough
            let dirs: Vec<CString> = mount_points
                .iter()
                .map(|mp| {
                    CString::new(mp.directory.as_str())
                        .expect("CString must not contain internal NUL")
                })
                .collect();
            let fss: Vec<CString> = mount_points
                .iter()
                .map(|mp| {
                    CString::new(mp.filesystem.as_str())
                        .expect("CString must not contain internal NUL")
                })
                .collect();
            let libzypp_mps: Vec<_> = mount_points
                .iter()
                .enumerate()
                .map(|(i, mp)| zypp_agama_sys::MountPoint {
                    directory: dirs[i].as_ptr(),
                    filesystem: fss[i].as_ptr(),
                    grow_only: mp.grow_only,
                    used_size: 0,
                })
                .collect();
            zypp_agama_sys::get_space_usage(
                self.ptr,
                status_ptr,
                libzypp_mps.as_ptr() as *mut _,
                libzypp_mps.len() as u32,
            );
            helpers::status_to_result_void(status)?;

            libzypp_mps.iter().enumerate().for_each(|(i, mp)| {
                mount_points[i].used_size = mp.used_size;
            });

            return Ok(mount_points);
        }
    }

    pub fn list_repositories(&self) -> ZyppResult<Vec<Repository>> {
        let mut repos_v = vec![];

        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;

            let mut repos = zypp_agama_sys::list_repositories(self.ptr, status_ptr);
            // unwrap is ok as it will crash only on less then 32b archs,so safe for agama
            let size_usize: usize = repos.size.try_into().unwrap();
            for i in 0..size_usize {
                let c_repo = *(repos.repos.add(i));
                let r_repo = Repository {
                    enabled: c_repo.enabled,
                    url: string_from_ptr(c_repo.url),
                    alias: string_from_ptr(c_repo.alias),
                    user_name: string_from_ptr(c_repo.userName),
                };
                repos_v.push(r_repo);
            }
            let repos_rawp = &mut repos;
            zypp_agama_sys::free_repository_list(repos_rawp as *mut _);

            helpers::status_to_result(status, repos_v)
        }
    }

    pub fn patterns_info(&self, names: Vec<&str>) -> ZyppResult<Vec<PatternInfo>> {
        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_names: Vec<CString> = names
                .iter()
                .map(|s| CString::new(*s).expect("CString must not contain internal NUL"))
                .collect();
            let c_ptr_names: Vec<*const i8> =
                c_names.iter().map(|c| c.as_c_str().as_ptr()).collect();
            let pattern_names = PatternNames {
                size: names.len() as u32,
                names: c_ptr_names.as_ptr(),
            };
            let infos = get_patterns_info(self.ptr, pattern_names, status_ptr);
            helpers::status_to_result_void(status)?;

            let mut r_infos = Vec::with_capacity(infos.size as usize);
            for i in 0..infos.size as usize {
                let c_info = *(infos.infos.add(i));
                let r_info = PatternInfo {
                    name: string_from_ptr(c_info.name),
                    category: string_from_ptr(c_info.category),
                    icon: string_from_ptr(c_info.icon),
                    description: string_from_ptr(c_info.description),
                    summary: string_from_ptr(c_info.summary),
                    order: string_from_ptr(c_info.order),
                    selected: c_info.selected.into(),
                };
                r_infos.push(r_info);
            }
            zypp_agama_sys::free_pattern_infos(&infos);
            Ok(r_infos)
        }
    }

    pub fn import_gpg_key(&self, file_path: &str) -> ZyppResult<()> {
        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_path = CString::new(file_path).expect("CString must not contain internal NUL");
            zypp_agama_sys::import_gpg_key(self.ptr, c_path.as_ptr(), status_ptr);
            status_to_result_void(status)
        }
    }

    pub fn select_resolvable(
        &self,
        name: &str,
        kind: ResolvableKind,
        who: ResolvableSelected,
    ) -> ZyppResult<()> {
        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_name = CString::new(name).unwrap();
            let c_kind = kind.into();
            zypp_agama_sys::resolvable_select(
                self.ptr,
                c_name.as_ptr(),
                c_kind,
                who.into(),
                status_ptr,
            );

            helpers::status_to_result_void(status)
        }
    }

    pub fn unselect_resolvable(
        &self,
        name: &str,
        kind: ResolvableKind,
        who: ResolvableSelected,
    ) -> ZyppResult<()> {
        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_name = CString::new(name).unwrap();
            let c_kind = kind.into();
            zypp_agama_sys::resolvable_unselect(
                self.ptr,
                c_name.as_ptr(),
                c_kind,
                who.into(),
                status_ptr,
            );

            helpers::status_to_result_void(status)
        }
    }

    pub fn is_package_selected(&self, tag: &str) -> ZyppResult<bool> {
        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_tag = CString::new(tag).unwrap();
            let res = zypp_agama_sys::is_package_selected(self.ptr, c_tag.as_ptr(), status_ptr);

            helpers::status_to_result(status, res)
        }
    }

    pub fn is_package_available(&self, tag: &str) -> ZyppResult<bool> {
        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_tag = CString::new(tag).unwrap();
            let res = zypp_agama_sys::is_package_available(self.ptr, c_tag.as_ptr(), status_ptr);

            helpers::status_to_result(status, res)
        }
    }

    pub fn refresh_repository(
        &self,
        alias: &str,
        progress: &impl DownloadProgress,
    ) -> ZyppResult<()> {
        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_alias = CString::new(alias).unwrap();
            let mut refresh_fn = |mut callbacks| {
                zypp_agama_sys::refresh_repository(
                    self.ptr,
                    c_alias.as_ptr(),
                    status_ptr,
                    &mut callbacks,
                )
            };
            callbacks::with_c_download_callbacks(progress, &mut refresh_fn);

            helpers::status_to_result_void(status)
        }
    }

    pub fn add_repository<F>(&self, alias: &str, url: &str, progress: F) -> ZyppResult<()>
    where
        F: FnMut(i64, String) -> bool,
    {
        unsafe {
            let mut closure = progress;
            let cb = get_zypp_progress_callback(&closure);
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _ as *mut Status;
            let c_alias = CString::new(alias).unwrap();
            let c_url = CString::new(url).unwrap();
            zypp_agama_sys::add_repository(
                self.ptr,
                c_alias.as_ptr(),
                c_url.as_ptr(),
                status_ptr,
                cb,
                &mut closure as *mut _ as *mut c_void,
            );

            helpers::status_to_result_void(status)
        }
    }

    pub fn disable_repository(&self, alias: &str) -> ZyppResult<()> {
        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_alias = CString::new(alias).unwrap();
            zypp_agama_sys::disable_repository(self.ptr, c_alias.as_ptr(), status_ptr);

            helpers::status_to_result_void(status)
        }
    }

    pub fn set_repository_url(&self, alias: &str, url: &str) -> ZyppResult<()> {
        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_alias = CString::new(alias).unwrap();
            let c_url = CString::new(url).unwrap();
            zypp_agama_sys::set_repository_url(
                self.ptr,
                c_alias.as_ptr(),
                c_url.as_ptr(),
                status_ptr,
            );

            helpers::status_to_result_void(status)
        }
    }

    pub fn remove_repository<F>(&self, alias: &str, progress: F) -> ZyppResult<()>
    where
        F: FnMut(i64, String) -> bool,
    {
        unsafe {
            let mut closure = progress;
            let cb = get_zypp_progress_callback(&closure);
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_alias = CString::new(alias).unwrap();
            zypp_agama_sys::remove_repository(
                self.ptr,
                c_alias.as_ptr(),
                status_ptr,
                cb,
                &mut closure as *mut _ as *mut c_void,
            );

            helpers::status_to_result_void(status)
        }
    }

    pub fn create_repo_cache<F>(&self, alias: &str, progress: F) -> ZyppResult<()>
    where
        F: FnMut(i64, String) -> bool,
    {
        unsafe {
            let mut closure = progress;
            let cb = get_zypp_progress_callback(&closure);
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_alias = CString::new(alias).unwrap();
            zypp_agama_sys::build_repository_cache(
                self.ptr,
                c_alias.as_ptr(),
                status_ptr,
                cb,
                &mut closure as *mut _ as *mut c_void,
            );

            helpers::status_to_result_void(status)
        }
    }

    pub fn load_repo_cache(&self, alias: &str) -> ZyppResult<()> {
        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let c_alias = CString::new(alias).unwrap();
            zypp_agama_sys::load_repository_cache(self.ptr, c_alias.as_ptr(), status_ptr);

            helpers::status_to_result_void(status)
        }
    }

    pub fn run_solver(&self) -> ZyppResult<bool> {
        unsafe {
            let mut status: Status = Status::default();
            let status_ptr = &mut status as *mut _;
            let r_res = zypp_agama_sys::run_solver(self.ptr, status_ptr);
            helpers::status_to_result(status, r_res)
        }
    }

    // high level method to load source
    pub fn load_source<F>(&self, progress: F) -> ZyppResult<()>
    where
        F: Fn(i64, String) -> bool,
    {
        let repos = self.list_repositories()?;
        let enabled_repos: Vec<&Repository> = repos.iter().filter(|r| r.enabled).collect();
        // TODO: this step logic for progress can be enclosed to own struct
        let mut percent: f64 = 0.0;
        let percent_step: f64 = 100.0 / (enabled_repos.len() as f64 * 3.0); // 3 substeps
        let abort_err = Err(ZyppError::new("Operation aborted"));
        let mut cont: bool;
        for i in enabled_repos {
            cont = progress(
                percent.floor() as i64,
                format!("Refreshing repository {}", &i.alias).to_string(),
            );
            if !cont {
                return abort_err;
            }
            self.refresh_repository(&i.alias, &callbacks::EmptyDownloadProgress)?;
            percent += percent_step;
            cont = progress(
                percent.floor() as i64,
                format!("Creating repository cache for {}", &i.alias).to_string(),
            );
            if !cont {
                return abort_err;
            }
            self.create_repo_cache(&i.alias, callbacks::empty_progress)?;
            percent += percent_step;
            cont = progress(
                percent.floor() as i64,
                format!("Loading repository cache for {}", &i.alias).to_string(),
            );
            if !cont {
                return abort_err;
            }
            self.load_repo_cache(&i.alias)?;
            percent += percent_step;
        }
        progress(100, "Loading repositories finished".to_string());
        Ok(())
    }
}

impl Drop for Zypp {
    fn drop(&mut self) {
        println!("dropping Zypp");
        unsafe {
            zypp_agama_sys::free_zypp(self.ptr);
        }
        // allow to init it again. If it is poisened, we just get inner pointer, but
        // it is already end of fun with libzypp.
        let mut locked = GLOBAL_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        *locked = false;
    }
}

pub enum ResolvableKind {
    Package,
    Pattern,
    SrcPackage,
    Patch,
    Product,
}

impl From<ResolvableKind> for zypp_agama_sys::RESOLVABLE_KIND {
    fn from(resolvable_kind: ResolvableKind) -> Self {
        match resolvable_kind {
            ResolvableKind::Package => zypp_agama_sys::RESOLVABLE_KIND_RESOLVABLE_PACKAGE,
            ResolvableKind::SrcPackage => zypp_agama_sys::RESOLVABLE_KIND_RESOLVABLE_SRCPACKAGE,
            ResolvableKind::Patch => zypp_agama_sys::RESOLVABLE_KIND_RESOLVABLE_PATCH,
            ResolvableKind::Product => zypp_agama_sys::RESOLVABLE_KIND_RESOLVABLE_PRODUCT,
            ResolvableKind::Pattern => zypp_agama_sys::RESOLVABLE_KIND_RESOLVABLE_PATTERN,
        }
    }
}

#[derive(Debug)]
pub enum ResolvableSelected {
    Not,
    User,
    Installation,
    Solver,
}

impl From<zypp_agama_sys::RESOLVABLE_SELECTED> for ResolvableSelected {
    fn from(value: zypp_agama_sys::RESOLVABLE_SELECTED) -> Self {
        match value {
            zypp_agama_sys::RESOLVABLE_SELECTED_NOT_SELECTED => Self::Not,
            zypp_agama_sys::RESOLVABLE_SELECTED_USER_SELECTED => Self::User,
            zypp_agama_sys::RESOLVABLE_SELECTED_APPLICATION_SELECTED => Self::Installation,
            zypp_agama_sys::RESOLVABLE_SELECTED_SOLVER_SELECTED => Self::Solver,
            _ => panic!("Unknown value for resolvable_selected {}", value),
        }
    }
}

impl From<ResolvableSelected> for zypp_agama_sys::RESOLVABLE_SELECTED {
    fn from(val: ResolvableSelected) -> Self {
        match val {
            ResolvableSelected::Not => zypp_agama_sys::RESOLVABLE_SELECTED_NOT_SELECTED,
            ResolvableSelected::User => zypp_agama_sys::RESOLVABLE_SELECTED_USER_SELECTED,
            ResolvableSelected::Installation => {
                zypp_agama_sys::RESOLVABLE_SELECTED_APPLICATION_SELECTED
            }
            ResolvableSelected::Solver => zypp_agama_sys::RESOLVABLE_SELECTED_SOLVER_SELECTED,
        }
    }
}

// NOTE: because some tests panic, it can happen that some Mutexes are poisoned. So always run tests sequentially with
// `cargo test -- --test-threads 1` otherwise random failures can happen with poisoned GLOBAL_LOCK
#[cfg(test)]
mod tests {
    use super::*;
    use std::error::Error;
    use std::process::Command;

    fn setup() {
        // empty now
    }

    fn progress_cb(_text: String, _step: u32, _total: u32) {
        // println!("Test initializing target: {}/{} - {}", _step, _total, _text)
    }

    // Init a RPM database in *root*, or do nothing if it exists
    fn init_rpmdb(root: &str) -> Result<(), Box<dyn Error>> {
        Command::new("rpmdb")
            .args(["--root", root, "--initdb"])
            .status()?;
        Ok(())
    }

    #[test]
    fn init_target() -> Result<(), Box<dyn Error>> {
        // run just single test to avoid threads as it cause zypp to be locked to one of those threads
        {
            setup();
            let result = Zypp::init_target("/", progress_cb);
            assert!(result.is_ok());
        }
        {
            setup();
            // a nonexistent relative root triggers a C++ exception
            let result = Zypp::init_target("not_absolute", progress_cb);
            assert!(result.is_err());
        }
        {
            setup();

            // double init of target
            let z1 = Zypp::init_target("/", progress_cb);
            let z2 = Zypp::init_target("/mnt", progress_cb);
            assert!(z2.is_err());

            // z1 call after init target for z2 to ensure that it is not dropped too soon
            assert!(z1.is_ok(), "z1 is not properly init {:?}.", z1);
        }
        {
            // list repositories test
            setup();
            let cwd = std::env::current_dir()?;
            let root_buf = cwd.join("fixtures/zypp_root");
            root_buf
                .try_exists()
                .expect("run this from the dir that has fixtures/");
            let root = root_buf.to_str().expect("CWD is not UTF-8");

            init_rpmdb(root)?;
            let zypp = Zypp::init_target(root, progress_cb)?;
            let repos = zypp.list_repositories()?;
            assert!(repos.len() == 1);
        }
        {
            setup();
            // when the target path is not a (potential) root diretory
            // NOTE: run it as last test as it keeps ZyppLock in cached state, so next init root with correct path will fail.
            let result = Zypp::init_target("/dev/full", progress_cb);
            assert!(result.is_err());
        }
        Ok(())
    }
}
