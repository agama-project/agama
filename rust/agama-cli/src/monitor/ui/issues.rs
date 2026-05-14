// Copyright (c) [2026] SUSE LLC
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

use std::collections::HashMap;

use agama_utils::api::{self, IssueWithScope, Scope};
use gettextrs::gettext;
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Paragraph, Widget, Wrap},
};

use crate::monitor::ui::scope_to_string;

pub struct IssuesList<'a> {
    groups: HashMap<Scope, Vec<&'a api::Issue>>,
}

impl<'a> IssuesList<'a> {
    pub fn new(issues: &'a Vec<IssueWithScope>) -> Self {
        let mut groups: HashMap<Scope, Vec<&api::Issue>> = HashMap::new();
        for issue in issues {
            groups.entry(issue.scope).or_default().push(&issue.issue);
        }
        Self { groups }
    }
}

impl<'a> Widget for IssuesList<'a> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let mut lines = vec![];

        for (scope, issues) in self.groups {
            lines.push(Line::from(format!("  {}", scope_to_string(&scope))));
            lines.push(Line::default());

            for issue in issues {
                lines.push(Line::from(format!("    - {}", &issue.description)));
            }
            lines.push(Line::default());
        }

        lines.push(Line::from(Span::styled(
            gettext("Waiting for these to be resolved."),
            Style::default().add_modifier(Modifier::DIM),
        )));

        Paragraph::new(lines)
            .wrap(Wrap { trim: false })
            .render(area, buf);
    }
}
