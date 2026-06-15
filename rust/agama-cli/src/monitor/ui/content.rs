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

//! Content area widget for the monitor TUI

use agama_lib::monitor::InstallationStatus;
use agama_utils::api::{self, status::Stage, Scope};
use gettextrs::gettext;
use ratatui::{
    buffer::Buffer,
    layout::{Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Paragraph, Widget},
};

use crate::monitor::ui::{issues::IssuesList, progress::Progress};

/// Represents the main content of the monitor.
///
/// It implements some logic to decide what to show: the progress, the list of issues,
/// the list of questions, etc.
pub struct Content<'a> {
    status: &'a InstallationStatus,
}

impl<'a> Content<'a> {
    /// Creates a new content widget.
    ///
    /// * `status`: current installation status.
    /// * `theme`: UI theme to apply.
    pub fn new(status: &'a InstallationStatus) -> Self {
        Self { status }
    }

    /// Renders final status (finished or failed)
    fn render_final_status(&self, area: Rect, buf: &mut Buffer) {
        let content_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.saturating_sub(2),
            height: area.height,
        };

        let (title, message) = match self.status.status.stage {
            Stage::Finished => (
                gettext("Installation complete."),
                gettext("You can reboot the machine to log in to the new system."),
            ),
            Stage::Failed => (
                gettext("Installation failed."),
                gettext("Use the \"agama logs\" command to collect the logs."),
            ),
            _ => return,
        };

        let lines = vec![
            Line::from(Span::styled(
                title,
                Style::default().add_modifier(Modifier::BOLD),
            )),
            Line::from(""),
            Line::from(Span::styled(
                message,
                Style::default().add_modifier(Modifier::DIM),
            )),
        ];

        Paragraph::new(lines).render(content_area, buf);
    }

    /// Renders a message about no product being selected.
    fn render_no_product(&self, area: Rect, buf: &mut Buffer) {
        let content_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.saturating_sub(2),
            height: area.height,
        };

        let mut lines = vec![
            Line::from(Span::styled(
                gettext("Action needed:"),
                Style::default().add_modifier(Modifier::BOLD),
            )),
            Line::from(""),
        ];

        lines.push(Line::from(vec![
            Span::from("  - "),
            Span::from(gettext("No product has been selected yet.")),
        ]));

        Paragraph::new(lines).render(content_area, buf);
    }

    /// Renders installation progress.
    fn render_progress(&self, area: Rect, buf: &mut Buffer) {
        let content_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.saturating_sub(2),
            height: area.height,
        };

        // Separate progresses into master (Manager) and details (others)
        let (master_progresses, detail_progresses): (Vec<_>, Vec<_>) = self
            .status
            .status
            .progresses
            .iter()
            .partition(|p| p.scope == Scope::Manager);

        let mut current_y = content_area.y;

        let mut has_master_progress = false;
        if let Some(progress) = master_progresses.first() {
            has_master_progress = true;
            let area = Rect {
                x: content_area.x,
                y: content_area.y,
                width: content_area.width,
                height: 3,
            };
            self.render_manager_progress(progress, area, buf);
            current_y += 2;
        }

        for progress in &detail_progresses {
            let widget = Progress::new(progress, !has_master_progress);
            let height = widget.height() + 1;
            let area = Rect {
                y: current_y,
                width: area.width.saturating_sub(3),
                height,
                ..content_area
            };
            current_y += height;
            widget.render(area, buf);
        }
    }

    /// Renders blocking issues.
    fn render_issues(&self, area: Rect, buf: &mut Buffer) {
        let layout = Layout::vertical([Constraint::Length(2), Constraint::Fill(1)]);

        let [title_area, issues_area] = layout.areas(Rect {
            x: area.x,
            y: area.y,
            width: area.width.saturating_sub(2),
            height: area.height,
        });

        let lines = vec![Line::from(Span::styled(
            gettext("Fix invalid settings before starting the installation:"),
            Style::default().add_modifier(Modifier::BOLD),
        ))];
        Paragraph::new(lines).render(title_area, buf);

        let list = IssuesList::new(&self.status.issues);
        list.render(issues_area, buf);
    }

    /// Renders current stage message.
    fn render_stage(&self, area: Rect, buf: &mut Buffer) {
        let content_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.saturating_sub(2),
            height: area.height,
        };

        // This is called when there are no progresses, no issues, and no questions
        // So if we're in Configuring, we're ready to install
        let message = match self.status.status.stage {
            Stage::Configuring => gettext("Ready to start the installation."),
            Stage::Installing => gettext("Starting the installation."),
            _ => return,
        };

        let lines = vec![Line::from(Span::styled(
            message,
            Style::default().add_modifier(Modifier::DIM),
        ))];

        Paragraph::new(lines).render(content_area, buf);
    }

    /// Renders the progress for the manager scope.
    fn render_manager_progress(&self, progress: &api::Progress, area: Rect, buf: &mut Buffer) {
        let step_label = format!(
            "{} {} {} {}",
            gettext("Step"),
            progress.index,
            gettext("of"),
            progress.size
        );

        // Manager progress (with some air gap)
        let lines = vec![
            Line::from(Span::styled(
                format!("{}: {}", step_label, progress.step),
                Style::default().add_modifier(Modifier::DIM),
            )),
            Line::from(""),
        ];

        Paragraph::new(lines).render(area, buf);
    }
}

impl Widget for Content<'_> {
    /// Renders the content depending on the installation status:
    ///
    /// 1. The final status if the installation finished.
    /// 2. The progress (if any).
    /// 3. A warning if no product is selected.
    /// 4. The list of issues if any.
    /// 5. A default message informing the user that Agama is ready.
    fn render(self, area: Rect, buf: &mut Buffer) {
        if self.status.has_finished() {
            self.render_final_status(area, buf);
        } else if !self.status.status.progresses.is_empty() {
            self.render_progress(area, buf);
        } else if !self.status.has_product() {
            self.render_no_product(area, buf);
        } else if !self.status.issues.is_empty() {
            self.render_issues(area, buf);
        } else {
            self.render_stage(area, buf);
        }
    }
}
