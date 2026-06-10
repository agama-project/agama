use agama_utils::api::question::{Answer, Question, QuestionField};
use crossterm::event::{Event, KeyCode, KeyEventKind};
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Paragraph, Widget},
};

#[derive(PartialEq)]
pub enum AppMode {
    FieldInput,
    ActionSelection,
}

pub struct QuestionUiState {
    pub app_mode: AppMode,
    pub input_text: String,
    pub field_selection_idx: usize,
    pub action_selection_idx: usize,
    pub scroll: u16,
    pub error_expanded: bool,
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
            error_expanded: false,
            question_id: None,
        }
    }
}

impl QuestionUiState {
    pub fn reset(&mut self, question: &Question) {
        let is_load_retry = question.spec.class == "load.retry";

        self.app_mode = AppMode::FieldInput;
        self.input_text.clear();
        self.field_selection_idx = 0;
        self.action_selection_idx = 0;
        self.scroll = 0;
        self.error_expanded = false;
        self.question_id = Some(question.id);

        if is_load_retry {
            if let Some(orig) = question.spec.data.get("originalValue") {
                self.input_text = orig.clone();
            }
        } else {
            if question.spec.field == QuestionField::None {
                self.app_mode = AppMode::ActionSelection;
            }
        }
    }

    pub fn handle_event(&mut self, event: Event, question: &Question) -> Option<Answer> {
        let is_load_retry = question.spec.class == "load.retry";

        if let Event::Key(key) = event {
            if key.kind == KeyEventKind::Press {
                if key.code == KeyCode::PageUp {
                    self.scroll = self.scroll.saturating_sub(1);
                    return None;
                } else if key.code == KeyCode::PageDown {
                    self.scroll = self.scroll.saturating_add(1);
                    return None;
                } else if key.code == KeyCode::Char('e') {
                    if question.spec.data.get("error").is_some() {
                        self.error_expanded = !self.error_expanded;
                    }
                    return None;
                }

                match self.app_mode {
                    AppMode::FieldInput => {
                        if is_load_retry {
                            match key.code {
                                KeyCode::Char(c) => self.input_text.push(c),
                                KeyCode::Backspace => {
                                    self.input_text.pop();
                                }
                                KeyCode::Enter | KeyCode::Tab | KeyCode::Down => {
                                    self.app_mode = AppMode::ActionSelection;
                                }
                                _ => {}
                            }
                        } else {
                            match &question.spec.field {
                                QuestionField::String | QuestionField::Password => match key.code {
                                    KeyCode::Char(c) => self.input_text.push(c),
                                    KeyCode::Backspace => {
                                        self.input_text.pop();
                                    }
                                    KeyCode::Enter | KeyCode::Tab | KeyCode::Down => {
                                        self.app_mode = AppMode::ActionSelection;
                                    }
                                    _ => {}
                                },
                                QuestionField::Select { options } => match key.code {
                                    KeyCode::Up => {
                                        if self.field_selection_idx > 0 {
                                            self.field_selection_idx -= 1;
                                        }
                                    }
                                    KeyCode::Down => {
                                        if self.field_selection_idx + 1 < options.len() {
                                            self.field_selection_idx += 1;
                                        }
                                    }
                                    KeyCode::Enter | KeyCode::Tab | KeyCode::Right => {
                                        self.app_mode = AppMode::ActionSelection;
                                    }
                                    _ => {}
                                },
                                _ => {}
                            }
                        }
                    }
                    AppMode::ActionSelection => match key.code {
                        KeyCode::Up => {
                            if self.action_selection_idx > 0 {
                                self.action_selection_idx -= 1;
                            } else if is_load_retry
                                || !matches!(question.spec.field, QuestionField::None)
                            {
                                self.app_mode = AppMode::FieldInput;
                            }
                        }
                        KeyCode::Down => {
                            if self.action_selection_idx + 1 < question.spec.actions.len() {
                                self.action_selection_idx += 1;
                            }
                        }
                        KeyCode::Enter => {
                            if question.spec.actions.is_empty() {
                                return None;
                            }
                            let selected_action = &question.spec.actions[self.action_selection_idx];
                            let mut answer = Answer::new(&selected_action.id);

                            if is_load_retry {
                                if !self.input_text.is_empty() {
                                    answer = answer.with_value(&self.input_text);
                                }
                            } else {
                                match &question.spec.field {
                                    QuestionField::String | QuestionField::Password => {
                                        if !self.input_text.is_empty() {
                                            answer = answer.with_value(&self.input_text);
                                        }
                                    }
                                    _ => {}
                                }
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
        let is_load_retry = question.spec.class == "load.retry";

        let mut lines_top = vec![
            Line::from(Span::styled(
                &question.spec.text,
                Style::default().add_modifier(Modifier::BOLD),
            )),
            Line::from(""),
        ];

        let mut lines_error = vec![];
        if is_load_retry {
            if let Some(err) = question.spec.data.get("error") {
                let toggle_hint = if self.state.error_expanded {
                    " (press 'e' to collapse, PageUp/PageDown to scroll)"
                } else {
                    " (press 'e' to expand details)"
                };

                lines_top.push(Line::from(vec![
                    Span::styled("Error: ", Style::default().add_modifier(Modifier::ITALIC)),
                    Span::styled(toggle_hint, Style::default().add_modifier(Modifier::DIM)),
                ]));

                if self.state.error_expanded {
                    for err_line in err.lines() {
                        lines_error.push(Line::from(Span::styled(
                            format!("     {}", err_line),
                            Style::default().add_modifier(Modifier::ITALIC),
                        )));
                    }
                }
            }
        }

        let is_field_active = self.state.app_mode == AppMode::FieldInput;
        let is_action_active = self.state.app_mode == AppMode::ActionSelection;
        let mut lines_bottom = vec![];

        if is_load_retry {
            if question.spec.data.get("error").is_some() {
                lines_bottom.push(Line::from(""));
            }
            let prefix = if is_field_active { "> " } else { "  " };
            lines_bottom.push(Line::from(vec![
                Span::styled(prefix, Style::default().add_modifier(Modifier::BOLD)),
                Span::from(format!("Location: {}", self.state.input_text)),
            ]));
            lines_bottom.push(Line::from(""));
        } else {
            match &question.spec.field {
                QuestionField::None => {}
                QuestionField::String | QuestionField::Password => {
                    let prefix = if is_field_active { "> " } else { "  " };
                    let display_text = if matches!(question.spec.field, QuestionField::Password) {
                        "*".repeat(self.state.input_text.len())
                    } else {
                        self.state.input_text.clone()
                    };
                    lines_bottom.push(Line::from(vec![
                        Span::styled(prefix, Style::default().add_modifier(Modifier::BOLD)),
                        Span::from(display_text),
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

        let content_area = Rect {
            x: area.x + 2, // Indent a bit matching other monitor content
            y: area.y,
            width: area.width.saturating_sub(4),
            height: area.height,
        };

        // Determine how many lines of error we can show based on the available space
        let total_top_lines = lines_top.len() as u16;
        let total_bottom_lines = lines_bottom.len() as u16;
        let used_lines = total_top_lines + total_bottom_lines;
        let available_error_lines = content_area.height.saturating_sub(used_lines);

        let mut lines = lines_top;
        if self.state.error_expanded && available_error_lines > 0 {
            let error_len = lines_error.len();
            let start = self.state.scroll as usize;
            let end = (start + available_error_lines as usize).min(error_len);

            if start < error_len {
                lines.extend(lines_error[start..end].iter().cloned());
            }
        }
        lines.extend(lines_bottom);

        Paragraph::new(lines)
            .wrap(ratatui::widgets::Wrap { trim: true })
            .render(content_area, buf);
    }
}
