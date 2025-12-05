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

use ratatui::{
    buffer::Buffer,
    crossterm::event::{KeyCode, KeyEventKind},
    layout::{Constraint, Layout, Rect},
    style::{Modifier, Style, Stylize},
    text::{Line, Text},
    widgets::{Block, List, ListItem, ListState, Paragraph, StatefulWidget, Widget, Wrap},
};
use tokio::sync::mpsc;

use crate::{api::ApiState, message::Message, ui::Command};

pub struct Product {
    /// Product ID (eg., "ALP", "Tumbleweed", etc.)
    pub id: String,
    /// Product name (e.g., "openSUSE Tumbleweed")
    pub name: String,
    /// Product description
    pub description: String,
    /// Whether the product is the selected one.
    pub selected: bool,
}

pub struct ProductPageState {
    products: Vec<Product>,
    list: ListState,
}

impl ProductPageState {
    pub fn from_api(api_state: &ApiState) -> Self {
        let products = Self::products_from_api(api_state);
        let selected = products.iter().position(|p| p.selected);

        Self {
            products,
            list: ListState::default().with_selected(selected),
        }
    }

    // This is not expected to happen.
    pub fn update_from_api(&mut self, api_state: &ApiState) {
        self.products = Self::products_from_api(api_state);
    }

    fn products_from_api(api_state: &ApiState) -> Vec<Product> {
        let product_id = api_state.selected_product().map(|p| &p.id);
        api_state
            .system_info
            .manager
            .products
            .iter()
            .map(|p| Product {
                id: p.id.clone(),
                name: p.name.clone(),
                description: p.description.clone(),
                selected: Some(&p.id) == product_id,
            })
            .collect()
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
            Command::new("Close", "Esc"),
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

        let list = List::new(&state.products)
            .highlight_style(SELECTED_STYLE)
            .highlight_symbol(">> ")
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

impl From<&Product> for ListItem<'_> {
    fn from(value: &Product) -> Self {
        let line = if value.selected {
            Line::styled(value.name.to_string(), Style::default().green())
        } else {
            Line::from(value.name.to_string())
        };
        // let description = Line::from(value.description.to_string());
        // ListItem::new(Text::from(vec![line, description]))
        ListItem::new(line)
    }
}
