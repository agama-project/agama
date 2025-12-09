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

use agama_utils::api::network::NetworkConnection;
use ratatui::{
    buffer::Buffer,
    crossterm::event::{KeyCode, KeyEventKind},
    layout::{Constraint, Layout, Rect},
    style::{Color, Modifier, Style, Stylize},
    text::{Line, Span, Text},
    widgets::{Block, List, ListState, Paragraph, StatefulWidget, Widget, Wrap},
};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

use crate::{api::ApiState, message::Message, ui::Command};

#[derive(Clone)]
pub struct NetworkPageState {
    list: ListState,
    connections: Vec<NetworkConnection>,
}

impl NetworkPageState {
    pub fn from_api(api_state: &ApiState) -> Self {
        let connections = api_state.system_info.network.connections.0.clone();

        Self {
            connections,
            list: ListState::default().with_selected(Some(0)),
        }
    }

    pub fn update_from_api(&mut self, api_state: &ApiState) {
        self.connections = api_state.system_info.network.connections.0.clone();
    }

    pub fn selected_connection(&self) -> Option<&NetworkConnection> {
        if let Some(selected) = self.list.selected() {
            return self.connections.get(selected);
        }
        None
    }

    pub fn update(&mut self, message: Message, _messages_tx: mpsc::Sender<Message>) {
        let Message::Key(event) = message else {
            return;
        };

        if event.kind != KeyEventKind::Press {
            return;
        }

        match event.code {
            KeyCode::Down | KeyCode::Char('j') => {
                self.list.select_next();
            }
            KeyCode::Up | KeyCode::Char('k') => {
                self.list.select_previous();
            }
            _ => {}
        }
    }

    fn commands(&mut self) -> Vec<super::Command> {
        vec![
            Command::new("Previous", "Up/k"),
            Command::new("Next", "Down/j"),
            Command::new("Select", "ENTER"),
        ]
    }
}

pub struct NetworkPage;

const SELECTED_STYLE: Style = Style::new().add_modifier(Modifier::BOLD);

fn details_for(connection: &NetworkConnection) -> Paragraph<'static> {
    let mut lines = vec![
        connection_title(connection),
        persistent(connection),
        protocol(connection),
    ];
    if let Some(protocol) = &connection.method4 {
        if protocol != "auto" {
            lines.push(addresses(connection));
            lines.push(nameservers(connection));
        }
    }

    if connection.gateway4.is_some() {
        lines.push(gateway(connection));
    }

    Paragraph::new(Text::from(lines))
        .wrap(Wrap::default())
        .block(Block::bordered())
}

fn connection_title(connection: &NetworkConnection) -> Line<'static> {
    field("Name".to_string(), connection.id.clone())
}

fn persistent(connection: &NetworkConnection) -> Line<'static> {
    let persistent = if connection.persistent.unwrap_or(false) {
        "True"
    } else {
        "False"
    }
    .to_string();

    field("Persistent".to_string(), persistent)
}

fn addresses(connection: &NetworkConnection) -> Line<'static> {
    let addresses: Vec<String> = connection.addresses.iter().map(|a| a.to_string()).collect();

    field("Addresses".to_string(), addresses.join(", "))
}

fn nameservers(connection: &NetworkConnection) -> Line<'static> {
    let nameservers: Vec<String> = connection
        .nameservers
        .iter()
        .map(|a| a.to_string())
        .collect();

    field("Nameservers".to_string(), nameservers.join(", "))
}

fn gateway(connection: &NetworkConnection) -> Line<'static> {
    let mut value = "none".to_string();
    if let Some(gateway) = &connection.gateway4 {
        value = gateway.to_string()
    }
    field("Gateway".to_string(), value)
}

fn protocol(connection: &NetworkConnection) -> Line<'static> {
    let mut value = "none".to_string();

    if let Some(protocol) = &connection.method4 {
        value = protocol.to_string()
    }

    field("Protocol".to_string(), value)
}

fn field(name: String, value: String) -> Line<'static> {
    Line::from(vec![
        Span::styled(
            format!("{}:", name),
            Style::default().fg(Color::Green).bold(),
        ),
        Span::raw(format!(" {}", value)),
    ])
}

impl StatefulWidget for NetworkPage {
    type State = NetworkPageState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        let layout = Layout::vertical([Constraint::Percentage(30), Constraint::Percentage(70)]);
        let [connections_area, selected_area] = layout.areas(area);

        let names: Vec<_> = state
            .connections
            .iter()
            .map(|p| Line::from(p.id.as_str()))
            .collect();

        let list = List::new(names)
            .highlight_style(SELECTED_STYLE)
            .highlight_symbol(">> ")
            .block(
                Block::bordered()
                    .title("Connection details")
                    .title_bottom("Press Up/Down or j/k move to show the connection details"),
            );

        StatefulWidget::render(list, connections_area, buf, &mut state.list);

        if let Some(selected) = state.list.selected() {
            if let Some(connection) = state.connections.get(selected) {
                details_for(connection).render(selected_area, buf);
            }
        }
    }
}
