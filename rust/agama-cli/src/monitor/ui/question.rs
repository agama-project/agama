use agama_utils::api::question::{Answer, Question, QuestionField};
use crossterm::event::{Event, KeyCode, KeyEventKind};
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
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
    pub title_scroll: u16,
    pub question_id: Option<u32>,
}

impl Default for QuestionUiState {
    fn default() -> Self {
        Self {
            app_mode: AppMode::FieldInput,
            input_text: String::new(),
            field_selection_idx: 0,
            action_selection_idx: 0,
            title_scroll: 0,
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
        self.title_scroll = 0;
        self.question_id = Some(question.id);

        if is_load_retry {
            if let Some(orig) = question.spec.data.get("originalValue") {
                self.input_text = orig.clone();
            }
        } else {
            match &question.spec.field {
                QuestionField::None => {
                    self.app_mode = AppMode::ActionSelection;
                }
                _ => {}
            }
        }
    }

    pub fn handle_event(&mut self, event: Event, question: &Question) -> Option<Answer> {
        let is_load_retry = question.spec.class == "load.retry";

        if let Event::Key(key) = event {
            if key.kind == KeyEventKind::Press {
                if key.code == KeyCode::PageUp {
                    self.title_scroll = self.title_scroll.saturating_sub(1);
                    return None;
                } else if key.code == KeyCode::PageDown {
                    self.title_scroll = self.title_scroll.saturating_add(1);
                    return None;
                }

                match self.app_mode {
                    AppMode::FieldInput => {
                        if is_load_retry {
                            match key.code {
                                KeyCode::Char(c) => self.input_text.push(c),
                                KeyCode::Backspace => { self.input_text.pop(); },
                                KeyCode::Enter | KeyCode::Tab | KeyCode::Down => {
                                    self.app_mode = AppMode::ActionSelection;
                                }
                                _ => {}
                            }
                        } else {
                            match &question.spec.field {
                                QuestionField::String | QuestionField::Password => {
                                    match key.code {
                                        KeyCode::Char(c) => self.input_text.push(c),
                                        KeyCode::Backspace => { self.input_text.pop(); },
                                        KeyCode::Enter | KeyCode::Tab | KeyCode::Down => {
                                            self.app_mode = AppMode::ActionSelection;
                                        }
                                        _ => {}
                                    }
                                }
                                QuestionField::Select { options } => {
                                    match key.code {
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
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                    AppMode::ActionSelection => {
                        match key.code {
                            KeyCode::Up => {
                                if self.action_selection_idx > 0 {
                                    self.action_selection_idx -= 1;
                                } else if is_load_retry || !matches!(question.spec.field, QuestionField::None) {
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
                        }
                    }
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

        let mut lines = vec![
            Line::from(Span::styled(
                format!("Action needed: {}", question.spec.text),
                Style::default().add_modifier(Modifier::BOLD)
            )),
            Line::from(""),
        ];

        if is_load_retry {
            if let Some(err) = question.spec.data.get("error") {
                lines.push(Line::from(Span::styled("  Error:", Style::default().fg(Color::Red))));
                    for err_line in err.lines() {
                        lines.push(Line::from(Span::styled(format!("    {}", err_line), Style::default().fg(Color::Red))));
                    }
                
                lines.push(Line::from(""));
            }
        }

        let is_field_active = self.state.app_mode == AppMode::FieldInput;
        let is_action_active = self.state.app_mode == AppMode::ActionSelection;

        if is_load_retry {
            let prefix = if is_field_active { "> " } else { "  " };
            lines.push(Line::from(vec![
                Span::styled(prefix, Style::default().fg(if is_field_active { Color::Yellow } else { Color::Reset })),
                Span::from(format!("URL: {}", self.state.input_text)),
            ]));
            lines.push(Line::from(""));
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
                    lines.push(Line::from(vec![
                        Span::styled(prefix, Style::default().fg(if is_field_active { Color::Yellow } else { Color::Reset })),
                        Span::from(display_text),
                    ]));
                    lines.push(Line::from(""));
                }
                QuestionField::Select { options } => {
                    for (i, opt) in options.iter().enumerate() {
                        let prefix = if i == self.state.field_selection_idx && is_field_active {
                            "> "
                        } else {
                            "  "
                        };
                        lines.push(Line::from(vec![
                            Span::styled(prefix, Style::default().fg(if is_field_active && i == self.state.field_selection_idx { Color::Yellow } else { Color::Reset })),
                            Span::from(opt.label.clone()),
                        ]));
                    }
                    lines.push(Line::from(""));
                }
            }
        }

        for (i, act) in question.spec.actions.iter().enumerate() {
            let prefix = if i == self.state.action_selection_idx && is_action_active {
                "> "
            } else {
                "  "
            };
            lines.push(Line::from(vec![
                Span::styled(prefix, Style::default().fg(if is_action_active && i == self.state.action_selection_idx { Color::Yellow } else { Color::Reset })),
                Span::from(format!("[ {} ]", act.label)),
            ]));
        }

        let content_area = Rect {
            x: area.x + 2, // Indent a bit matching other monitor content
            y: area.y,
            width: area.width.saturating_sub(4),
            height: area.height,
        };

        Paragraph::new(lines)
            .wrap(ratatui::widgets::Wrap { trim: true })
            .render(content_area, buf);
    }
}
