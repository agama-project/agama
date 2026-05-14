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

use agama_utils::api;
use ratatui::{
    buffer::Buffer,
    layout::{Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Gauge, Widget},
};

use crate::monitor::{theme::Theme, ui::scope_to_string};

/// Left indentation for progress widget content
const PROGRESS_INDENT: u16 = 3;
/// Height of progress widget without scope label
const PROGRESS_HEIGHT_NO_SCOPE: u16 = 3;
/// Height of progress widget with scope label
const PROGRESS_HEIGHT_WITH_SCOPE: u16 = 5;
/// Vertical spacing after scope label
const SCOPE_LABEL_SPACING: u16 = 2;

/// A widget to display the progress of Agama services.
pub struct Progress<'a> {
    with_scope: bool,
    progress: &'a api::Progress,
    theme: &'a Theme,
}

impl<'a> Progress<'a> {
    /// Builds a new progress widget.
    ///
    /// * `progress`: a struct containing the progress to print.
    /// * `with_scope`: whether to display the scope.
    /// * `theme`: UI theme to apply.
    pub fn new(progress: &'a api::Progress, with_scope: bool, theme: &'a Theme) -> Self {
        Self {
            progress,
            with_scope,
            theme,
        }
    }

    /// Height of the widget.
    ///
    /// The height of this widget can be calculated in advance.
    pub fn height(&'a self) -> u16 {
        if self.with_scope {
            PROGRESS_HEIGHT_WITH_SCOPE
        } else {
            PROGRESS_HEIGHT_NO_SCOPE
        }
    }
}

impl<'a> Widget for Progress<'a> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let mut content_area = Rect {
            x: area.x + PROGRESS_INDENT,
            width: area.width.saturating_sub(PROGRESS_INDENT),
            ..area
        };

        if self.with_scope {
            Line::from(Span::styled(
                scope_to_string(&self.progress.scope),
                Style::default().add_modifier(Modifier::DIM),
            ))
            .render(area, buf);
            content_area.y += SCOPE_LABEL_SPACING;
        }

        let [gauge_area, _, details_area] = Layout::vertical([
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Length(1),
        ])
        .areas(content_area);

        let percent = if self.progress.size > 0 {
            ((self.progress.index as f64 / self.progress.size as f64) * 100.0) as u16
        } else {
            0
        };

        Gauge::default()
            .gauge_style(Style::default().fg(self.theme.accent))
            .percent(percent)
            .label("")
            .render(gauge_area, buf);

        Line::from(format!(
            "{}/{} {}",
            self.progress.index, self.progress.size, self.progress.step
        ))
        .render(details_area, buf);
    }
}
