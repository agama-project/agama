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
    crossterm::event::{KeyCode, KeyEvent, KeyEventKind},
    layout::{Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::Line,
    widgets::{Block, List, ListState, Paragraph, StatefulWidget, Widget, Wrap},
};

use crate::{
    action::Action,
    ui::{Command, Page},
};

pub struct ProductPage {
    state: ListState,
    products: Vec<Product>,
}

impl ProductPage {
    pub fn new(products: Vec<Product>) -> Self {
        Self {
            products,
            state: ListState::default().with_selected(Some(0)),
        }
    }

    pub fn selected_product(&self) -> Option<&Product> {
        if let Some(selected) = self.state.selected() {
            return self.products.get(selected);
        }
        None
    }
}

impl Page for ProductPage {
    fn handle_key_event(&mut self, event: KeyEvent) -> Option<Action> {
        if event.kind == KeyEventKind::Press {
            match event.code {
                KeyCode::Enter => {
                    if let Some(product) = self.selected_product() {
                        return Some(Action::SelectProduct(product.id.to_string()));
                    }
                }
                KeyCode::Down | KeyCode::Char('j') => {
                    self.state.select_next();
                }
                KeyCode::Up | KeyCode::Char('k') => {
                    self.state.select_previous();
                }
                _ => {}
            }
        }
        None
    }

    fn commands(&mut self) -> Vec<super::Command> {
        vec![
            Command::new("Previous", "Up/k"),
            Command::new("Next", "Down/j"),
            Command::new("Select", "ENTER"),
        ]
    }
}

const SELECTED_STYLE: Style = Style::new().add_modifier(Modifier::BOLD);

impl Widget for &mut ProductPage {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let layout = Layout::vertical([Constraint::Percentage(30), Constraint::Percentage(70)]);
        let [products_area, selected_area] = layout.areas(area);

        let names: Vec<_> = self
            .products
            .iter()
            .map(|p| Line::from(p.name.as_str()))
            .collect();

        let list = List::new(names)
            .highlight_style(SELECTED_STYLE)
            .block(Block::bordered().title("Product to install"));

        StatefulWidget::render(list, products_area, buf, &mut self.state);

        if let Some(selected) = self.state.selected() {
            if let Some(product) = self.products.get(selected) {
                Paragraph::new(product.description.as_str())
                    .wrap(Wrap::default())
                    .block(Block::bordered())
                    .render(selected_area, buf);
            }
        }
    }
}
