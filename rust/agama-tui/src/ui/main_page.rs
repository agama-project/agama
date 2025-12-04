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
    crossterm::event::{KeyCode, KeyEventKind},
    layout::{Constraint, Layout, Rect},
    style::{palette::tailwind, Color},
    text::Line,
    widgets::{StatefulWidget, Tabs, Widget},
};
use strum::Display;
use tokio::sync::mpsc;

use crate::{
    api::ApiState,
    message::Message,
    ui::{
        overview_page::{OverviewPage, OverviewPageModel},
        Command,
    },
};

/// Borrowed from https://ratatui.rs/examples/widgets/tabs/
#[derive(Clone, Display)]
pub enum SelectedTab {
    Overview(OverviewPageModel),
    Network,
}

impl SelectedTab {
    fn index(&self) -> usize {
        match self {
            Self::Overview(_) => 0,
            Self::Network => 1,
        }
    }
}

pub struct MainPageState {
    selected_tab: SelectedTab,
    api: Arc<Mutex<ApiState>>,
}

impl MainPageState {
    pub fn new(api: Arc<Mutex<ApiState>>) -> Self {
        let overview = OverviewPageModel::new(api.clone());
        Self {
            api,
            selected_tab: SelectedTab::Overview(overview),
        }
    }

    pub async fn update(&mut self, message: Message, _messages_tx: mpsc::Sender<Message>) {
        let Message::Key(event) = message else {
            return;
        };

        if event.kind != KeyEventKind::Press {
            return;
        }

        match event.code {
            KeyCode::Char('o') => {
                let overview = OverviewPageModel::new(self.api.clone());
                self.selected_tab = SelectedTab::Overview(overview);
            }
            KeyCode::Char('n') => self.selected_tab = SelectedTab::Network,
            _ => {}
        }
    }

    pub fn commands(&self) -> Vec<Command> {
        vec![]
    }

    pub fn titles(&self) -> Vec<Line<'static>> {
        vec![Line::from("Overview [o]"), Line::from("Network [n]")]
    }
}

pub struct MainPage;

impl StatefulWidget for MainPage {
    type State = MainPageState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        let layout = Layout::vertical([Constraint::Length(1), Constraint::Min(0)]);
        let [tab_area, main_area] = layout.areas(area);

        let highlight_style = (Color::default(), tailwind::EMERALD.c700);
        let selected_tab_index = state.selected_tab.index();
        Tabs::new(state.titles())
            .highlight_style(highlight_style)
            .select(selected_tab_index)
            .padding("", "")
            .divider(" ")
            .render(tab_area, buf);

        match &mut state.selected_tab {
            SelectedTab::Overview(state) => {
                StatefulWidget::render(&OverviewPage, main_area, buf, state)
            }
            SelectedTab::Network => {}
        }
    }
}
