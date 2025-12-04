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
    prelude::{Buffer, Rect},
    text::Line,
    widgets::{StatefulWidget, Widget},
};

use crate::api::ApiState;

#[derive(Clone)]
pub struct OverviewPageModel {
    api: Arc<Mutex<ApiState>>,
}

impl OverviewPageModel {
    pub fn new(api: Arc<Mutex<ApiState>>) -> Self {
        Self { api }
    }
}

pub struct OverviewPage;

impl StatefulWidget for &OverviewPage {
    type State = OverviewPageModel;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        let api = state.api.try_lock().unwrap();
        let Some(proposal) = api
            .proposal
            .software
            .as_ref()
            .map(|p| p.software.as_ref())
            .flatten()
        else {
            Line::from("There is not software proposal yet.").render(area, buf);
            return;
        };

        Line::from(format!(
            "The installation will take {}",
            proposal.used_space.to_string()
        ))
        .render(area, buf);
    }
}
