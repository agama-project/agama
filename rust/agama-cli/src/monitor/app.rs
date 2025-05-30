// Copyright (c) [2025] SUSE LLC
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

#![allow(dead_code)]

use agama_lib::{
    manager::InstallationPhase,
    monitor::{MonitorClient, MonitorStatus},
};
use crossterm::event::{Event, EventStream, KeyCode, KeyEvent};
use futures_util::{FutureExt, StreamExt};
use ratatui::{
    buffer::Buffer,
    layout::{Constraint, Layout, Rect},
    style::{Color, Style, Stylize},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Paragraph, Widget},
    DefaultTerminal,
};

pub struct App {
    /// whether the application is running
    running: bool,
    /// monitor client
    monitor: MonitorClient,
    /// monitor status
    status: MonitorStatus,
    /// crossterm events stream
    events: EventStream,
}

impl App {
    pub fn new(monitor: MonitorClient) -> App {
        App {
            running: true,
            status: Default::default(),
            monitor,
            events: Default::default(),
        }
    }

    pub async fn run(mut self, mut terminal: DefaultTerminal) -> anyhow::Result<()> {
        let mut updates = self.monitor.subscribe();
        self.status = self.monitor.get_status().await?;

        while self.running {
            terminal.draw(|frame| frame.render_widget(&self, frame.area()))?;

            tokio::select! {
                Some(event) = self.events.next().fuse() => {
                    match event {
                        Ok(Event::Key(key)) => self.handle_key(key),
                        _ => {}
                    }
                }

               Ok(status) = updates.recv() => {
                   self.status = status;
               }
            }
        }
        Ok(())
    }

    fn handle_key(&mut self, key_event: KeyEvent) {
        match key_event.code {
            KeyCode::Esc | KeyCode::Char('q') => self.running = false,
            _ => {}
        };
    }

    fn render_issues(&self, area: Rect, buf: &mut Buffer) {
        if self.status.issues.is_empty() {
            return;
        }

        let mut content = vec![
            "You need to solve the following issues before installing:".to_string(),
            "".to_string(),
        ];
        let mut issues: Vec<String> = self
            .status
            .issues
            .values()
            .flatten()
            .map(|i| format!("  * {}", &i.description))
            .collect();
        content.append(&mut issues);
        let text = Text::from(content.join("\n"));
        text.render(area, buf);
    }

    fn render_progress(&self, area: Rect, buf: &mut Buffer) {
        let layout =
            Layout::vertical(vec![Constraint::Length(1), Constraint::Length(1)]).vertical_margin(1);

        let [main, detail] = layout.areas(area);

        if let Some(progress) = self.status.progress.get(MANAGER_PROGRESS_OBJECT_PATH) {
            let steps = Span::styled(
                format!("[{}/{}] ", progress.current_step, progress.max_steps),
                Style::new().bold().fg(Color::Green),
            );
            let description = Span::raw(progress.current_title.as_str());
            let line = Line::from(vec![steps, description]);
            line.render(main, buf);
        }

        if let Some(progress) = self.status.progress.get(SOFTWARE_PROGRESS_OBJECT_PATH) {
            let steps = Span::styled(
                format!("[{}/{}] ", progress.current_step, progress.max_steps),
                Style::new().bold(),
            );
            let description = Span::raw(progress.current_title.as_str());
            let line = Line::from(vec![steps, description]);
            line.render(detail, buf);
        }
    }
}

const MANAGER_PROGRESS_OBJECT_PATH: &str = "/org/opensuse/Agama/Manager1";
const SOFTWARE_PROGRESS_OBJECT_PATH: &str = "/org/opensuse/Agama/Software1";

impl Widget for &App {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let installer_status = &self.status.installer_status;
        let phase = match installer_status.phase {
            InstallationPhase::Startup => "Initializing",
            InstallationPhase::Config => "Configuration",
            InstallationPhase::Install => "Installing",
            InstallationPhase::Finish => "Finished",
        };

        let layout = Layout::vertical(vec![Constraint::Length(4), Constraint::Min(1)]);
        let [top, content] = layout.areas(area);

        let idle = self.status.progress.is_empty();
        let status = if idle { "Idle" } else { "Running" };

        let text = vec![
            Line::raw(format!("Phase: {}", phase)),
            Line::raw(format!("Status: {}", status)),
        ];

        let title = Line::from("Agama (press 'q' to exit)").centered();
        let para = Paragraph::new(text).block(
            Block::new()
                .borders(Borders::BOTTOM | Borders::TOP)
                .title(title),
        );
        para.render(top, buf);

        if idle {
            self.render_issues(content, buf);
        } else {
            self.render_progress(content, buf);
        }
    }
}
