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

//! Decides which user interface fits the console the tool is running on.
//!
//! Full-screen interfaces need a terminal that sends every key press and understands cursor
//! movement. The s390x 3270 and 3215/line mode consoles do not: the user edits a whole line
//! locally and the terminal sends it on Enter, so only a line oriented interface can work there.

use clap::ValueEnum;

/// User interface requested by the user.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, ValueEnum)]
pub enum UiMode {
    /// Pick the interface according to the console.
    #[default]
    Auto,
    /// Numbered menus and prompts, works on any console.
    Line,
    /// Full-screen interface.
    Full,
}

/// Facts about the console used to resolve [`UiMode::Auto`].
#[derive(Clone, Debug, Default)]
pub struct ConsoleInfo {
    /// Whether stdin is a terminal.
    pub is_tty: bool,
    /// Value of the `TERM` variable.
    pub term: Option<String>,
    /// Device behind stdin, e.g. "/dev/3270/tty1".
    pub tty_path: Option<String>,
    /// Content of `/sys/class/tty/console/active`, e.g. "tty0 ttyS0".
    pub active_consoles: Option<String>,
    /// Whether the system is an s390x machine.
    pub s390: bool,
}

impl ConsoleInfo {
    /// Reads the console information from the running system.
    pub fn from_system() -> Self {
        let tty_path = std::fs::read_link("/proc/self/fd/0")
            .ok()
            .map(|p| p.to_string_lossy().into_owned());
        Self {
            is_tty: std::io::IsTerminal::is_terminal(&std::io::stdin()),
            term: std::env::var("TERM").ok(),
            tty_path,
            active_consoles: std::fs::read_to_string("/sys/class/tty/console/active").ok(),
            s390: cfg!(target_arch = "s390x"),
        }
    }

    /// Whether the console can only handle line oriented input and output.
    pub fn is_line_only(&self) -> bool {
        if !self.is_tty {
            return true;
        }

        if matches!(self.term.as_deref(), None | Some("") | Some("dumb")) {
            return true;
        }

        if !self.s390 {
            return false;
        }

        // When running on /dev/console, look at the console kernel devices instead.
        let devices: Vec<&str> = match self.tty_path.as_deref() {
            Some(path) if path != "/dev/console" => vec![path.trim_start_matches("/dev/")],
            _ => self
                .active_consoles
                .as_deref()
                .unwrap_or_default()
                .split_whitespace()
                .collect(),
        };

        devices.iter().any(|d| is_s390_line_device(d))
    }

    /// Resolves the requested mode to [`UiMode::Line`] or [`UiMode::Full`].
    pub fn resolve(&self, requested: UiMode) -> UiMode {
        match requested {
            UiMode::Auto if self.is_line_only() => UiMode::Line,
            UiMode::Auto => UiMode::Full,
            mode => mode,
        }
    }
}

/// Whether the given s390x tty device does not support full-screen applications.
///
/// * 3270 terminals (`3270/tty*`, console `tty3270`) send whole lines.
/// * The 3215 and the SCLP line mode consoles show up as `ttyS*`.
///
/// The SCLP VT220 console (`ttysclp0`, the HMC "Integrated ASCII Console") is full-screen capable.
fn is_s390_line_device(name: &str) -> bool {
    name.starts_with("3270/") || name.starts_with("tty3270") || name.starts_with("ttyS")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info(term: &str, tty: &str, active: &str, s390: bool) -> ConsoleInfo {
        ConsoleInfo {
            is_tty: true,
            term: Some(term.to_string()),
            tty_path: Some(tty.to_string()),
            active_consoles: Some(active.to_string()),
            s390,
        }
    }

    #[test]
    fn test_not_a_tty_is_line_mode() {
        let mut console = info("linux", "/dev/tty1", "tty0", false);
        console.is_tty = false;
        assert_eq!(console.resolve(UiMode::Auto), UiMode::Line);
    }

    #[test]
    fn test_dumb_terminal_is_line_mode() {
        let console = info("dumb", "/dev/tty1", "tty0", false);
        assert_eq!(console.resolve(UiMode::Auto), UiMode::Line);
    }

    #[test]
    fn test_serial_console_on_x86_is_full_screen() {
        let console = info("vt220", "/dev/ttyS0", "ttyS0", false);
        assert_eq!(console.resolve(UiMode::Auto), UiMode::Full);
    }

    #[test]
    fn test_s390_3270_is_line_mode() {
        let console = info("linux", "/dev/3270/tty1", "tty3270", true);
        assert_eq!(console.resolve(UiMode::Auto), UiMode::Line);
    }

    #[test]
    fn test_s390_line_mode_console_is_line_mode() {
        let console = info("vt220", "/dev/console", "ttyS0", true);
        assert_eq!(console.resolve(UiMode::Auto), UiMode::Line);
    }

    #[test]
    fn test_s390_ascii_console_is_full_screen() {
        let console = info("linux", "/dev/console", "ttysclp0", true);
        assert_eq!(console.resolve(UiMode::Auto), UiMode::Full);
    }

    #[test]
    fn test_explicit_mode_wins() {
        let console = info("linux", "/dev/3270/tty1", "tty3270", true);
        assert_eq!(console.resolve(UiMode::Full), UiMode::Full);
    }
}
