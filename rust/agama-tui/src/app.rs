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

use agama_utils::{
    actor::Handler,
    api::{Config, SystemInfo},
};
use ratatui::{
    crossterm::event::{KeyCode, KeyEvent, KeyEventKind},
    layout::Layout,
    prelude::{Buffer, Rect},
    text::{Line, Text},
    widgets::{Block, Paragraph, Widget},
    DefaultTerminal, Frame,
};
use tokio::sync::mpsc;

use crate::{api, event::AppEvent};

/// Base Ratatui application.
///
/// This struct represents the Ratatui application and implements the user interface.
pub struct App {
    exit: bool,
    api: Handler<api::Service>,
    events_rx: mpsc::Receiver<AppEvent>,
    state: AppState,
}

impl App {
    /// * `api`: handler of the API service.
    /// * `events_rx`: application events, either from the API or the user.
    pub fn new(api: Handler<api::Service>, events_rx: mpsc::Receiver<AppEvent>) -> Self {
        Self {
            exit: false,
            api,
            events_rx,
            state: AppState::default(),
        }
    }

    /// Runs the application dispatching the application events.
    pub async fn run(&mut self, terminal: &mut DefaultTerminal) -> anyhow::Result<()> {
        _ = self.update_from_api().await;

        while !self.exit {
            terminal.draw(|frame| self.draw(frame))?;

            if let Some(event) = self.events_rx.recv().await {
                match event {
                    AppEvent::Key(key) => self.handle_key_event(key),
                    AppEvent::Api(_) => {
                        _ = self.update_from_api().await;
                    }
                }
            }
        }

        Ok(())
    }

    fn draw(&self, frame: &mut Frame) {
        frame.render_widget(self, frame.area());
    }

    fn handle_key_event(&mut self, event: KeyEvent) {
        if event.kind == KeyEventKind::Press {
            match event.code {
                KeyCode::Char('q') => {
                    self.exit = true;
                }
                _ => {}
            }
        }
    }

    /// Updates the data from the API.
    async fn update_from_api(&mut self) -> anyhow::Result<()> {
        let message: api::message::Get<SystemInfo> = api::message::Get::new();
        self.state.system_info = self
            .api
            .call(message)
            .await
            .expect("Could not get the system state");

        let message: api::message::Get<Config> = api::message::Get::new();
        self.state.config = self
            .api
            .call(message)
            .await
            .expect("Could not get the configuration");
        Ok(())
    }
}

#[derive(Default)]
struct AppState {
    system_info: Option<SystemInfo>,
    config: Option<Config>,
}

impl Widget for &App {
    /// NOTE: the current implementation is just a PoC. It should be rewritten with the actual UI.
    fn render(self, area: Rect, buf: &mut Buffer) {
        let Some(system_info) = &self.state.system_info else {
            Line::from("System information not loaded yet").render(area, buf);
            return;
        };

        let layout = Layout::vertical([10, 5]);
        let [products_area, selected_area] = layout.areas(area);

        let text = Text::from_iter(
            system_info
                .manager
                .products
                .iter()
                .map(|p| Line::from(p.name.as_str())),
        );

        Paragraph::new(text)
            .block(
                Block::bordered()
                    .title("Available products")
                    .title_bottom("Press 'q' to exit"),
            )
            .render(products_area, buf);

        let software_config = &self
            .state
            .config
            .as_ref()
            .map(|c| c.software.as_ref())
            .flatten();

        if let Some(config) = software_config {
            if let Some(product_id) = &config.product.clone().map(|p| p.id).flatten() {
                let product = system_info
                    .manager
                    .products
                    .iter()
                    .find(|p| p.id == *product_id);

                let text = if let Some(product) = product {
                    format!("Selected product: {}", product.name)
                } else {
                    "No selected product".to_string()
                };

                Line::from(text).render(selected_area, buf);
            }
        }
    }
}
