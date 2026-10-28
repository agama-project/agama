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

//! Status bar widget for the monitor TUI

use std::fmt::Display;

use agama_lib::monitor::InstallationStatus;
use agama_utils::api::status::Stage;
use gettextrs::gettext;
use ratatui::{
    buffer::Buffer,
    layout::{Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::Line,
    widgets::{Paragraph, Widget},
};

/// Status bar widget
pub struct Summary<'a> {
    status: &'a InstallationStatus,
    product: Option<String>,
    titles: Vec<String>,
    pub indentation: u16,
}

impl<'a> Summary<'a> {
    pub fn new(status: &'a InstallationStatus, product: Option<String>) -> Self {
        let titles = vec![
            gettext("Host: "),
            gettext("Model: "),
            gettext("Product: "),
            gettext("Stage: "),
            gettext("Status: "),
        ];
        let indentation = titles.iter().map(|s| s.len()).max().unwrap_or(16) + 1;

        Self {
            status,
            product,
            titles,
            indentation: indentation as u16,
        }
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

impl Display for BusyState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let value = match self {
            BusyState::Busy => gettext("Busy"),
            BusyState::Failed => gettext("Failed"),
            BusyState::Idle => gettext("Idle"),
            BusyState::Waiting => gettext("Waiting for user"),
        };

        write!(f, "{}", value)
    }
}

impl Widget for Summary<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        // Determine busy state
        let busy_state = if self.status.status.stage == Stage::Failed {
            BusyState::Failed
        } else if self.status.status.stage == Stage::Finished {
            BusyState::Idle
        } else if !self.status.questions.is_empty() {
            BusyState::Waiting
        } else if !self.status.status.progresses.is_empty() {
            BusyState::Busy
        } else {
            BusyState::Idle
        };

        let stage_text = match self.status.status.stage {
            Stage::Installing => gettext("Installing"),
            Stage::Configuring => gettext("Configuring"),
            Stage::Finished => gettext("Finished"),
            Stage::Failed => gettext("Failed"),
        };

        let layout =
            Layout::horizontal([Constraint::Length(self.indentation), Constraint::Min(20)]);
        let [titles_area, values_area] = layout.areas(area);

        let values = vec![
            Line::from(format!(
                "{} @ {}",
                self.status.system_info.hostname, self.status.system_info.ip
            )),
            Line::from(self.status.system_info.machine.as_str()),
            Line::from(self.product.unwrap_or(gettext("Not selected yet"))),
            Line::from(stage_text),
            Line::from(busy_state.to_string()),
        ];

        let titles_lines: Vec<_> = self.titles.into_iter().map(Line::from).collect();
        Paragraph::new(titles_lines)
            .right_aligned()
            .render(titles_area, buf);

        Paragraph::new(values)
            .left_aligned()
            .style(Style::default().add_modifier(Modifier::BOLD))
            .render(values_area, buf);
    }
}
