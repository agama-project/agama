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

use regex::Regex;
use std::process::Command;
use std::sync::LazyLock;

const DEFAULT_MAX_LINES: usize = 1000;

static PARAM_FILTER_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r#"(?i)\b((?:live\.password(?:_hash)?|rd\.live\.password|inst[._]mcp[._]token|inst[._](?:password|vncpassword|sshpassword|regcode)|vncpassword|sshpassword|rd\.luks\.key|luks\.key|regcode)=)(?:"[^"]*"|'[^']*'|[^\s"'`\r\n]*)"#,
    )
    .expect("valid regex for filtering sensitive boot parameters")
});

static URL_PASSWORD_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(://[^:/\s@]+:)[^/\s]*(@)"#).expect("valid regex for filtering URL passwords")
});

static QUERY_CRED_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?i)([?&](?:password|passwd|token)=)[^&\s"'`\r\n]*"#)
        .expect("valid regex for filtering query credentials")
});

/// Filters sensitive parameters (such as `live.password`, `inst.mcp.token`, boot passwords),
/// credentials in query strings, and credentials in URLs from log output, replacing password and
/// secret values with `<FILTERED>` to prevent credential leakage.
pub(crate) fn filter_logs(logs: &str) -> String {
    let sanitized_params = PARAM_FILTER_REGEX.replace_all(logs, "${1}<FILTERED>");
    let sanitized_urls = URL_PASSWORD_REGEX.replace_all(&sanitized_params, "${1}<FILTERED>${2}");
    QUERY_CRED_REGEX
        .replace_all(&sanitized_urls, "${1}<FILTERED>")
        .into_owned()
}

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
/// Sensitive parameters such as `live.password`, `inst.mcp.token`, and basic auth URL passwords
/// are filtered out from the output, replacing their values with `<FILTERED>`.
///
/// Supported `log_type` values:
/// - `"installer"` (or `"agama"`, or `None`): Logs from Agama installer services (`agama*`).
/// - `"system"`: System-wide journal entries.
/// - `"zypp"` (or `"software"`): Package management and libzypp entries from the installer.
/// - Any other string is treated as a specific systemd unit name.
pub(crate) fn get_logs(log_type: Option<&str>, lines: Option<usize>) -> String {
    let count = lines.unwrap_or(100).clamp(1, DEFAULT_MAX_LINES);
    let count_str = count.to_string();
    let scope = log_type.map(|s| s.trim()).unwrap_or("installer");
    let args = journal_args(scope, &count_str);

    let raw = query_journal(&args);
    filter_logs(&raw)
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
        assert_eq!(
            journal_args("NetworkManager.service", "15"),
            vec!["-u", "NetworkManager.service", "-n", "15", "--no-pager"]
        );
    }

    #[test]
    fn test_get_logs_does_not_panic() {
        // Runs without panicking regardless of whether journalctl binary is present
        let result = get_logs(Some("installer"), Some(50));
        assert!(!result.is_empty());
    }

    #[test]
    fn test_filter_logs_live_password() {
        let input = "Kernel command line: BOOT_IMAGE=/boot/vmlinuz splash=silent live.password=nots3cr3t console=ttyS0";
        let expected = "Kernel command line: BOOT_IMAGE=/boot/vmlinuz splash=silent live.password=<FILTERED> console=ttyS0";
        assert_eq!(filter_logs(input), expected);
    }

    #[test]
    fn test_filter_logs_quoted_password() {
        let input = "live.password=\"secret with spaces\" other=1";
        let expected = "live.password=<FILTERED> other=1";
        assert_eq!(filter_logs(input), expected);

        let input_single = "live.password='secret with spaces' other=1";
        let expected_single = "live.password=<FILTERED> other=1";
        assert_eq!(filter_logs(input_single), expected_single);
    }

    #[test]
    fn test_filter_logs_quoted_parameter() {
        let input = r#"Ignoring boot parameter "live.password=nots3cr3t""#;
        let expected = r#"Ignoring boot parameter "live.password=<FILTERED>""#;
        assert_eq!(filter_logs(input), expected);
    }

    #[test]
    fn test_filter_logs_password_hash() {
        let input = "live.password_hash=$6$xyz$123456 console=ttyS0";
        let expected = "live.password_hash=<FILTERED> console=ttyS0";
        assert_eq!(filter_logs(input), expected);
    }

    #[test]
    fn test_filter_logs_case_insensitive() {
        let input = "LIVE.PASSWORD=secret Live.Password=secret2";
        let expected = "LIVE.PASSWORD=<FILTERED> Live.Password=<FILTERED>";
        assert_eq!(filter_logs(input), expected);
    }

    #[test]
    fn test_filter_logs_does_not_modify_other_options() {
        let input = "live.password_dialog=1 live.password_systemd=1 notlive.password=foo";
        assert_eq!(filter_logs(input), input);
    }

    #[test]
    fn test_filter_logs_multiline() {
        let input = "Nov 25 10:00:00 kernel: live.password=foo console=ttyS0\nNov 25 10:00:01 systemd: live.password=bar\n";
        let expected = "Nov 25 10:00:00 kernel: live.password=<FILTERED> console=ttyS0\nNov 25 10:00:01 systemd: live.password=<FILTERED>\n";
        assert_eq!(filter_logs(input), expected);
    }

    #[test]
    fn test_filter_logs_mcp_token_and_other_boot_params() {
        let input = "inst.mcp.token=tok123 rd.live.password=livepass inst.password=targetpass vncpassword=vnc1 sshpassword=ssh1 rd.luks.key=lukspass regcode=code123";
        let expected = "inst.mcp.token=<FILTERED> rd.live.password=<FILTERED> inst.password=<FILTERED> vncpassword=<FILTERED> sshpassword=<FILTERED> rd.luks.key=<FILTERED> regcode=<FILTERED>";
        assert_eq!(filter_logs(input), expected);
    }

    #[test]
    fn test_filter_logs_url_credentials() {
        let input = "inst.auto=http://admin:secret123@server.com/profile.json proxy=http://proxyuser:proxypass@proxy:8080";
        let expected = "inst.auto=http://admin:<FILTERED>@server.com/profile.json proxy=http://proxyuser:<FILTERED>@proxy:8080";
        assert_eq!(filter_logs(input), expected);

        // Passwords containing '@'
        let input_at = "http://joe:p@ss@server.com/path";
        let expected_at = "http://joe:<FILTERED>@server.com/path";
        assert_eq!(filter_logs(input_at), expected_at);

        let input_no_creds = "inst.auto=http://server.com:8080/profile.json";
        assert_eq!(filter_logs(input_no_creds), input_no_creds);
    }

    #[test]
    fn test_filter_logs_query_credentials() {
        let input_smb = "smb://server/share?username=joe&password=s3cret";
        let expected_smb = "smb://server/share?username=joe&password=<FILTERED>";
        assert_eq!(filter_logs(input_smb), expected_smb);

        let input_token = "https://server/repo?token=s3cret";
        let expected_token = "https://server/repo?token=<FILTERED>";
        assert_eq!(filter_logs(input_token), expected_token);

        let input_passwd = "smb://server/share?foo=1&passwd=s3cret&bar=2";
        let expected_passwd = "smb://server/share?foo=1&passwd=<FILTERED>&bar=2";
        assert_eq!(filter_logs(input_passwd), expected_passwd);
    }
}
