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
    crossterm::event::{KeyCode, KeyEvent, KeyEventKind},
    layout::{Constraint, Layout, Rect},
    style::{palette::tailwind, Color},
    text::Line,
    widgets::{Tabs, Widget},
};
use strum::{Display, EnumIter, FromRepr, IntoEnumIterator};

use crate::{
    action::Action,
    ui::{overview_page::OverviewPage, Page},
};

/// Borrowed from https://ratatui.rs/examples/widgets/tabs/
#[derive(Clone, Copy, Default, Display, FromRepr, EnumIter)]
enum SelectedTab {
    #[default]
    #[strum(to_string = "Overview [o]")]
    Overview,
    #[strum(to_string = "Network [n]")]
    Network,
}

impl SelectedTab {
    /// Get the previous tab, if there is no previous tab return the current tab.
    fn previous(self) -> Self {
        let current_index: usize = self as usize;
        let previous_index = current_index.saturating_sub(1);
        Self::from_repr(previous_index).unwrap_or(self)
    }

    /// Get the next tab, if there is no next tab return the current tab.
    fn next(self) -> Self {
        let current_index = self as usize;
        let next_index = current_index.saturating_add(1);
        Self::from_repr(next_index).unwrap_or(self)
    }

    fn title(self) -> Line<'static> {
        format!(" {self} ").into()
    }
}

pub struct MainPage {
    selected_tab: SelectedTab,
    overview: OverviewPage,
}

impl MainPage {
    pub fn new() -> Self {
        Self {
            selected_tab: SelectedTab::Overview,
            overview: OverviewPage,
        }
    }
}
impl Page for MainPage {
    fn handle_key_event(&mut self, event: KeyEvent) -> Option<Action> {
        if event.kind == KeyEventKind::Press {
            match event.code {
                KeyCode::Char('o') => self.selected_tab = SelectedTab::Overview,
                KeyCode::Char('n') => self.selected_tab = SelectedTab::Network,
                _ => {}
            }
        }
        None
    }
}

impl Widget for &mut MainPage {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let layout = Layout::vertical([Constraint::Length(1), Constraint::Min(0)]);
        let [tab_area, main_area] = layout.areas(area);

        let titles = SelectedTab::iter().map(SelectedTab::title);
        let highlight_style = (Color::default(), tailwind::EMERALD.c700);
        let selected_tab_index = self.selected_tab as usize;
        Tabs::new(titles)
            .highlight_style(highlight_style)
            .select(selected_tab_index)
            .padding("", "")
            .divider(" ")
            .render(tab_area, buf);

        match self.selected_tab {
            SelectedTab::Overview => {
                self.overview.render(main_area, buf);
            }
            SelectedTab::Network => {}
        }
    }
}
