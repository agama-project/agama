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

use agama_lib::monitor::InstallationStatus;
use agama_utils::api::{status::Stage, Issue, Scope};
use gettextrs::gettext;
use ratatui::{
    buffer::Buffer,
    layout::{Constraint, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Paragraph, Widget},
};
use std::collections::HashMap;

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

/// Renders the status bar
pub fn render_status_bar(status: &InstallationStatus, area: Rect, buf: &mut Buffer) {
    let width = area.width as usize;

    // Determine busy state
    let busy_state = if status.status.stage == Stage::Failed {
        BusyState::Failed
    } else if status.status.stage == Stage::Finished {
        BusyState::Idle
    } else if !status.status.progresses.is_empty() {
        BusyState::Busy
    } else if !status.issues.is_empty() || !status.questions.is_empty() {
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

    let (phase_text, phase_color, phase_bg) = match status.status.stage {
        Stage::Installing => (" INSTALLING ", Color::Black, Color::Green),
        Stage::Configuring => (" CONFIGURING ", Color::White, Color::Cyan),
        Stage::Finished => (" FINISHED ", Color::Black, Color::Green),
        Stage::Failed => (" FAILED ", Color::White, Color::Red),
    };

    // Build right side: hostname @ IP | machine (hide machine if unknown)
    let right = if status.system_info.machine == "Unknown Machine" {
        format!(
            " {} @ {} ",
            status.system_info.hostname, status.system_info.ip
        )
    } else {
        format!(
            " {} @ {} | {} ",
            status.system_info.hostname, status.system_info.ip, status.system_info.machine
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

/// Renders the product name
pub fn render_product(product_name: &str, area: Rect, buf: &mut Buffer) {
    Paragraph::new(format!(" {}", product_name))
        .style(Style::default().add_modifier(Modifier::BOLD))
        .render(area, buf);
}

/// Renders a separator line
pub fn render_separator(area: Rect, buf: &mut Buffer) {
    let separator = "─".repeat(area.width as usize);
    Paragraph::new(separator)
        .style(Style::default().add_modifier(Modifier::DIM))
        .render(area, buf);
}

/// Renders keyboard hints
pub fn render_hints(area: Rect, buf: &mut Buffer) {
    let hints = vec![
        Span::styled("q", Style::default().add_modifier(Modifier::BOLD)),
        Span::raw(" / "),
        Span::styled("Ctrl-C", Style::default().add_modifier(Modifier::BOLD)),
        Span::styled(" exit", Style::default().add_modifier(Modifier::DIM)),
    ];

    Paragraph::new(Line::from(hints)).render(area, buf);
}

/// Renders the content area based on current state
pub fn render_content(status: &InstallationStatus, area: Rect, buf: &mut Buffer) {
    // Priority order (matching mockup logic):
    // 1. Questions (highest priority)
    // 2. Final status (finished/failed)
    // 3. Progress (installation/configuration)
    // 4. Issues (blocking installation)
    // 5. Default stage message

    if !status.questions.is_empty() {
        render_questions(status, area, buf);
    } else if status.status.stage.is_last() {
        render_final_status(status, area, buf);
    } else if !status.has_product() {
        render_no_product(area, buf);
    } else if !status.status.progresses.is_empty() {
        render_progress(status, area, buf);
    } else if !status.issues.is_empty() {
        render_issues(status, area, buf);
    } else {
        render_stage(status, area, buf);
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

    // Render progress bar with percentage at the end
    let bar_width = content_area.width.saturating_sub(4);
    let filled_width = ((percent as f64 / 100.0) * bar_width as f64) as u16;
    let empty_width = bar_width.saturating_sub(filled_width);

    // Build progress bar manually for better control
    let percent_text = format!(" {}% ", percent);
    let bar_line = Line::from(vec![
        Span::raw("  "),
        Span::styled("█".repeat(filled_width as usize), Style::default().fg(color)),
        Span::styled(
            "░".repeat(empty_width as usize),
            Style::default().fg(Color::DarkGray),
        ),
        Span::styled(
            &percent_text,
            Style::default()
                .fg(Color::White)
                .add_modifier(Modifier::BOLD),
        ),
    ]);

    let bar_area = Rect {
        x: content_area.x,
        y: content_area.y + 3,
        width: content_area.width,
        height: 1,
    };
    Paragraph::new(bar_line).render(bar_area, buf);

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
