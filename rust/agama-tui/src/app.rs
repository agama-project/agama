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

use agama_utils::api::Event;
use itertools::Itertools;
use ratatui::{
    crossterm::event::{KeyCode, KeyEvent, KeyEventKind},
    layout::{Alignment, Constraint, Layout},
    prelude::{Buffer, Rect},
    style::{
        palette::{material::WHITE, tailwind::BLACK},
        Modifier, Style,
    },
    text::{Line, Span},
    widgets::Widget,
    DefaultTerminal, Frame,
};
use tokio::sync::mpsc;

use crate::{
    action::Action,
    api::ApiState,
    event::AppEvent,
    ui::{products_page::ProductPage, Command, Page},
};

/// Base Ratatui application.
///
/// This struct represents the Ratatui application and implements the user interface.
pub struct App {
    exit: bool,
    events_rx: mpsc::Receiver<AppEvent>,
    pub api: ApiState,
    product: ProductPage,
}

impl App {
    /// * `api`: handler of the API service.
    /// * `events_rx`: application events, either from the API or the user.
    pub fn new(api: ApiState, events_rx: mpsc::Receiver<AppEvent>) -> Self {
        // TODO: pass a reference.
        let products = api.system_info.manager.products.clone();

        let product = ProductPage::new(products);
        Self {
            events_rx,
            api,
            exit: false,
            product,
        }
    }

    /// Runs the application dispatching the application events.
    pub async fn run(&mut self, terminal: &mut DefaultTerminal) -> anyhow::Result<()> {
        while !self.exit {
            terminal.draw(|frame| self.draw(frame))?;

            if let Some(event) = self.events_rx.recv().await {
                match event {
                    AppEvent::Key(key) => self.handle_key_event(key).await?,
                    AppEvent::Api(event) => {
                        self.handle_api_event(event).await?;
                    }
                }
            }
        }

        Ok(())
    }

    fn draw(&mut self, frame: &mut Frame) {
        frame.render_widget(self, frame.area());
    }

    async fn handle_key_event(&mut self, event: KeyEvent) -> anyhow::Result<()> {
        if let Some(action) = self.product.handle_key_event(event) {
            self.handle_action(action).await?;
        }

        if event.kind == KeyEventKind::Press {
            match event.code {
                KeyCode::Char('q') => {
                    self.exit = true;
                }
                _ => {}
            }
        }
        Ok(())
    }

    async fn handle_api_event(&mut self, event: Event) -> anyhow::Result<()> {
        match event {
            Event::SystemChanged { scope: _ } => self.api.update_system_info().await?,
            Event::ConfigChanged { scope: _ } => self.api.update_config().await?,
            _ => {}
        }
        Ok(())
    }

    async fn handle_action(&mut self, action: Action) -> anyhow::Result<()> {
        match action {
            Action::SelectProduct(id) => self.api.select_product(id).await?,
        }
        Ok(())
    }
}

impl Widget for &mut App {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let layout = Layout::vertical([Constraint::Percentage(100), Constraint::Length(1)]);
        let [main, footer] = layout.areas(area);
        self.product.render(main, buf);

        let mut commands = self.product.commands();
        commands.push(Command::new("Quit", "q"));

        let items: Vec<_> = commands.iter().map(|c| style_command(&c)).collect();
        let items: Vec<_> = itertools::intersperse(items.into_iter(), Span::raw(" ")).collect();

        Line::from(items)
            .alignment(Alignment::Right)
            .render(footer, buf);
    }
}

const COMMAND_STYLE: Style = Style::new().bg(WHITE).fg(BLACK);

fn style_command<'a>(command: &'a Command) -> Span<'a> {
    let text = format!(" {} [{}] ", command.title, command.key);
    Span::from(text).style(COMMAND_STYLE)
}
