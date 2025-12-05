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

use agama_utils::api::software::{Pattern as ApiPattern, SelectedBy, SoftwareProposal};
use ratatui::{
    layout::{Constraint, Layout},
    prelude::{Buffer, Rect},
    text::Line,
    widgets::{Block, List, ListItem, ListState, StatefulWidget, Widget},
};

use crate::api::ApiState;

#[derive(Ord, Eq, PartialEq, PartialOrd)]
struct Pattern {
    name: String,
    description: String,
    auto: bool,
}

#[derive(Default)]
pub struct OverviewPageState {
    used_space: Option<i64>,
    patterns: Vec<Pattern>,
}

impl OverviewPageState {
    pub fn from_api(api_state: &ApiState) -> Self {
        let mut state = Self::default();
        if Self::proposal_from_api(&api_state).is_none() {
            return state;
        };

        state.update_from_api(api_state);
        state
    }

    pub fn update_from_api(&mut self, api_state: &ApiState) {
        if let Some(proposal) = Self::proposal_from_api(&api_state) {
            self.used_space = Some(proposal.used_space);
            self.patterns =
                Self::patterns_from_api(&proposal, &api_state.system_info.software.patterns);
        } else {
            *self = Self::default();
        }
    }

    fn proposal_from_api(api_state: &ApiState) -> Option<&SoftwareProposal> {
        api_state
            .proposal
            .software
            .as_ref()
            .and_then(|p| p.software.as_ref())
    }

    fn patterns_from_api(proposal: &SoftwareProposal, patterns: &Vec<ApiPattern>) -> Vec<Pattern> {
        let mut patterns: Vec<_> = proposal
            .patterns
            .iter()
            .flat_map(|(name, selected)| {
                if selected == &SelectedBy::None {
                    return None;
                }
                patterns.iter().find(|p| &p.name == name).map(|p| Pattern {
                    name: p.name.clone(),
                    description: p.description.clone(),
                    auto: false,
                })
            })
            .collect();
        patterns.sort();
        patterns
    }
}

pub struct OverviewPage;

impl StatefulWidget for OverviewPage {
    type State = OverviewPageState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        let layout = Layout::vertical([Constraint::Percentage(70), Constraint::Percentage(30)]);
        let [software_area, _other_area] = layout.areas(area);

        let software_layout = Layout::vertical([Constraint::Length(2), Constraint::Min(0)]);
        let [used_space_area, patterns_area] = software_layout.areas(software_area);

        let block = Block::bordered().title(" Software ");
        let list = List::new(&state.patterns).block(block);
        StatefulWidget::render(list, patterns_area, buf, &mut ListState::default());

        let line = if let Some(used_space) = state.used_space {
            Line::from(format!(
                "The installation will take {}",
                used_space.to_string()
            ))
        } else {
            Line::from("There is not software proposal yet.")
        };

        line.render(used_space_area, buf);
    }
}

impl From<&Pattern> for ListItem<'_> {
    fn from(value: &Pattern) -> Self {
        let description = format!("- {}: {}", &value.name, &value.description);
        let line = if value.auto {
            format!("{} [auto]", description)
        } else {
            format!("{}", description)
        };
        ListItem::new(line)
    }
}
