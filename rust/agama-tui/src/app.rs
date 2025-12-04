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

use std::sync::{Arc, Mutex};

use ratatui::{
    crossterm::event::{KeyCode, KeyEvent, KeyEventKind},
    layout::{Alignment, Constraint, Flex, Layout},
    prelude::{Buffer, Rect},
    style::{
        palette::{
            material::WHITE,
            tailwind::{self},
        },
        Style,
    },
    text::{Line, Span},
    widgets::{Block, Clear, Paragraph, StatefulWidget, Widget},
    DefaultTerminal, Frame,
};
use tokio::sync::mpsc;

use crate::{
    api::{ApiClient, ApiState},
    message::Message,
    ui::{
        main_page::{MainPage, MainPageState},
        products_page::{ProductPage, ProductPageState},
        Command,
    },
};

pub enum Page {
    Product(ProductPageState),
    Main(MainPageState),
}

/// Base Ratatui application.
///
/// This struct represents the Ratatui application and implements the user interface.
pub struct App {
    exit: bool,
    busy: bool,
    messages_tx: mpsc::Sender<Message>,
    messages_rx: mpsc::Receiver<Message>,
    api_state: Arc<Mutex<ApiState>>,
    api: ApiClient,
    current_page: Page,
}

impl App {
    /// * `api`: handler of the API service.
    /// * `messages_rx`: application messages, either from the API or the user.
    pub async fn build(
        state: Arc<Mutex<ApiState>>,
        api: ApiClient,
        messages_tx: mpsc::Sender<Message>,
        messages_rx: mpsc::Receiver<Message>,
    ) -> Self {
        let product = {
            let state = state.lock().unwrap();
            ProductPageState::from_api(&state)
        };
        Self {
            messages_tx,
            messages_rx,
            api_state: state,
            api,
            exit: false,
            busy: false,
            current_page: Page::Product(product),
        }
    }

    /// Runs the application dispatching the application events.
    pub async fn run(&mut self, terminal: &mut DefaultTerminal) -> anyhow::Result<()> {
        while !self.exit {
            terminal.draw(|frame| self.draw(frame))?;

            if let Some(message) = self.messages_rx.recv().await {
                let messages_tx = self.messages_tx.clone();
                self.update(message, messages_tx).await;
            }
        }

        Ok(())
    }

    async fn update(&mut self, message: Message, messages_tx: mpsc::Sender<Message>) {
        if let Message::Key(event) = message {
            self.handle_key_event(event).await;
        }

        match message {
            Message::RequestStarted => {
                self.busy = true;
            }
            Message::RequestFinished => {
                self.busy = false;
            }
            Message::SelectProduct(id) => {
                _ = self.api.select_product(&id).await;
            }
            Message::ProductSelected => {
                self.current_page = Page::Main(MainPageState::new(self.api_state.clone()));
            }
            Message::ApiStateChanged => match &mut self.current_page {
                Page::Main(model) => model.update(message, messages_tx).await,
                _ => {}
            },
            _ => {}
        }
    }

    fn draw(&mut self, frame: &mut Frame) {
        frame.render_widget(self, frame.area());
    }

    // Whether to stop handling the event.
    async fn handle_key_event(&mut self, event: KeyEvent) -> bool {
        if event.kind == KeyEventKind::Press {
            match event.code {
                KeyCode::Char('q') => {
                    self.exit = true;
                    return true;
                }
                _ => {
                    if self.busy {
                        return true;
                    }
                }
            }
        }
        false
    }
}

impl Widget for &mut App {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let layout = Layout::vertical([Constraint::Percentage(100), Constraint::Length(1)]);
        let [main, footer] = layout.areas(area);

        // TODO: refactor to avoid repetition.
        let mut commands = match &mut self.current_page {
            Page::Product(state) => {
                StatefulWidget::render(ProductPage, main, buf, state);
                state.commands()
            }
            Page::Main(state) => {
                StatefulWidget::render(MainPage, main, buf, state);
                state.commands()
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

const COMMAND_STYLE: Style = Style::new().bg(tailwind::EMERALD.c700).fg(WHITE);

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
