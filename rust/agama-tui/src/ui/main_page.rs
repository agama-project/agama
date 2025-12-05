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
    buffer::Buffer,
    crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyModifiers},
    layout::{Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::Line,
    widgets::{Clear, StatefulWidget, Tabs, Widget},
};
use strum::Display;
use tokio::sync::mpsc;

use crate::{
    api::ApiState,
    message::Message,
    ui::{
        network_page::{NetworkPage, NetworkPageState},
        overview_page::{OverviewPage, OverviewPageState},
        products_page::{ProductPage, ProductPageState},
        progress::{ProgressState, ProgressWidget},
        storage_page::{StoragePage, StoragePageState},
        Command,
    },
    utils::popup_area,
};

#[derive(Clone, Display)]
pub enum SelectedTab {
    Overview,
    Network,
    Storage,
}

impl SelectedTab {
    fn index(&self) -> usize {
        match self {
            Self::Overview => 0,
            Self::Network => 1,
            Self::Storage => 2,
        }
    }
}

pub struct MainPageState {
    selected_tab: SelectedTab,
    api: Arc<Mutex<ApiState>>,
    network_state: NetworkPageState,
    overview_state: OverviewPageState,
    storage_state: StoragePageState,
    product_state: ProductPageState,
    progress_state: ProgressState,
    product_popup: bool,
}

impl MainPageState {
    pub fn new(api: Arc<Mutex<ApiState>>) -> Self {
        let api_state = api.lock().unwrap();
        let overview = OverviewPageState::from_api(&api_state);
        let storage = StoragePageState::from_api(&api_state);
        let product = ProductPageState::from_api(&api_state);
        let network = NetworkPageState::from_api(&api_state);
        let progress = ProgressState::from_api(&api_state);
        let product_popup = api_state.selected_product().is_none();
        drop(api_state);

        Self {
            api,
            selected_tab: SelectedTab::Overview,
            network_state: network,
            overview_state: overview,
            storage_state: storage,
            product_state: product,
            progress_state: progress,
            product_popup,
        }
    }

    pub fn commands(&self) -> Vec<Command> {
        vec![
            Command::new("Alt+p", "Change product"),
            Command::new("Alt+[1-3]", "Change section"),
            Command::new("Tab", "Focus"),
        ]
    }

    pub fn titles(&self) -> Vec<Line<'static>> {
        vec![
            Line::from("Overview [1]"),
            Line::from("Network [2]"),
            Line::from("Storage [3]"),
        ]
    }

    pub async fn update(&mut self, message: Message, messages_tx: mpsc::Sender<Message>) {
        match message {
            Message::Key(event) => {
                if self.product_popup {
                    self.product_state
                        .update(message.clone(), messages_tx.clone())
                        .await;
                } else {
                    self.handle_key_event(event);
                }
            }
            Message::ProductSelected => self.product_popup = false,
            Message::ApiStateChanged => {
                let api_state = self.api.lock().unwrap();
                self.overview_state.update_from_api(&api_state);
                self.storage_state.update_from_api(&api_state);
                self.product_state.update_from_api(&api_state);
                self.network_state.update_from_api(&api_state);
                self.progress_state.update_from_api(&api_state);
            }
            _ => {}
        }

        self.update_selected_tab(message, messages_tx);
    }

    fn handle_key_event(&mut self, event: KeyEvent) {
        if event.kind != KeyEventKind::Press {
            return;
        }

        if event.modifiers.contains(KeyModifiers::ALT) {
            match event.code {
                KeyCode::Char('1') => self.selected_tab = SelectedTab::Overview,
                KeyCode::Char('2') => self.selected_tab = SelectedTab::Network,
                KeyCode::Char('3') => self.selected_tab = SelectedTab::Storage,
                KeyCode::Char('p') => self.product_popup = true,
                KeyCode::Esc => self.product_popup = false,
                _ => {} // TODO: delegate events to the selected tab
            }
        }
    }

    fn update_selected_tab(&mut self, message: Message, messages_tx: mpsc::Sender<Message>) {
        match self.selected_tab {
            SelectedTab::Storage => {
                self.storage_state.update(message, messages_tx);
            }
            SelectedTab::Network => {
                self.network_state.update(message, messages_tx);
            }
            _ => {}
        }
    }
}

pub struct MainPage;

impl StatefulWidget for MainPage {
    type State = MainPageState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        use Constraint::{Length, Min};

        let has_progress = state.progress_state.has_progress();
        let mut constraints = vec![Length(2), Min(0)];

        let tab_area: Rect;
        let main_area: Rect;
        let mut progress_area = Rect::default();

        if has_progress {
            constraints.push(Length(4));
            let layout = Layout::vertical(&constraints);
            [tab_area, main_area, progress_area] = layout.areas(area);
        } else {
            let layout = Layout::vertical(&constraints);
            [tab_area, main_area] = layout.areas(area);
        }

        let highlight_style = Style::default().add_modifier(Modifier::UNDERLINED);
        let selected_tab_index = state.selected_tab.index();
        Tabs::new(state.titles())
            .highlight_style(highlight_style)
            .select(selected_tab_index)
            .padding(" ", " ")
            .divider(" | ")
            .render(tab_area, buf);

        match &mut state.selected_tab {
            SelectedTab::Overview => {
                StatefulWidget::render(OverviewPage, main_area, buf, &mut state.overview_state)
            }
            SelectedTab::Network => {
                StatefulWidget::render(NetworkPage, main_area, buf, &mut state.network_state)
            }
            SelectedTab::Storage => {
                StatefulWidget::render(StoragePage, main_area, buf, &mut state.storage_state)
            }
        }

        if has_progress {
            StatefulWidget::render(
                ProgressWidget,
                progress_area,
                buf,
                &mut state.progress_state,
            )
        }

        if state.product_popup {
            let popup_area = popup_area(area, 80, 80);
            Clear.render(popup_area, buf);
            StatefulWidget::render(ProductPage, popup_area, buf, &mut state.product_state);
        }
    }
}
