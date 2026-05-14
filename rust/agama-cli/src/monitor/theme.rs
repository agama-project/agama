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

//! Color theme definitions for the monitor TUI

use ratatui::style::Color;

/// Color theme for the monitor UI
#[derive(Debug, Clone)]
pub struct Theme {
    /// Background color for the status bar
    pub background: Color,

    /// Colors for active/busy state indicators
    pub busy_fg: Color,
    pub busy_bg: Color,

    /// Colors for idle state indicators
    pub idle_fg: Color,
    pub idle_bg: Color,

    /// Colors for warning/attention indicators
    pub warning_fg: Color,
    pub warning_bg: Color,

    /// Colors for error/failed indicators
    pub error_fg: Color,
    pub error_bg: Color,

    /// Color for progress bars and accents
    pub accent: Color,
}

impl Default for Theme {
    /// Returns the default monochrome theme
    fn default() -> Self {
        Self::monochrome()
    }
}

impl Theme {
    /// Monochrome theme using only black, white, and shades of gray
    pub fn monochrome() -> Self {
        Self {
            background: Color::DarkGray,

            busy_fg: Color::Black,
            busy_bg: Color::White,

            idle_fg: Color::White,
            idle_bg: Color::DarkGray,

            warning_fg: Color::Black,
            warning_bg: Color::White,

            error_fg: Color::Black,
            error_bg: Color::White,

            accent: Color::White,
        }
    }
}
