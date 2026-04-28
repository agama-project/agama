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

//! Status bar widget for the monitor TUI

use agama_lib::monitor::InstallationStatus;
use agama_utils::api::status::Stage;
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Paragraph, Widget},
};

/// Status bar widget
pub struct StatusBar<'a> {
    status: &'a InstallationStatus,
}

impl<'a> StatusBar<'a> {
    pub fn new(status: &'a InstallationStatus) -> Self {
        Self { status }
    }
}

/// Helper enum for busy state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BusyState {
    Busy,
    Idle,
    Waiting,
    Failed,
}

impl Widget for StatusBar<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let width = area.width as usize;

        // Determine busy state
        let busy_state = if self.status.status.stage == Stage::Failed {
            BusyState::Failed
        } else if self.status.status.stage == Stage::Finished {
            BusyState::Idle
        } else if !self.status.status.progresses.is_empty() {
            BusyState::Busy
        } else if !self.status.issues.is_empty() || !self.status.questions.is_empty() {
            BusyState::Waiting
        } else {
            BusyState::Idle
        };

        // Build left side: BUSY/IDLE badge + PHASE badge
        let (busy_text, busy_color, busy_bg) = match busy_state {
            BusyState::Busy => (" BUSY ", Color::Black, Color::Yellow),
            BusyState::Waiting => (" IDLE ", Color::White, Color::Magenta),
            BusyState::Failed => (" FAIL ", Color::White, Color::Red),
            BusyState::Idle => (" IDLE ", Color::Black, Color::Green),
        };

        let (phase_text, phase_color, phase_bg) = match self.status.status.stage {
            Stage::Installing => (" INSTALLING ", Color::Black, Color::Green),
            Stage::Configuring => (" CONFIGURING ", Color::White, Color::Cyan),
            Stage::Finished => (" FINISHED ", Color::Black, Color::Green),
            Stage::Failed => (" FAILED ", Color::White, Color::Red),
        };

        // Build right side: hostname @ IP | machine (hide machine if unknown)
        let right = if self.status.system_info.machine == "Unknown Machine" {
            format!(
                " {} @ {} ",
                self.status.system_info.hostname, self.status.system_info.ip
            )
        } else {
            format!(
                " {} @ {} | {} ",
                self.status.system_info.hostname,
                self.status.system_info.ip,
                self.status.system_info.machine
            )
        };

        // Calculate gap
        let left_plain_len = busy_text.len() + 1 + phase_text.len();
        let gap = width.saturating_sub(left_plain_len + right.len());

        // Build styled line
        let line = Line::from(vec![
            Span::styled(
                busy_text,
                Style::default()
                    .fg(busy_color)
                    .bg(busy_bg)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw(" "),
            Span::styled(
                phase_text,
                Style::default()
                    .fg(phase_color)
                    .bg(phase_bg)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::styled(" ".repeat(gap), Style::default().bg(Color::DarkGray)),
            Span::styled(
                right,
                Style::default()
                    .fg(Color::White)
                    .bg(Color::DarkGray)
                    .add_modifier(Modifier::BOLD),
            ),
        ]);

        Paragraph::new(line)
            .style(Style::default().bg(Color::DarkGray))
            .render(area, buf);
    }
}
