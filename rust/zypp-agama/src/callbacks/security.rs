use std::{
    os::raw::{c_char, c_void},
    str::FromStr,
};

use crate::helpers::{as_c_void, string_from_ptr};

/// Represents the decision on how to handle an unknown GPG key.
#[derive(Debug, PartialEq, Eq)]
pub enum GpgKeyTrust {
    /// Reject the key.
    Reject,
    /// Trust the key temporarily for the current session.
    Temporary,
    /// Import and trust the key permanently.
    Import,
}

impl From<GpgKeyTrust> for zypp_agama_sys::GPGKeyTrust {
    fn from(val: GpgKeyTrust) -> Self {
        match val {
            GpgKeyTrust::Reject => zypp_agama_sys::GPGKeyTrust_GPGKT_REJECT,
            GpgKeyTrust::Temporary => zypp_agama_sys::GPGKeyTrust_GPGKT_TEMPORARY,
            GpgKeyTrust::Import => zypp_agama_sys::GPGKeyTrust_GPGKT_IMPORT,
        }
    }
}

impl FromStr for GpgKeyTrust {
    // TODO: make dedicated Error for it for better reusability
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            // NOTE: match keys with defined question for GpgKeyTrust
            "Skip" => Ok(GpgKeyTrust::Reject),
            "Temporary" => Ok(GpgKeyTrust::Temporary),
            "Trust" => Ok(GpgKeyTrust::Import),
            _ => Err(format!("Unknown action {:?}", s)),
        }
    }
}

/// A trait for handling security-related callbacks from `libzypp`.
///
/// Implementors of this trait can react to events like unknown GPG keys,
/// unsigned files, and checksum failures.
pub trait Callback {
    /// Called when an unknown GPG key is encountered.
    ///
    /// # Returns
    ///
    /// A [GpgKeyTrust] value indicating whether to reject, temporarily trust,
    /// or permanently import the key.
    fn accept_key(
        &self,
        _key_id: String,
        _key_name: String,
        _key_fingerprint: String,
        _repository_alias: String,
    ) -> GpgKeyTrust {
        GpgKeyTrust::Reject
    }

    /// Called when an unsigned file is encountered.
    ///
    /// # Returns
    ///
    /// `true` to accept the file and continue, `false` to reject it and abort.
    fn unsigned_file(&self, _file: String, _repository_alias: String) -> bool {
        false
    }

    /// Called when a file is signed with an unknown GPG key.
    ///
    /// # Returns
    ///
    /// `true` to accept the file and continue, `false` to reject it and abort.
    fn unknown_key(&self, _file: String, _key_id: String, _repository_alias: String) -> bool {
        false
    }

    /// Called when GPG verification of a signed file fails.
    ///
    /// # Returns
    ///
    /// `true` to accept the file and continue, `false` to reject it and abort.
    fn verification_failed(
        &self,
        _file: String,
        _key_id: String,
        _key_name: String,
        _key_fingerprint: String,
        _repository_alias: String,
    ) -> bool {
        false
    }

    /// Called when a checksum is missing for a file.
    ///
    /// # Returns
    ///
    /// `true` to accept the file and continue, `false` to reject it and abort.
    fn checksum_missing(&self, _file: String) -> bool {
        false
    }

    /// Called when a file's checksum is incorrect.
    ///
    /// # Returns
    ///
    /// `true` to accept the file and continue, `false` to reject it and abort.
    fn checksum_wrong(&self, _file: String, _expected: String, _actual: String) -> bool {
        false
    }

    /// Called when the checksum type for a file is unknown.
    ///
    /// # Returns
    ///
    /// `true` to accept the file and continue, `false` to reject it and abort.
    fn checksum_unknown(&self, _file: String, _checksum: String) -> bool {
        false
    }

    /// block to use callbacks inside. Recommended to not redefine.
    fn with<R, F>(&mut self, block: &mut F) -> R
    where
        F: FnMut(zypp_agama_sys::SecurityCallbacks) -> R,
    {
        let mut accept_key_call = |key_id, key_name, key_fingerprint, repository_alias| {
            self.accept_key(key_id, key_name, key_fingerprint, repository_alias)
        };
        let cb_accept_key = get_accept_key(&accept_key_call);

        let mut unsigned_file_call =
            |file, repository_alias| self.unsigned_file(file, repository_alias);
        let cb_unsigned_file = get_unsigned_file(&unsigned_file_call);

        let mut unknown_key_call =
            |file, key_id, repository_alias| self.unknown_key(file, key_id, repository_alias);
        let cb_unknown_key = get_unknown_key(&unknown_key_call);

        let mut verification_failed_call =
            |file, key_id, key_name, key_fingerprint, repository_alias| {
                self.verification_failed(file, key_id, key_name, key_fingerprint, repository_alias)
            };
        let cb_verification_failed = get_verification_failed(&verification_failed_call);

        let mut checksum_missing_call = |file| self.checksum_missing(file);
        let cb_checksum_missing = get_checksum_missing(&checksum_missing_call);

        let mut checksum_wrong_call =
            |file, expected, actual| self.checksum_wrong(file, expected, actual);
        let cb_checksum_wrong = get_checksum_wrong(&checksum_wrong_call);

        let mut checksum_unknown_call = |file, checksum| self.checksum_unknown(file, checksum);
        let cb_checksum_unknown = get_checksum_unknown(&checksum_unknown_call);

        let callbacks = zypp_agama_sys::SecurityCallbacks {
            accept_key: cb_accept_key,
            accept_key_data: as_c_void(&mut accept_key_call),
            unsigned_file: cb_unsigned_file,
            unsigned_file_data: as_c_void(&mut unsigned_file_call),
            unknown_key: cb_unknown_key,
            unknown_key_data: as_c_void(&mut unknown_key_call),
            verification_failed: cb_verification_failed,
            verification_failed_data: as_c_void(&mut verification_failed_call),
            checksum_missing: cb_checksum_missing,
            checksum_missing_data: as_c_void(&mut checksum_missing_call),
            checksum_wrong: cb_checksum_wrong,
            checksum_wrong_data: as_c_void(&mut checksum_wrong_call),
            checksum_unknown: cb_checksum_unknown,
            checksum_unknown_data: as_c_void(&mut checksum_unknown_call),
        };
        block(callbacks)
    }
}

/// Default implementation that does nothing and rejects all security risks.
pub struct EmptyCallback;
impl Callback for EmptyCallback {}

unsafe extern "C" fn accept_key<F>(
    key_id: *const c_char,
    key_name: *const c_char,
    key_fingerprint: *const c_char,
    repository_alias: *const c_char,
    user_data: *mut c_void,
) -> zypp_agama_sys::GPGKeyTrust
where
    F: FnMut(String, String, String, String) -> GpgKeyTrust,
{
    let user_data = &mut *(user_data as *mut F);
    let res = user_data(
        string_from_ptr(key_id),
        string_from_ptr(key_name),
        string_from_ptr(key_fingerprint),
        string_from_ptr(repository_alias),
    );
    res.into()
}

fn get_accept_key<F>(_closure: &F) -> zypp_agama_sys::GPGAcceptKeyCallback
where
    F: FnMut(String, String, String, String) -> GpgKeyTrust,
{
    Some(accept_key::<F>)
}

unsafe extern "C" fn unsigned_file<F>(
    file: *const c_char,
    repository_alias: *const c_char,
    user_data: *mut c_void,
) -> bool
where
    F: FnMut(String, String) -> bool,
{
    let user_data = &mut *(user_data as *mut F);
    user_data(string_from_ptr(file), string_from_ptr(repository_alias))
}

fn get_unsigned_file<F>(_closure: &F) -> zypp_agama_sys::GPGUnsignedFile
where
    F: FnMut(String, String) -> bool,
{
    Some(unsigned_file::<F>)
}

unsafe extern "C" fn unknown_key<F>(
    file: *const c_char,
    key_id: *const c_char,
    repository_alias: *const c_char,
    user_data: *mut c_void,
) -> bool
where
    F: FnMut(String, String, String) -> bool,
{
    let user_data = &mut *(user_data as *mut F);
    user_data(
        string_from_ptr(file),
        string_from_ptr(key_id),
        string_from_ptr(repository_alias),
    )
}

fn get_unknown_key<F>(_closure: &F) -> zypp_agama_sys::GPGUnknownKey
where
    F: FnMut(String, String, String) -> bool,
{
    Some(unknown_key::<F>)
}

unsafe extern "C" fn verification_failed<F>(
    file: *const c_char,
    key_id: *const c_char,
    key_name: *const c_char,
    key_fingerprint: *const c_char,
    repository_alias: *const c_char,
    user_data: *mut c_void,
) -> bool
where
    F: FnMut(String, String, String, String, String) -> bool,
{
    let user_data = &mut *(user_data as *mut F);
    user_data(
        string_from_ptr(file),
        string_from_ptr(key_id),
        string_from_ptr(key_name),
        string_from_ptr(key_fingerprint),
        string_from_ptr(repository_alias),
    )
}

fn get_verification_failed<F>(_closure: &F) -> zypp_agama_sys::GPGVerificationFailed
where
    F: FnMut(String, String, String, String, String) -> bool,
{
    Some(verification_failed::<F>)
}

unsafe extern "C" fn checksum_missing<F>(file: *const c_char, user_data: *mut c_void) -> bool
where
    F: FnMut(String) -> bool,
{
    let user_data = &mut *(user_data as *mut F);
    user_data(string_from_ptr(file))
}

fn get_checksum_missing<F>(_closure: &F) -> zypp_agama_sys::ChecksumMissing
where
    F: FnMut(String) -> bool,
{
    Some(checksum_missing::<F>)
}

unsafe extern "C" fn checksum_wrong<F>(
    file: *const c_char,
    expected: *const c_char,
    actual: *const c_char,
    user_data: *mut c_void,
) -> bool
where
    F: FnMut(String, String, String) -> bool,
{
    let user_data = &mut *(user_data as *mut F);
    user_data(
        string_from_ptr(file),
        string_from_ptr(expected),
        string_from_ptr(actual),
    )
}

fn get_checksum_wrong<F>(_closure: &F) -> zypp_agama_sys::ChecksumWrong
where
    F: FnMut(String, String, String) -> bool,
{
    Some(checksum_wrong::<F>)
}

unsafe extern "C" fn checksum_unknown<F>(
    file: *const c_char,
    checksum: *const c_char,
    user_data: *mut c_void,
) -> bool
where
    F: FnMut(String, String) -> bool,
{
    let user_data = &mut *(user_data as *mut F);
    user_data(string_from_ptr(file), string_from_ptr(checksum))
}

fn get_checksum_unknown<F>(_closure: &F) -> zypp_agama_sys::ChecksumUnknown
where
    F: FnMut(String, String) -> bool,
{
    Some(checksum_unknown::<F>)
}
