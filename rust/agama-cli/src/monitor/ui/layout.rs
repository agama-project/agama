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
const STATUS_BAR_HEIGHT: u16 = 1;
/// Height of the gap between status bar and product name
const GAP_HEIGHT: u16 = 1;
/// Height of the product name row
const PRODUCT_HEIGHT: u16 = 1;
/// Height of the separator line
const SEPARATOR_HEIGHT: u16 = 1;
/// Total height of the header (status bar + gap + product + separator)
const HEADER_HEIGHT: u16 = STATUS_BAR_HEIGHT + GAP_HEIGHT + PRODUCT_HEIGHT + SEPARATOR_HEIGHT;
/// Height of the hints separator line
const HINTS_SEPARATOR_HEIGHT: u16 = 1;
/// Height of the hints row
const HINTS_HEIGHT: u16 = 1;

/// Layout areas for the monitor UI
pub struct MonitorLayout {
    /// Status bar (row 1)
    pub status_bar: Rect,
    /// Product name (row 3)
    pub product: Rect,
    /// Separator line (row 4)
    pub separator: Rect,
    /// Content area (middle)
    pub content: Rect,
    /// Hints separator (bottom - 2)
    pub hints_separator: Rect,
    /// Hints footer (bottom - 1)
    pub hints: Rect,
}

/// Creates the main layout for the monitor UI
///
/// Layout structure:
///
///   - Row 1: Status bar (status, phase, hostname, IP, machine)
///   - Row 2: Empty gap
///   - Row 3: Product name
///   - Row 4: Separator line
///   - Middle: Dynamic content (progress, issues, messages) - with air gaps
///   - Footer: Hints separator and keyboard hints
pub fn create_layout(area: Rect) -> MonitorLayout {
    // Calculate content height: total - header
    // Leave room for hints at bottom but don't make them sticky
    let content_height = area.height.saturating_sub(HEADER_HEIGHT);

    let chunks = Layout::vertical([
        Constraint::Length(STATUS_BAR_HEIGHT),
        Constraint::Length(GAP_HEIGHT),
        Constraint::Length(PRODUCT_HEIGHT),
        Constraint::Length(SEPARATOR_HEIGHT),
        Constraint::Length(content_height), // Content + hints (non-sticky)
    ])
    .split(area);

    // Split content area to have hints at bottom (but not screen-sticky)
    let content_and_hints = Layout::vertical([
        Constraint::Min(1),                         // Content area (flexible)
        Constraint::Length(HINTS_SEPARATOR_HEIGHT), // Hints separator
        Constraint::Length(HINTS_HEIGHT),           // Hints footer
    ])
    .split(chunks[4]);

    MonitorLayout {
        status_bar: chunks[0],
        product: chunks[2],
        separator: chunks[3],
        content: content_and_hints[0],
        hints_separator: content_and_hints[1],
        hints: content_and_hints[2],
    }
}
