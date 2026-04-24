// Copyright (c) [2024-2025] SUSE LLC
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

//! UI rendering modules for the monitor TUI

use ratatui::layout::{Constraint, Layout, Rect};

/// Layout areas for the monitor UI
pub struct MonitorLayout {
    /// Status bar (row 1)
    pub status_bar: Rect,
    /// Empty gap (row 2) - used for visual spacing
    #[allow(dead_code)]
    pub gap: Rect,
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
/// Layout structure (matching TypeScript mockup + hints):
/// - Row 1: Status bar (hostname, IP, machine, BUSY/IDLE, phase)
/// - Row 2: Empty gap
/// - Row 3: Product name
/// - Row 4: Separator line
/// - Middle: Dynamic content (progress, issues, messages) - with air gaps
/// - Footer: Hints separator and keyboard hints (non-sticky, immediately below content)
pub fn create_layout(area: Rect) -> MonitorLayout {
    // Calculate content height: total - (status + gap + product + separator)
    // Leave room for hints at bottom but don't make them sticky
    let content_start = 4;
    let content_height = area.height.saturating_sub(content_start);

    let chunks = Layout::vertical([
        Constraint::Length(1),         // Status bar
        Constraint::Length(1),         // Gap
        Constraint::Length(1),         // Product name
        Constraint::Length(1),         // Separator
        Constraint::Length(content_height), // Content + hints (non-sticky)
    ])
    .split(area);

    // Split content area to have hints at bottom (but not screen-sticky)
    let content_and_hints = Layout::vertical([
        Constraint::Min(1),    // Content area (flexible)
        Constraint::Length(1), // Hints separator
        Constraint::Length(1), // Hints footer
    ])
    .split(chunks[4]);

    MonitorLayout {
        status_bar: chunks[0],
        gap: chunks[1],
        product: chunks[2],
        separator: chunks[3],
        content: content_and_hints[0],
        hints_separator: content_and_hints[1],
        hints: content_and_hints[2],
    }
}
