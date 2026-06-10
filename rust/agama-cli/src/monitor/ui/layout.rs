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

//! Layout management for the monitor TUI

use ratatui::layout::{Constraint, Layout, Rect};

/// Height of the status bar row
const SUMMARY_HEIGHT: u16 = 5;
/// Height of the gap between status bar and product name
const GAP_HEIGHT: u16 = 1;
/// Total height of the header (status bar + gap + product + separator)
const HEADER_HEIGHT: u16 = SUMMARY_HEIGHT + GAP_HEIGHT;

/// Layout areas for the monitor UI
pub struct MonitorLayout {
    /// Status bar (row 1)
    pub summary: Rect,
    /// Content area (middle)
    pub content: Rect,
}

/// Creates the main layout for the monitor UI
///
/// Layout structure:
///
///   - Row 1: Status bar (status, phase, hostname, IP, machine)
///   - Row 2: Empty gap
///   - Row 3: Composed by two columns:
///     - Left: indentation
///     - Right: separator + content (progress, issues, messages)
///   - Content: Dynamic content (progress, issues, messages) - with air gaps
pub fn create_layout(area: Rect, indentation: u16) -> MonitorLayout {
    // Calculate content height: total - header
    // Leave room for hints at bottom but don't make them sticky
    let content_height = area.height.saturating_sub(HEADER_HEIGHT);

    let chunks = Layout::vertical([
        Constraint::Length(SUMMARY_HEIGHT),
        Constraint::Length(GAP_HEIGHT),
        Constraint::Length(content_height),
    ])
    .split(area);

    let main =
        Layout::horizontal([Constraint::Length(indentation), Constraint::Min(10)]).split(chunks[2]);

    MonitorLayout {
        summary: chunks[0],
        content: main[1],
    }
}
