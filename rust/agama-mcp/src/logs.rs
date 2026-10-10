// Copyright (c) [2026] SUSE LLC
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

//! Log collection utilities for the MCP `get_logs` tool using systemd journalctl.

use std::process::Command;

const DEFAULT_MAX_LINES: usize = 1000;

/// Constructs command-line arguments for `journalctl` based on scope and requested lines.
pub(crate) fn journal_args<'a>(scope: &'a str, count_str: &'a str) -> Vec<&'a str> {
    match scope {
        "installer" | "agama" => vec!["-u", "agama*", "-n", count_str, "--no-pager"],
        "system" => vec!["-n", count_str, "--no-pager"],
        "zypp" | "software" => vec!["-u", "agama*", "-g", "zypp", "-n", count_str, "--no-pager"],
        unit => vec!["-u", unit, "-n", count_str, "--no-pager"],
    }
}

/// Runs `journalctl` with the specified arguments and returns the formatted output.
fn query_journal(args: &[&str]) -> String {
    match Command::new("journalctl").args(args).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            if output.status.success() {
                let trimmed = stdout.trim();
                if trimmed.is_empty() {
                    "No journal entries found for the requested query.".to_string()
                } else {
                    trimmed.to_string()
                }
            } else {
                let err_msg = if !stderr.trim().is_empty() {
                    stderr.trim()
                } else if !stdout.trim().is_empty() {
                    stdout.trim()
                } else {
                    "Unknown journalctl failure"
                };
                format!("journalctl exited with {}: {err_msg}", output.status)
            }
        }
        Err(err) => format!("Failed to execute journalctl: {err}"),
    }
}

/// Retrieves logs from the systemd journal according to the requested `log_type` and line count.
///
/// Supported `log_type` values:
/// - `"installer"` (or `"agama"`, or `None`): Logs from Agama installer services (`agama*`).
/// - `"system"`: System-wide journal entries.
/// - `"zypp"` (or `"software"`): Package management and libzypp entries from the installer.
/// - Any other string is treated as a specific systemd unit name.
pub fn get_logs(log_type: Option<&str>, lines: Option<usize>) -> String {
    let count = lines.unwrap_or(100).clamp(1, DEFAULT_MAX_LINES);
    let count_str = count.to_string();
    let scope = log_type
        .map(|s| s.trim())
        .unwrap_or("installer")
        .to_lowercase();
    let args = journal_args(&scope, &count_str);

    query_journal(&args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_journal_args_scopes() {
        assert_eq!(
            journal_args("installer", "50"),
            vec!["-u", "agama*", "-n", "50", "--no-pager"]
        );
        assert_eq!(
            journal_args("agama", "20"),
            vec!["-u", "agama*", "-n", "20", "--no-pager"]
        );
        assert_eq!(
            journal_args("system", "100"),
            vec!["-n", "100", "--no-pager"]
        );
        assert_eq!(
            journal_args("zypp", "30"),
            vec!["-u", "agama*", "-g", "zypp", "-n", "30", "--no-pager"]
        );
        assert_eq!(
            journal_args("sshd.service", "10"),
            vec!["-u", "sshd.service", "-n", "10", "--no-pager"]
        );
    }

    #[test]
    fn test_get_logs_does_not_panic() {
        // Runs without panicking regardless of whether journalctl binary is present
        let result = get_logs(Some("installer"), Some(50));
        assert!(!result.is_empty());
    }
}
