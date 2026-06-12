use agama_utils::api::question::{Answer, Question, QuestionField};
use crossterm::event::{Event, KeyCode, KeyEventKind};
use gettextrs::gettext;
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Paragraph, Widget},
};

#[derive(PartialEq)]
pub enum AppMode {
    DataViewer,
    FieldInput,
    ActionSelection,
}

pub struct QuestionUiState {
    pub app_mode: AppMode,
    pub input_text: String,
    pub field_selection_idx: usize,
    pub action_selection_idx: usize,
    pub scroll: u16,
    pub question_id: Option<u32>,
}

impl Default for QuestionUiState {
    fn default() -> Self {
        Self {
            app_mode: AppMode::FieldInput,
            input_text: String::new(),
            field_selection_idx: 0,
            action_selection_idx: 0,
            scroll: 0,
            question_id: None,
        }
    }
}

impl QuestionUiState {
    pub fn reset(&mut self, question: &Question) {
        self.input_text.clear();
        self.field_selection_idx = 0;
        self.action_selection_idx = 0;
        self.scroll = 0;
        self.question_id = Some(question.id);

        let has_field = question.spec.field != QuestionField::None;

        self.app_mode = if has_field {
            AppMode::FieldInput
        } else {
            AppMode::ActionSelection
        };

        if let Some(orig) = question.spec.data.get("originalValue") {
            self.input_text = orig.clone();
        }
    }

    fn set_first_idx(&mut self) {
        self.field_selection_idx = 0;
        self.action_selection_idx = 0;
    }

    fn set_last_idx(&mut self, question: &Question) {
        self.action_selection_idx = question.spec.actions.len().saturating_sub(1);

        if let QuestionField::Select { options } = &question.spec.field {
            self.field_selection_idx = options.len().saturating_sub(1);
        } else {
            self.field_selection_idx = 0;
        }
    }

    fn next_mode(&mut self, question: &Question) {
        let has_data = !question.spec.data.is_empty();
        let has_field = question.spec.field != QuestionField::None;
        let has_actions = !question.spec.actions.is_empty();

        match self.app_mode {
            AppMode::DataViewer => {
                if has_field {
                    self.app_mode = AppMode::FieldInput;
                } else if has_actions {
                    self.app_mode = AppMode::ActionSelection;
                }
            }
            AppMode::FieldInput => {
                if has_actions {
                    self.app_mode = AppMode::ActionSelection;
                } else if has_data {
                    self.app_mode = AppMode::DataViewer;
                }
            }
            AppMode::ActionSelection => {
                if has_data {
                    self.app_mode = AppMode::DataViewer;
                } else if has_field {
                    self.app_mode = AppMode::FieldInput;
                }
            }
        }
        self.set_first_idx();
    }

    fn prev_mode(&mut self, question: &Question) {
        let has_data = !question.spec.data.is_empty();
        let has_field = question.spec.field != QuestionField::None;
        let has_actions = !question.spec.actions.is_empty();

        match self.app_mode {
            AppMode::DataViewer => {
                if has_actions {
                    self.app_mode = AppMode::ActionSelection;
                } else if has_field {
                    self.app_mode = AppMode::FieldInput;
                }
            }
            AppMode::FieldInput => {
                if has_data {
                    self.app_mode = AppMode::DataViewer;
                } else if has_actions {
                    self.app_mode = AppMode::ActionSelection;
                }
            }
            AppMode::ActionSelection => {
                if has_field {
                    self.app_mode = AppMode::FieldInput;
                } else if has_data {
                    self.app_mode = AppMode::DataViewer;
                }
            }
        }
        self.set_last_idx(question);
    }

    fn focus_next(&mut self, question: &Question) {
        match self.app_mode {
            AppMode::DataViewer => self.next_mode(question),
            AppMode::FieldInput => {
                if let QuestionField::Select { options } = &question.spec.field {
                    if self.field_selection_idx + 1 < options.len() {
                        self.field_selection_idx += 1;
                        return;
                    }
                }
                self.next_mode(question);
            }
            AppMode::ActionSelection => {
                if self.action_selection_idx + 1 < question.spec.actions.len() {
                    self.action_selection_idx += 1;
                } else {
                    self.next_mode(question);
                }
            }
        }
    }

    fn focus_prev(&mut self, question: &Question) {
        match self.app_mode {
            AppMode::DataViewer => self.prev_mode(question),
            AppMode::FieldInput => {
                if let QuestionField::Select { .. } = &question.spec.field {
                    if self.field_selection_idx > 0 {
                        self.field_selection_idx -= 1;
                        return;
                    }
                }
                self.prev_mode(question);
            }
            AppMode::ActionSelection => {
                if self.action_selection_idx > 0 {
                    self.action_selection_idx -= 1;
                } else {
                    self.prev_mode(question);
                }
            }
        }
    }

    pub fn handle_event(&mut self, event: Event, question: &Question) -> Option<Answer> {
        if let Event::Key(key) = event {
            if key.kind == KeyEventKind::Press {
                if key.code == KeyCode::Tab {
                    self.focus_next(question);
                    return None;
                } else if key.code == KeyCode::BackTab {
                    self.focus_prev(question);
                    return None;
                }

                match self.app_mode {
                    AppMode::DataViewer => match key.code {
                        KeyCode::PageUp => {
                            self.scroll = self.scroll.saturating_sub(1);
                        }
                        KeyCode::PageDown => {
                            self.scroll = self.scroll.saturating_add(1);
                        }
                        KeyCode::Down => {
                            self.focus_next(question);
                        }
                        KeyCode::Up => {
                            self.focus_prev(question);
                        }
                        _ => {}
                    },
                    AppMode::FieldInput => match &question.spec.field {
                        QuestionField::String | QuestionField::Password => match key.code {
                            KeyCode::Char(c) => self.input_text.push(c),
                            KeyCode::Backspace => {
                                self.input_text.pop();
                            }
                            KeyCode::Enter | KeyCode::Down => {
                                self.focus_next(question);
                            }
                            KeyCode::Up => {
                                self.focus_prev(question);
                            }
                            _ => {}
                        },
                        QuestionField::Select { .. } => match key.code {
                            KeyCode::Up => {
                                self.focus_prev(question);
                            }
                            KeyCode::Down => {
                                self.focus_next(question);
                            }
                            KeyCode::Enter | KeyCode::Right => {
                                self.next_mode(question);
                            }
                            _ => {}
                        },
                        _ => {}
                    },
                    AppMode::ActionSelection => match key.code {
                        KeyCode::Up => {
                            self.focus_prev(question);
                        }
                        KeyCode::Down => {
                            self.focus_next(question);
                        }
                        KeyCode::Enter => {
                            if question.spec.actions.is_empty() {
                                return None;
                            }
                            let selected_action = &question.spec.actions[self.action_selection_idx];
                            let mut answer = Answer::new(&selected_action.id);

                            match &question.spec.field {
                                QuestionField::String | QuestionField::Password => {
                                    if !self.input_text.is_empty() {
                                        answer = answer.with_value(&self.input_text);
                                    }
                                }
                                QuestionField::Select { options } => {
                                    if let Some(opt) = options.get(self.field_selection_idx) {
                                        answer = answer.with_value(&opt.id);
                                    }
                                }
                                _ => {}
                            }

                            return Some(answer);
                        }
                        _ => {}
                    },
                }
            }
        }
        None
    }
}

pub struct QuestionWidget<'a> {
    state: &'a QuestionUiState,
    question: &'a Question,
}

impl<'a> QuestionWidget<'a> {
    pub fn new(state: &'a QuestionUiState, question: &'a Question) -> Self {
        Self { state, question }
    }
}

impl<'a> Widget for QuestionWidget<'a> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let question = self.question;

        let mut lines_top = vec![
            Line::from(vec![
                Span::raw("  "),
                Span::styled(
                    &question.spec.text,
                    Style::default().add_modifier(Modifier::BOLD),
                ),
            ]),
            Line::from(""),
        ];

        let mut text_data = vec![];
        let mut data_entries: Vec<(String, String)> = question
            .spec
            .data
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
        data_entries.sort_by(|a, b| a.0.cmp(&b.0));

        for (k, v) in data_entries {
            let padding = " ".repeat(k.len() + 2);
            for (i, line) in v.lines().enumerate() {
                let text = if i == 0 {
                    format!("{}: {}", k, line)
                } else {
                    format!("{}{}", padding, line)
                };
                text_data.push(text);
            }
        }

        if !text_data.is_empty() {
            let max_lines = 3;
            let data_len = text_data.len();
            let show_lines = max_lines.min(data_len);

            let max_scroll = data_len.saturating_sub(show_lines);
            let start = (self.state.scroll as usize).min(max_scroll);

            // TRANSLATORS: additional data that question passed to user beside main question message
            let data_label = gettext("Additional data");
            let header_text = if max_scroll > 0 {
                format!("{} ({}/{}):", data_label, start + 1, max_scroll + 1)
            } else {
                format!("{}:", data_label)
            };

            let mut hint_text = String::new();
            if self.state.app_mode == AppMode::DataViewer && max_scroll > 0 {
                // TRANSLATORS: CLI hint how to scroll through additional data
                hint_text = format!(" ({})", gettext("use PageUp/PageDown to scroll"));
            }

            let (header_style, prefix) = if self.state.app_mode == AppMode::DataViewer {
                (Style::default().add_modifier(Modifier::BOLD), "> ")
            } else {
                (Style::default().add_modifier(Modifier::BOLD), "  ")
            };

            lines_top.push(Line::from(vec![
                Span::styled(prefix, Style::default().add_modifier(Modifier::BOLD)),
                Span::styled(header_text, header_style),
                Span::styled(hint_text, Style::default()),
            ]));

            for (i, text) in text_data[start..start + show_lines].iter().enumerate() {
                let prefix = if i == 0 && start > 0 {
                    "↑ "
                } else if i == show_lines - 1 && start < max_scroll {
                    "↓ "
                } else {
                    "  "
                };

                lines_top.push(Line::from(vec![
                    Span::raw("  "),
                    Span::styled(prefix, Style::default().add_modifier(Modifier::BOLD)),
                    Span::styled(
                        text.clone(),
                        Style::default().add_modifier(Modifier::ITALIC),
                    ),
                ]));
            }
            lines_top.push(Line::from(""));
        }

        let is_field_active = self.state.app_mode == AppMode::FieldInput;
        let is_action_active = self.state.app_mode == AppMode::ActionSelection;
        let is_load_retry = question.spec.class == "load.retry";
        let mut lines_bottom = vec![];

        let cursor = if is_field_active {
            Span::styled("_", Style::default().add_modifier(Modifier::SLOW_BLINK))
        } else {
            Span::raw("")
        };

        match &question.spec.field {
            QuestionField::None => {}
            QuestionField::String | QuestionField::Password => {
                let prefix = if is_field_active { "> " } else { "  " };
                let (field_label, display_text) =
                    if matches!(question.spec.field, QuestionField::Password) {
                        // TRANSLATORS: Input field in CLI for password
                        (format!("{}: ", gettext("Password")), "*".repeat(self.state.input_text.len()))
                    } else if is_load_retry {
                        // TRANSLATORS: Input field in CLI for configuration location
                        (format!("{}: ", gettext("Location")), self.state.input_text.clone())
                    } else {
                        // TRANSLATORS: Input field in CLI for generic value needed in answer. It is context dependent
                        (format!("{}: ", gettext("Value")), self.state.input_text.clone())
                    };
                lines_bottom.push(Line::from(vec![
                    Span::styled(prefix, Style::default().add_modifier(Modifier::BOLD)),
                    Span::styled(field_label, Style::default().add_modifier(Modifier::BOLD)),
                    Span::from(display_text),
                    cursor.clone(),
                ]));
                lines_bottom.push(Line::from(""));
            }
            QuestionField::Select { options } => {
                for (i, opt) in options.iter().enumerate() {
                    let prefix = if i == self.state.field_selection_idx && is_field_active {
                        "> "
                    } else {
                        "  "
                    };
                    lines_bottom.push(Line::from(vec![
                        Span::styled(prefix, Style::default().add_modifier(Modifier::BOLD)),
                        Span::from(opt.label.clone()),
                    ]));
                }
                lines_bottom.push(Line::from(""));
            }
        }

        for (i, act) in question.spec.actions.iter().enumerate() {
            let prefix = if i == self.state.action_selection_idx && is_action_active {
                "> "
            } else {
                "  "
            };
            lines_bottom.push(Line::from(vec![
                Span::styled(prefix, Style::default().add_modifier(Modifier::BOLD)),
                Span::from(format!("[ {} ]", act.label)),
            ]));
        }

        let mut lines = lines_top;
        lines.extend(lines_bottom);

        let shifted_area = Rect {
            x: area.x.saturating_sub(2),
            y: area.y,
            width: area.width.saturating_add(2),
            height: area.height,
        };

        Paragraph::new(lines)
            .wrap(ratatui::widgets::Wrap { trim: false })
            .render(shifted_area, buf);
    }
}
