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

use std::sync::Arc;

use ratatui::{
    crossterm::event::{KeyCode, KeyEvent, KeyEventKind},
    layout::{Alignment, Constraint, Flex, Layout},
    prelude::{Buffer, Rect},
    style::{
        palette::{material::WHITE, tailwind::BLACK},
        Style,
    },
    text::{Line, Span},
    widgets::{Block, Clear, Paragraph, Widget},
    DefaultTerminal, Frame,
};
use tokio::sync::{mpsc, Mutex};

use crate::{
    action::Action,
    api::{ApiClient, ApiState},
    event::AppEvent,
    ui::{main_page::MainPage, products_page::ProductPage, Command, Page},
};

#[derive(Default)]
pub enum AppPage {
    #[default]
    Product,
    Main,
}

/// Base Ratatui application.
///
/// This struct represents the Ratatui application and implements the user interface.
pub struct App {
    exit: bool,
    busy: bool,
    events_rx: mpsc::Receiver<AppEvent>,
    api_state: Arc<Mutex<ApiState>>,
    api: ApiClient,
    product: ProductPage,
    main: MainPage,
    current_page: AppPage,
}

impl App {
    /// * `api`: handler of the API service.
    /// * `events_rx`: application events, either from the API or the user.
    pub async fn build(
        state: Arc<Mutex<ApiState>>,
        api: ApiClient,
        events_rx: mpsc::Receiver<AppEvent>,
    ) -> Self {
        let products = {
            let state = state.lock().await;
            state.system_info.manager.products.clone()
        };
        let product = ProductPage::new(products);
        let main = MainPage::new();
        Self {
            events_rx,
            api_state: state,
            api,
            exit: false,
            busy: false,
            product,
            main,
            current_page: AppPage::default(),
        }
    }

    /// Runs the application dispatching the application events.
    pub async fn run(&mut self, terminal: &mut DefaultTerminal) -> anyhow::Result<()> {
        while !self.exit {
            terminal.draw(|frame| self.draw(frame))?;

            if let Some(event) = self.events_rx.recv().await {
                match event {
                    AppEvent::Key(key) => self.handle_key_event(key).await?,
                    AppEvent::ApiStateChanged => {}
                    // TODO: add a message.
                    AppEvent::RequestStarted => {
                        self.busy = true;
                    }
                    AppEvent::RequestFinished => {
                        self.busy = false;
                    }
                    AppEvent::ProductSelected => self.current_page = AppPage::Main,
                }
            }
        }

        Ok(())
    }

    fn draw(&mut self, frame: &mut Frame) {
        frame.render_widget(self, frame.area());
    }

    async fn handle_key_event(&mut self, event: KeyEvent) -> anyhow::Result<()> {
        if event.kind == KeyEventKind::Press {
            match event.code {
                KeyCode::Char('q') => {
                    self.exit = true;
                }
                _ => {}
            }
        }

        if self.busy {
            return Ok(());
        }

        match self.current_page {
            AppPage::Product => {
                if let Some(action) = self.product.handle_key_event(event) {
                    self.handle_action(action).await?;
                }
            }

            AppPage::Main => {
                if let Some(action) = self.main.handle_key_event(event) {
                    self.handle_action(action).await?;
                }
            }
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

        // TODO: refactor to avoid repetition.
        let mut commands = match self.current_page {
            AppPage::Product => {
                self.product.render(main, buf);
                self.product.commands()
            }
            AppPage::Main => {
                self.main.render(main, buf);
                self.main.commands()
            }
        };

        commands.push(Command::new("Quit", "q"));
        let items: Vec<_> = commands.iter().map(|c| style_command(&c)).collect();
        let items: Vec<_> = itertools::intersperse(items.into_iter(), Span::raw(" ")).collect();

        Line::from(items)
            .alignment(Alignment::Right)
            .render(footer, buf);

        if self.busy {
            let popup_area = popup_area(main, 20, 20);
            Clear.render(popup_area, buf);

            Paragraph::new("Please, wait...")
                .block(Block::bordered())
                .alignment(Alignment::Center)
                .render(popup_area, buf);
        }
    }
}

const COMMAND_STYLE: Style = Style::new().bg(WHITE).fg(BLACK);

fn style_command<'a>(command: &'a Command) -> Span<'a> {
    let text = format!(" {} [{}] ", command.title, command.key);
    Span::from(text).style(COMMAND_STYLE)
}

/// Create a centered rect using up certain percentage of the available rect
///
/// Borrowed from Ratatui examples: https://github.com/ratatui/ratatui/blob/main/examples/apps/popup/src/main.rs#L63.
/// helper function to create a centered rect using up certain percentage of the available rect `r`
fn popup_area(area: Rect, percent_x: u16, percent_y: u16) -> Rect {
    let vertical = Layout::vertical([Constraint::Percentage(percent_y)]).flex(Flex::Center);
    let horizontal = Layout::horizontal([Constraint::Percentage(percent_x)]).flex(Flex::Center);
    let [area] = vertical.areas(area);
    let [area] = horizontal.areas(area);
    area
}
