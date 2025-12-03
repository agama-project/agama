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
    style::{palette::tailwind, Color},
    text::Line,
    widgets::{StatefulWidget, Tabs, Widget},
};
use strum::{Display, EnumIter, FromRepr, IntoEnumIterator};
use tokio::sync::mpsc;

use crate::{
    message::Message,
    ui::{overview_page::OverviewPage, Command},
};

/// Borrowed from https://ratatui.rs/examples/widgets/tabs/
#[derive(Clone, Copy, Default, Display, FromRepr, EnumIter)]
pub enum SelectedTab {
    #[default]
    #[strum(to_string = "Overview [o]")]
    Overview,
    #[strum(to_string = "Network [n]")]
    Network,
}

impl SelectedTab {
    fn title(self) -> Line<'static> {
        format!(" {self} ").into()
    }
}

pub struct MainPageState {
    selected_tab: SelectedTab,
}

impl Default for MainPageState {
    fn default() -> Self {
        Self {
            selected_tab: SelectedTab::Overview,
        }
    }
}

impl MainPageState {
    pub async fn update(&mut self, message: Message, _messages_tx: mpsc::Sender<Message>) {
        let Message::Key(event) = message else {
            return;
        };

        if event.kind != KeyEventKind::Press {
            return;
        }

        match event.code {
            KeyCode::Char('o') => self.selected_tab = SelectedTab::Overview,
            KeyCode::Char('n') => self.selected_tab = SelectedTab::Network,
            _ => {}
        }
    }

    pub fn commands(&self) -> Vec<Command> {
        vec![]
    }
}

pub struct MainPage;

impl StatefulWidget for MainPage {
    type State = MainPageState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        let layout = Layout::vertical([Constraint::Length(1), Constraint::Min(0)]);
        let [tab_area, main_area] = layout.areas(area);

        let titles = SelectedTab::iter().map(SelectedTab::title);
        let highlight_style = (Color::default(), tailwind::EMERALD.c700);
        let selected_tab_index = state.selected_tab as usize;
        Tabs::new(titles)
            .highlight_style(highlight_style)
            .select(selected_tab_index)
            .padding("", "")
            .divider(" ")
            .render(tab_area, buf);

        match state.selected_tab {
            SelectedTab::Overview => Widget::render(&OverviewPage, main_area, buf),
            SelectedTab::Network => {}
        }
    }
}
