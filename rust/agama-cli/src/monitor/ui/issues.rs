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

use agama_utils::api::{self, IssueWithScope};
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    text::Line,
    widgets::{Paragraph, Widget, Wrap},
};

pub struct IssuesList<'a> {
    issues: &'a Vec<api::IssueWithScope>,
}

impl<'a> IssuesList<'a> {
    pub fn new(issues: &'a Vec<IssueWithScope>) -> Self {
        Self { issues }
    }
}

impl<'a> Widget for IssuesList<'a> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let mut lines = vec![];

        for issue in self.issues {
            lines.push(Line::from(format!("- {}", &issue.issue.description)));
        }

        Paragraph::new(lines)
            .wrap(Wrap { trim: false })
            .render(area, buf);
    }
}
