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

use agama_utils::api::Progress as ApiProgress;
use ratatui::{
    prelude::{Buffer, Rect},
    widgets::{Block, List, ListItem, ListState, StatefulWidget},
};

use crate::api::ApiState;

pub struct ProgressState {
    progresses: Vec<Progress>,
}

struct Progress(ApiProgress);

impl Progress {
    fn inner(&self) -> &ApiProgress {
        &self.0
    }
}

impl ProgressState {
    pub fn from_api(api_state: &ApiState) -> Self {
        Self {
            progresses: Self::progress_from_api(api_state),
        }
    }

    pub fn update_from_api(&mut self, api_state: &ApiState) {
        self.progresses = Self::progress_from_api(api_state);
    }

    pub fn has_progress(&self) -> bool {
        !self.progresses.is_empty()
    }

    fn progress_from_api(api_state: &ApiState) -> Vec<Progress> {
        api_state
            .status
            .progresses
            .iter()
            .cloned()
            .map(Progress)
            .collect()
    }
}

pub struct ProgressWidget;

impl StatefulWidget for ProgressWidget {
    type State = ProgressState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        let list = List::new(&state.progresses).block(Block::bordered().title(" Progress "));

        StatefulWidget::render(list, area, buf, &mut ListState::default());
    }
}

impl From<&Progress> for ListItem<'_> {
    fn from(value: &Progress) -> Self {
        let progress = value.inner();
        let text = format!(
            "{}/{} {}: {}",
            progress.index, progress.size, progress.scope, &progress.step
        );
        ListItem::from(text)
    }
}
