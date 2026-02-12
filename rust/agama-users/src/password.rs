// Copyright (c) [2025-2026] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

//! Implements a mechanism to check for the strength of a password.
//!
//! It relies on the pwscore tool included in the libpwquality-tools package.
//!
//! Ideally, it should use [libpwquality bindings](https://crates.io/crates/libpwquality).
//! However, adding this crate causes pam-sys 0.8.0 to not build. See
//! https://github.com/1wilkens/pam-sys/issues/29 for further information.

use serde::Serialize;
use std::{
    io::Write,
    process::{Command, Stdio},
};
use thiserror;

#[derive(thiserror::Error, Debug)]
pub enum PasswordCheckerError {
    #[error("Could not run pwscore")]
    CommandFailed(#[from] std::io::Error),
    #[error("It was not possible to connect to pwscore")]
    CommunicationFailed,
    #[error("Could not parse the pwscore ")]
    ParseError(String),
}

/// Password check result.
///
/// * If the check passes, it returns the score (a number from 0 to 100).
/// * If it does not passes, it returns the reason (e.g., it is based on a dictionary word).
#[derive(Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum PasswordCheckResult {
    Success(i32),
    Failure(String),
}

/// Allow to check the strength of passwords.
#[derive(Default)]
pub struct PasswordChecker;

impl PasswordChecker {
    /// Check the strength of the given password.
    ///
    /// It returns a PasswordCheckResult struct which includes result of the check.
    ///
    /// * `password`: clear-text password.
    pub fn check(&self, password: &str) -> Result<PasswordCheckResult, PasswordCheckerError> {
        let child = Command::new("pwscore")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();

        let mut child = child?;
        let Some(mut stdin) = child.stdin.take() else {
            return Err(PasswordCheckerError::CommunicationFailed);
        };

        stdin.write_all(password.as_bytes())?;
        drop(stdin);

        let output = child.wait_with_output()?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let score = stdout
                .trim()
                .parse::<i32>()
                .map_err(|_| PasswordCheckerError::ParseError(stdout.to_string()))?;
            Ok(PasswordCheckResult::Success(score))
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let lines = stderr.lines().skip(1);
            let error: Vec<_> = lines.map(|l| l.trim().to_string()).collect();
            Ok(PasswordCheckResult::Failure(error.join("\n")))
        }
    }
}

#[cfg(test)]
mod test {
    use super::{PasswordCheckResult, PasswordChecker};

    #[test]
    #[cfg(not(ci))]
    fn test_passwords() {
        let checker = PasswordChecker::default();

        let result = checker.check("nots3cr3t.").unwrap();
        assert!(matches!(result, PasswordCheckResult::Success(_)));

        let result = checker.check("12345678").unwrap();
        assert!(matches!(result, PasswordCheckResult::Failure(_)));

        let result = checker.check("ab").unwrap();
        assert!(matches!(result, PasswordCheckResult::Failure(_)));
    }
}
