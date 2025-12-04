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
    crossterm::event::{KeyCode, KeyEventKind},
    layout::{Constraint, Layout},
    prelude::{Buffer, Rect},
    style::{Modifier, Style},
    text::Line,
    widgets::{Block, List, ListItem, ListState, StatefulWidget, Widget},
};
use serde_json::Value;
use tokio::sync::mpsc;

use crate::{api::ApiState, message::Message};

#[derive(Debug)]
struct Device {
    sid: i64,
    name: String,
    description: String,
    selected: bool,
}

struct Action {
    text: String,
    delete: bool,
}

pub struct StoragePageState {
    candidate_devices: Vec<Device>,
    candidates_list: ListState,
    actions: Vec<Action>,
}

impl StoragePageState {
    pub fn from_api(api_state: &ApiState) -> Self {
        let candidate_devices = Self::candidate_devices_from_api(api_state).unwrap_or_default();
        let actions = Self::actions_from_api(api_state).unwrap_or_default();
        Self {
            candidate_devices,
            candidates_list: ListState::default().with_selected(Some(0)),
            actions,
        }
    }

    pub fn update_from_api(&mut self, api_state: &ApiState) {
        self.candidate_devices =
            Self::candidate_devices_from_api(api_state).unwrap_or_else(|| vec![]);
    }

    pub fn update(&mut self, message: Message, messages_tx: mpsc::Sender<Message>) {
        let Message::Key(event) = message else {
            return;
        };

        if event.kind != KeyEventKind::Press {
            return;
        }

        match event.code {
            KeyCode::Enter => {
                if let Some(device) = self.selected_device() {
                    device.selected = !device.selected;
                    let names: Vec<_> = self
                        .candidate_devices
                        .iter()
                        .filter(|d| d.selected)
                        .map(|d| d.name.to_string())
                        .collect();
                    _ = messages_tx.send(Message::SetStorageDevices(names))
                }
            }
            KeyCode::Down | KeyCode::Char('j') => {
                self.candidates_list.select_next();
            }
            KeyCode::Up | KeyCode::Char('k') => {
                self.candidates_list.select_previous();
            }
            _ => {}
        }
    }

    fn selected_device(&mut self) -> Option<&mut Device> {
        if let Some(selected) = self.candidates_list.selected() {
            return self.candidate_devices.get_mut(selected);
        }
        None
    }

    fn candidate_devices_from_api(api_state: &ApiState) -> Option<Vec<Device>> {
        let Some(storage) = api_state.system_info.storage.as_ref() else {
            return None;
        };

        let ids = storage["candidateDrives"].as_array()?;
        let ids: Vec<_> = ids.iter().flat_map(|n| n.as_i64()).collect();

        let devices = storage["devices"].as_array()?;
        let devices: Vec<_> = devices
            .iter()
            .flat_map(|d| Self::device_from_json(d))
            .collect();

        let candidate_devices = devices
            .into_iter()
            .filter(|d| ids.contains(&d.sid))
            .collect();
        Some(candidate_devices)
    }

    fn device_from_json(json: &Value) -> Option<Device> {
        let sid = json["sid"].as_number()?;
        let name = json["name"].as_str()?;
        let description = json["description"].as_str().unwrap_or_default();
        Some(Device {
            sid: sid.as_i64()?,
            name: name.to_string(),
            description: description.to_string(),
            selected: false,
        })
    }

    fn actions_from_api(api_state: &ApiState) -> Option<Vec<Action>> {
        let Some(storage) = api_state.proposal.storage.as_ref() else {
            return None;
        };

        let actions = storage["actions"].as_array()?;
        let actions = actions
            .iter()
            .flat_map(|a| Self::action_from_json(a))
            .collect();
        Some(actions)
    }

    fn action_from_json(json: &Value) -> Option<Action> {
        let text = json["text"].as_str()?;
        let delete = json["delete"].as_bool()?;
        Some(Action {
            text: text.to_string(),
            delete,
        })
    }
}

pub struct StoragePage;

const SELECTED_STYLE: Style = Style::new().add_modifier(Modifier::BOLD);

impl StatefulWidget for StoragePage {
    type State = StoragePageState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        let layout = Layout::vertical([
            Constraint::Length((state.candidate_devices.len() + 2).try_into().unwrap()),
            Constraint::Percentage(75),
        ]);
        let [devices_area, actions_area] = layout.areas(area);

        let block = Block::bordered().title("Candidate devices");
        let list = List::new(&state.candidate_devices)
            .block(block)
            .highlight_style(SELECTED_STYLE);
        StatefulWidget::render(list, devices_area, buf, &mut state.candidates_list);

        let block = Block::bordered().title("Actions");
        let list = List::new(&state.actions)
            .block(block)
            .highlight_style(SELECTED_STYLE);
        StatefulWidget::render(list, actions_area, buf, &mut ListState::default())
    }
}

impl From<&Device> for ListItem<'_> {
    fn from(value: &Device) -> Self {
        let description = format!("{}, {}", &value.name, &value.description);
        let line = if value.selected {
            format!("✓ {}", description)
        } else {
            format!("☐ {}", description)
        };
        ListItem::new(line)
    }
}

impl From<&Action> for ListItem<'_> {
    fn from(value: &Action) -> Self {
        let line = if value.delete {
            Line::styled(value.text.to_string(), SELECTED_STYLE)
        } else {
            Line::from(value.text.to_string())
        };
        ListItem::new(line)
    }
}
