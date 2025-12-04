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

use agama_utils::api::software::SoftwareProposal;
use ratatui::{
    prelude::{Buffer, Rect},
    text::Line,
    widgets::{StatefulWidget, Widget},
};

use crate::api::ApiState;

#[derive(Clone, Default)]
pub struct OverviewPageState {
    used_space: Option<i64>,
}

impl OverviewPageState {
    pub fn from_api(api_state: &ApiState) -> Self {
        if let Some(proposal) = Self::proposal_from_api(&api_state) {
            Self {
                used_space: Some(proposal.used_space),
            }
        } else {
            Self::default()
        }
    }

    pub fn update_from_api(&mut self, api_state: &ApiState) {
        if let Some(proposal) = Self::proposal_from_api(&api_state) {
            self.used_space = Some(proposal.used_space);
        } else {
            self.used_space = None
        }
    }

    fn proposal_from_api(api_state: &ApiState) -> Option<&SoftwareProposal> {
        api_state
            .proposal
            .software
            .as_ref()
            .and_then(|p| p.software.as_ref())
    }
}

pub struct OverviewPage;

impl StatefulWidget for &OverviewPage {
    type State = OverviewPageState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        let line = if let Some(used_space) = state.used_space {
            Line::from(format!(
                "The installation will take {}",
                used_space.to_string()
            ))
        } else {
            Line::from("There is not software proposal yet.")
        };

        line.render(area, buf);
    }
}
