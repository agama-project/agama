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

//! Separator widget for the monitor TUI

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Modifier, Style},
    widgets::{Paragraph, Widget},
};

/// Separator line widget
pub struct Separator;

impl Widget for Separator {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let separator = "─".repeat(area.width as usize);
        Paragraph::new(separator)
            .style(Style::default().add_modifier(Modifier::DIM))
            .render(area, buf);
    }
}
