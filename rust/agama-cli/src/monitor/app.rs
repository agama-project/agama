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

use agama_lib::monitor::{InstallationStatus, MonitorClient};
use agama_utils::api::{status::Stage, Scope};
use anyhow::Result;
use crossterm::event::{self, Event, KeyCode, KeyModifiers};
use gettextrs::gettext;
use ratatui::{
    backend::CrosstermBackend,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame, Terminal,
};
use std::{collections::HashMap, io, time::Duration};

use super::ui;

/// Application state for the monitor TUI
pub struct MonitorApp {
    /// Current installation status (includes system info)
    pub status: InstallationStatus,
}

/// Represents the busy state of the installation
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BusyState {
    /// Installation is actively running
    Busy,
    /// Installation is idle (finished successfully)
    Idle,
    /// Waiting for user action (issues or questions)
    Waiting,
    /// Installation failed
    Failed,
}

impl MonitorApp {
    /// Creates a new MonitorApp from the initial status
    pub fn new(status: InstallationStatus) -> Self {
        Self { status }
    }

    /// Updates the installation status
    pub fn update_status(&mut self, new_status: InstallationStatus) {
        self.status = new_status;
    }

    /// Runs the monitor TUI event loop
    ///
    /// # Arguments
    ///
    /// * `terminal` - The terminal to draw on
    /// * `monitor` - The monitor client to receive updates from
    /// * `stop_on_idle` - Whether to stop monitoring when installation finishes
    pub async fn run(
        &mut self,
        terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
        monitor: MonitorClient,
        stop_on_idle: bool,
    ) -> Result<()> {
        let mut updates = monitor.subscribe();

        // Initial render
        terminal.draw(|f| self.draw(f))?;

        // Main event loop - WebSocket-driven, no timers
        loop {
            tokio::select! {
                // WebSocket status updates - trigger full redraw
                // This includes any changes to: status, issues, questions, progresses, system info
                Ok(new_status) = updates.recv() => {
                    self.update_status(new_status);
                    terminal.draw(|f| self.draw(f))?;

                    // Check exit conditions
                    if stop_on_idle && self.should_exit() {
                        break;
                    }
                }

                // Keyboard and terminal events (poll with short timeout)
                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                    if event::poll(Duration::from_millis(0))? {
                        match event::read()? {
                            Event::Key(key) => {
                                match (key.code, key.modifiers) {
                                    (KeyCode::Char('q'), _) |
                                    (KeyCode::Esc, _) |
                                    (KeyCode::Char('c'), KeyModifiers::CONTROL) => {
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                            Event::Resize(_, _) => {
                                // Terminal resize - trigger redraw
                                terminal.draw(|f| self.draw(f))?;
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Returns the current busy state
    pub fn busy_state(&self) -> BusyState {
        // Check final stages first
        if self.status.status.stage == Stage::Failed {
            BusyState::Failed
        } else if self.status.status.stage == Stage::Finished {
            BusyState::Idle
        // Check if actively running
        } else if !self.status.status.progresses.is_empty() {
            BusyState::Busy
        // Check if blocked by issues or questions
        } else if !self.status.issues.is_empty() || !self.status.questions.is_empty() {
            BusyState::Waiting
        // Otherwise idle (no progresses, no blockers)
        } else {
            BusyState::Idle
        }
    }

    /// Returns true if the app should exit
    pub fn should_exit(&self) -> bool {
        self.status.status.stage.is_last()
    }

    /// Draws the UI
    pub fn draw(&self, f: &mut Frame) {
        let area = f.area();
        let layout = ui::create_layout(area);

        // Render status bar (row 1)
        self.render_status_bar(f, layout.status_bar);

        // Render product name (row 3)
        self.render_product(f, layout.product);

        // Render separator (row 4)
        self.render_separator(f, layout.separator);

        // Render content (middle)
        self.render_content(f, layout.content);

        // Render hints separator (bottom-2)
        self.render_separator(f, layout.hints_separator);

        // Render hints footer (bottom-1)
        self.render_hints(f, layout.hints);
    }

    /// Renders the status bar with system info and phase
    fn render_status_bar(&self, f: &mut Frame, area: Rect) {
        let width = area.width as usize;

        // Build left side: BUSY/IDLE badge + PHASE badge
        let (busy_text, busy_color, busy_bg) = match self.busy_state() {
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

        // Build styled line - badges with backgrounds on left, system info on right
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

        let paragraph = Paragraph::new(line).style(Style::default().bg(Color::DarkGray));
        f.render_widget(paragraph, area);
    }

    /// Renders the product name
    fn render_product(&self, f: &mut Frame, area: Rect) {
        let paragraph = Paragraph::new(format!(" {}", self.status.system_info.product_name))
            .style(Style::default().add_modifier(Modifier::BOLD));
        f.render_widget(paragraph, area);
    }

    /// Renders the separator line
    fn render_separator(&self, f: &mut Frame, area: Rect) {
        let separator = "─".repeat(area.width as usize);
        let paragraph =
            Paragraph::new(separator).style(Style::default().add_modifier(Modifier::DIM));
        f.render_widget(paragraph, area);
    }

    /// Renders the content area based on current state
    fn render_content(&self, f: &mut Frame, area: Rect) {
        // Priority order (matching mockup logic):
        // 1. Questions (highest priority)
        // 2. Final status (finished/failed)
        // 3. Progress (installation/configuration)
        // 4. Issues (blocking installation)
        // 5. Default stage message

        if !self.status.questions.is_empty() {
            self.render_questions(f, area);
        } else if self.status.status.stage.is_last() {
            self.render_final_status(f, area);
        } else if !self.status.status.progresses.is_empty() {
            self.render_progress(f, area);
        } else if !self.status.issues.is_empty() {
            self.render_issues(f, area);
        } else {
            self.render_stage(f, area);
        }
    }

    /// Renders questions that need user attention
    fn render_questions(&self, f: &mut Frame, area: Rect) {
        // Add air gap at start and end
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

        for q in &self.status.questions {
            lines.push(Line::from(format!(" • {}", q.spec.text)));
        }

        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            gettext("Please use the web interface or `agama questions` command to answer them."),
            Style::default().add_modifier(Modifier::DIM),
        )));

        let paragraph = Paragraph::new(lines);
        f.render_widget(paragraph, content_area);
    }

    /// Renders the final status (finished or failed)
    fn render_final_status(&self, f: &mut Frame, area: Rect) {
        // Add air gap at start and end
        let content_area = Rect {
            x: area.x + 1,
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

        let paragraph = Paragraph::new(lines);
        f.render_widget(paragraph, content_area);
    }

    /// Renders installation progress using master/detail approach
    /// - Master: Manager scope progress (shown with progress bar)
    /// - Details: All other scope progresses (shown as [current/total])
    fn render_progress(&self, f: &mut Frame, area: Rect) {
        // Add air gap at start
        let content_area = Rect {
            x: area.x + 1,
            y: area.y,
            width: area.width.saturating_sub(2),
            height: area.height,
        };

        // Separate progresses into master (Manager) and details (others)
        let master_progress = self.status.status.progresses
            .iter()
            .find(|p| p.scope == Scope::Manager);

        let detail_progresses: Vec<_> = self.status.status.progresses
            .iter()
            .filter(|p| p.scope != Scope::Manager)
            .collect();

        // If no manager progress, fall back to first available progress
        let progress = master_progress.unwrap_or(&self.status.status.progresses[0]);

        let percent = if progress.size > 0 {
            ((progress.index as f64 / progress.size as f64) * 100.0) as u16
        } else {
            0
        };

        // Determine step text based on stage
        let step_label = if self.status.status.stage == Stage::Installing {
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

        let color = if self.status.status.stage == Stage::Installing {
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
        f.render_widget(Paragraph::new(lines), text_area);

        // Render progress bar with percentage at the end
        let bar_width = content_area.width.saturating_sub(4);
        let filled_width = ((percent as f64 / 100.0) * bar_width as f64) as u16;
        let empty_width = bar_width.saturating_sub(filled_width);

        // Build progress bar manually for better control
        let percent_text = format!(" {}% ", percent);
        let bar_line = Line::from(vec![
            Span::raw("  "),
            Span::styled(
                "█".repeat(filled_width as usize),
                Style::default().fg(color),
            ),
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
        f.render_widget(Paragraph::new(bar_line), bar_area);

        // Render progress details below the bar
        // Show master progress step detail (for Installing stage)
        let mut current_y = content_area.y + 5;

        if self.status.status.stage == Stage::Installing && progress.index > 0 {
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
            f.render_widget(Paragraph::new(detail_line), detail_area);
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
                    Span::styled(
                        step_desc,
                        Style::default().add_modifier(Modifier::DIM),
                    ),
                    Span::raw(" ".repeat(gap as usize)),
                    Span::styled(
                        count,
                        Style::default().add_modifier(Modifier::DIM),
                    ),
                ]));
            }

            if !detail_lines.is_empty() {
                let details_area = Rect {
                    x: content_area.x,
                    y: current_y,
                    width: content_area.width,
                    height: detail_lines.len() as u16,
                };
                f.render_widget(Paragraph::new(detail_lines), details_area);
            }
        }
    }

    /// Renders blocking issues
    fn render_issues(&self, f: &mut Frame, area: Rect) {
        // Add air gap at start and end
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
        for issue in &self.status.issues {
            grouped.entry(&issue.scope).or_default().push(&issue.issue);
        }

        // Render grouped issues
        for (scope, issues) in grouped {
            let scope_name = Self::scope_to_string(scope);
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

        let paragraph = Paragraph::new(lines);
        f.render_widget(paragraph, content_area);
    }

    /// Renders current stage message
    fn render_stage(&self, f: &mut Frame, area: Rect) {
        // Add air gap at start and end
        let content_area = Rect {
            x: area.x + 1,
            y: area.y,
            width: area.width.saturating_sub(2),
            height: area.height,
        };

        // This is called when there are no progresses, no issues, and no questions
        // So if we're in Configuring, we're ready to install
        let message = match self.status.status.stage {
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

        let paragraph = Paragraph::new(lines);
        f.render_widget(paragraph, content_area);
    }

    /// Renders keyboard hints
    fn render_hints(&self, f: &mut Frame, area: Rect) {
        let hints = vec![
            Span::styled("q", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(" / "),
            Span::styled("Ctrl-C", Style::default().add_modifier(Modifier::BOLD)),
            Span::styled(" exit", Style::default().add_modifier(Modifier::DIM)),
        ];

        let line = Line::from(hints);
        let paragraph = Paragraph::new(line);
        f.render_widget(paragraph, area);
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
}
