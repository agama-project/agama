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

use agama_utils::api::manager::Product;
use ratatui::{
    buffer::Buffer,
    crossterm::event::{KeyCode, KeyEventKind},
    layout::{Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::Line,
    widgets::{Block, List, ListState, Paragraph, StatefulWidget, Widget, Wrap},
};
use tokio::sync::mpsc;

use crate::{message::Message, ui::Command};

pub struct ProductPageState {
    products: Vec<Product>,
    list: ListState,
}

impl ProductPageState {
    pub fn new(products: Vec<Product>) -> Self {
        Self {
            products,
            list: ListState::default().with_selected(Some(0)),
        }
    }

    pub async fn update(&mut self, message: Message, messages_tx: mpsc::Sender<Message>) {
        let Message::Key(event) = message else {
            return;
        };

        if event.kind != KeyEventKind::Press {
            return;
        }

        match event.code {
            KeyCode::Enter => {
                if let Some(selected) = self.selected_product() {
                    _ = messages_tx
                        .send(Message::SelectProduct(selected.id.to_string()))
                        .await;
                }
            }
            KeyCode::Down | KeyCode::Char('j') => {
                self.list.select_next();
            }
            KeyCode::Up | KeyCode::Char('k') => {
                self.list.select_previous();
            }
            _ => {}
        }
    }

    pub fn commands(&self) -> Vec<super::Command> {
        vec![
            Command::new("Previous", "Up/k"),
            Command::new("Next", "Down/j"),
            Command::new("Select", "ENTER"),
        ]
    }

    fn selected_product(&self) -> Option<&Product> {
        if let Some(selected) = self.list.selected() {
            return self.products.get(selected);
        }
        None
    }
}

pub struct ProductPage;

const SELECTED_STYLE: Style = Style::new().add_modifier(Modifier::BOLD);

impl StatefulWidget for ProductPage {
    type State = ProductPageState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        let layout = Layout::vertical([Constraint::Percentage(30), Constraint::Percentage(70)]);
        let [products_area, selected_area] = layout.areas(area);

        let names: Vec<_> = state
            .products
            .iter()
            .map(|p| Line::from(p.name.as_str()))
            .collect();

        let list = List::new(names)
            .highlight_style(SELECTED_STYLE)
            .block(Block::bordered().title("Product to install"));

        StatefulWidget::render(list, products_area, buf, &mut state.list);

        if let Some(selected) = state.list.selected() {
            if let Some(product) = state.products.get(selected) {
                Paragraph::new(product.description.as_str())
                    .wrap(Wrap::default())
                    .block(Block::bordered())
                    .render(selected_area, buf);
            }
        }
    }
}
