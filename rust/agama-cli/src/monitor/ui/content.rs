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

//! Content area widget for the monitor TUI

use agama_lib::monitor::InstallationStatus;
use agama_utils::api::{status::Stage, Scope};
use gettextrs::gettext;
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Gauge, Paragraph, Widget},
};
use std::collections::HashMap;

/// Content area widget
pub struct Content<'a> {
    status: &'a InstallationStatus,
}

impl<'a> Content<'a> {
    pub fn new(status: &'a InstallationStatus) -> Self {
        Self { status }
    }
}

impl Widget for Content<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        // Priority order (matching mockup logic):
        // 1. Questions (highest priority)
        // 2. Final status (finished/failed)
        // 3. Progress (installation/configuration)
        // 4. Issues (blocking installation)
        // 5. Default stage message

        if !self.status.questions.is_empty() {
            render_questions(self.status, area, buf);
        } else if self.status.status.stage.is_last() {
            render_final_status(self.status, area, buf);
        } else if !self.status.has_product() {
            render_no_product(area, buf);
        } else if !self.status.status.progresses.is_empty() {
            render_progress(self.status, area, buf);
        } else if !self.status.issues.is_empty() {
            render_issues(self.status, area, buf);
        } else {
            render_stage(self.status, area, buf);
        }
    }
}

/// Renders questions
fn render_questions(status: &InstallationStatus, area: Rect, buf: &mut Buffer) {
    let content_area = Rect {
        x: area.x + 1,
        y: area.y,
        width: area.width.saturating_sub(2),
        height: area.height,
    };

    let mut lines = vec![
        Line::from(""),
        Line::from(Span::styled(
            gettext("There are unanswered questions:"),
            Style::default().add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
    ];

    for q in &status.questions {
        lines.push(Line::from(format!(" • {}", q.spec.text)));
    }

    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        gettext("Please use the web interface or `agama questions` command to answer them."),
        Style::default().add_modifier(Modifier::DIM),
    )));

    Paragraph::new(lines).render(content_area, buf);
}

/// Renders final status (finished or failed)
fn render_final_status(status: &InstallationStatus, area: Rect, buf: &mut Buffer) {
    let content_area = Rect {
        x: area.x + 1,
        y: area.y,
        width: area.width.saturating_sub(2),
        height: area.height,
    };

    let (title, message) = match status.status.stage {
        Stage::Finished => (
            gettext("Installation complete."),
            gettext("You can reboot the machine to log in to the new system."),
        ),
        Stage::Failed => (
            gettext("Installation failed."),
            gettext("Check the logs for more information or try again."),
        ),
        _ => return,
    };

    let lines = vec![
        Line::from(""),
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

fn render_no_product(area: Rect, buf: &mut Buffer) {
    let content_area = Rect {
        x: area.x + 1,
        y: area.y,
        width: area.width.saturating_sub(2),
        height: area.height,
    };

    let mut lines = vec![
        Line::from(""),
        Line::from(Span::styled(
            gettext("Action needed:"),
            Style::default().add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
    ];

    lines.push(Line::from(vec![
        Span::raw(" "),
        Span::styled("•", Style::default().fg(Color::Magenta)),
        Span::styled(
            " No product has been selected yet.",
            Style::default().add_modifier(Modifier::DIM),
        ),
    ]));

    Paragraph::new(lines).render(content_area, buf);
}

/// Renders installation progress
fn render_progress(status: &InstallationStatus, area: Rect, buf: &mut Buffer) {
    let content_area = Rect {
        x: area.x + 1,
        y: area.y,
        width: area.width.saturating_sub(2),
        height: area.height,
    };

    // Separate progresses into master (Manager) and details (others)
    let master_progress = status
        .status
        .progresses
        .iter()
        .find(|p| p.scope == Scope::Manager);

    let detail_progresses: Vec<_> = status
        .status
        .progresses
        .iter()
        .filter(|p| p.scope != Scope::Manager)
        .collect();

    // If no manager progress, fall back to first available progress
    let progress = master_progress.unwrap_or(&status.status.progresses[0]);

    let percent = if progress.size > 0 {
        ((progress.index as f64 / progress.size as f64) * 100.0) as u16
    } else {
        0
    };

    // Determine step text based on stage
    let step_label = if status.status.stage == Stage::Installing {
        format!(
            "{} {} {} {}",
            gettext("Step"),
            progress.index,
            gettext("of"),
            progress.size
        )
    } else {
        format!("{}", gettext("Step"))
    };

    let color = if status.status.stage == Stage::Installing {
        Color::Green
    } else {
        Color::Cyan
    };

    // Build UI with air gap
    let lines = vec![
        Line::from(""),
        Line::from(Span::styled(
            format!("{}: {}", step_label, progress.step),
            Style::default().add_modifier(Modifier::DIM),
        )),
        Line::from(""),
    ];

    // Render text
    let text_area = Rect {
        x: content_area.x,
        y: content_area.y,
        width: content_area.width,
        height: 3,
    };
    Paragraph::new(lines).render(text_area, buf);

    // Render progress bar using Gauge widget
    let gauge = Gauge::default()
        .gauge_style(Style::default().fg(color))
        .percent(percent)
        .label(format!("{}%", percent));

    let bar_area = Rect {
        x: content_area.x + 2,
        y: content_area.y + 3,
        width: content_area.width.saturating_sub(2),
        height: 1,
    };
    gauge.render(bar_area, buf);

    // Render progress details below the bar
    let mut current_y = content_area.y + 5;

    // Show master progress step detail (for Installing stage)
    if status.status.stage == Stage::Installing && progress.index > 0 {
        let details = format!("  {}", progress.step);
        let count = format!("[{}/{}]", progress.index, progress.size);
        let gap = content_area
            .width
            .saturating_sub(details.len() as u16 + count.len() as u16 + 2);

        let detail_line = Line::from(vec![
            Span::raw(details),
            Span::raw(" ".repeat(gap as usize)),
            Span::styled(count, Style::default().add_modifier(Modifier::DIM)),
        ]);

        let detail_area = Rect {
            x: content_area.x,
            y: current_y,
            width: content_area.width,
            height: 1,
        };
        Paragraph::new(detail_line).render(detail_area, buf);
        current_y += 2; // Add spacing after master detail
    }

    // Render detail progresses (from other scopes)
    if !detail_progresses.is_empty() {
        let mut detail_lines = vec![];

        for detail_progress in detail_progresses {
            let step_desc = format!("  {}", detail_progress.step);
            let count = format!("[{}/{}]", detail_progress.index, detail_progress.size);
            let gap = content_area
                .width
                .saturating_sub(step_desc.len() as u16 + count.len() as u16 + 1);

            detail_lines.push(Line::from(vec![
                Span::styled(step_desc, Style::default().add_modifier(Modifier::DIM)),
                Span::raw(" ".repeat(gap as usize)),
                Span::styled(count, Style::default().add_modifier(Modifier::DIM)),
            ]));
        }

        if !detail_lines.is_empty() {
            let details_area = Rect {
                x: content_area.x,
                y: current_y,
                width: content_area.width,
                height: detail_lines.len() as u16,
            };
            Paragraph::new(detail_lines).render(details_area, buf);
        }
    }
}

/// Renders blocking issues
fn render_issues(status: &InstallationStatus, area: Rect, buf: &mut Buffer) {
    let content_area = Rect {
        x: area.x + 1,
        y: area.y,
        width: area.width.saturating_sub(2),
        height: area.height,
    };

    let mut lines = vec![
        Line::from(""),
        Line::from(Span::styled(
            gettext("Action needed:"),
            Style::default().add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
    ];

    // Group issues by scope
    let mut grouped: HashMap<&Scope, Vec<&agama_utils::api::Issue>> = HashMap::new();
    for issue in &status.issues {
        grouped.entry(&issue.scope).or_default().push(&issue.issue);
    }

    // Render grouped issues
    for (scope, issues) in grouped {
        let scope_name = scope_to_string(scope);
        for (i, issue) in issues.iter().enumerate() {
            if i == 0 {
                lines.push(Line::from(vec![
                    Span::raw(" "),
                    Span::styled("•", Style::default().fg(Color::Magenta)),
                    Span::raw(format!(" {:14} ", scope_name)),
                    Span::styled(
                        issue.description.clone(),
                        Style::default().add_modifier(Modifier::DIM),
                    ),
                ]));
            } else {
                lines.push(Line::from(Span::styled(
                    format!("                  {}", issue.description),
                    Style::default().add_modifier(Modifier::DIM),
                )));
            }
        }
        lines.push(Line::from(""));
    }

    lines.push(Line::from(Span::styled(
        gettext("Waiting for these to be resolved."),
        Style::default().add_modifier(Modifier::DIM),
    )));

    Paragraph::new(lines).render(content_area, buf);
}

/// Renders current stage message
fn render_stage(status: &InstallationStatus, area: Rect, buf: &mut Buffer) {
    let content_area = Rect {
        x: area.x + 1,
        y: area.y,
        width: area.width.saturating_sub(2),
        height: area.height,
    };

    // This is called when there are no progresses, no issues, and no questions
    // So if we're in Configuring, we're ready to install
    let message = match status.status.stage {
        Stage::Configuring => gettext("Ready for installation."),
        Stage::Installing => gettext("Waiting to start installation..."),
        _ => return,
    };

    let lines = vec![
        Line::from(""),
        Line::from(Span::styled(
            message,
            Style::default().add_modifier(Modifier::DIM),
        )),
    ];

    Paragraph::new(lines).render(content_area, buf);
}

/// Converts a Scope to a human-readable string
fn scope_to_string(scope: &Scope) -> String {
    match scope {
        Scope::Manager => gettext("Manager"),
        Scope::Network => gettext("Network"),
        Scope::Hostname => gettext("Hostname"),
        Scope::L10n => gettext("Localization"),
        Scope::Product => gettext("Product"),
        Scope::Software => gettext("Software"),
        Scope::Storage => gettext("Storage"),
        Scope::Files => gettext("Files"),
        Scope::ISCSI => gettext("iSCSI"),
        Scope::DASD => gettext("DASD"),
        Scope::ZFCP => gettext("zFCP"),
        Scope::Users => gettext("Users"),
    }
}
