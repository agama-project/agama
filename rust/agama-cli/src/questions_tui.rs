use agama_lib::questions::http_client::HTTPClient;
use agama_utils::api::question::{Answer, Question, QuestionField, QuestionSpec};
use anyhow::Result;
use crossterm::{
    event::{self, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Widget},
    Terminal,
};
use std::io::{self, stdout};
use tokio::time::{sleep, Duration};

#[derive(PartialEq)]
enum AppMode {
    FieldInput,
    ActionSelection,
}

pub async fn run_tui(client: HTTPClient) -> Result<()> {
    enable_raw_mode()?;
    let mut stdout = stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let res = run_app(&mut terminal, client).await;

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    res
}

async fn run_app(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    client: HTTPClient,
) -> Result<()> {
    loop {
        // Fetch questions
        let questions = client.get_questions().await?;
        let pending: Vec<Question> = questions.into_iter().filter(|q| q.answer.is_none()).collect();

        if pending.is_empty() {
            terminal.draw(|f| {
                let size = f.area();
                let p = Paragraph::new("No pending questions. Press 'q' to exit.")
                    .block(Block::default().borders(Borders::ALL).title("Questions TUI"));
                f.render_widget(p, size);
            })?;

            if crossterm::event::poll(Duration::from_millis(500))? {
                if let Event::Key(key) = event::read()? {
                    if key.kind == KeyEventKind::Press && key.code == KeyCode::Char('q') {
                        break;
                    }
                }
            }
            continue;
        }

        // We process the first pending question
        let question = &pending[0];
        handle_question(terminal, &client, question).await?;
    }
    Ok(())
}

async fn handle_question(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    client: &HTTPClient,
    question: &Question,
) -> Result<()> {
    let mut app_mode = AppMode::FieldInput;
    let mut input_text = String::new();
    let mut field_selection_idx = 0;
    let mut action_selection_idx = 0;
    let mut title_scroll: u16 = 0;

    let is_load_retry = question.spec.class == "load.retry";

    // Determine initial state
    if is_load_retry {
        app_mode = AppMode::FieldInput;
        if let Some(orig) = question.spec.data.get("originalValue") {
            input_text = orig.clone();
        }
    } else {
        match &question.spec.field {
            QuestionField::None => {
                app_mode = AppMode::ActionSelection;
            }
            _ => {}
        }
    }

    loop {
        terminal.draw(|f| {
            let size = f.area();
            
            let actions_height = (question.spec.actions.len() as u16).max(1) + 2;
            let field_height = match &question.spec.field {
                QuestionField::Select { options } => (options.len() as u16).max(1) + 2,
                _ => 3,
            };
            
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .margin(2)
                .constraints([
                    Constraint::Min(3), // Title gets remaining space
                    Constraint::Length(if is_load_retry { 3 } else { field_height }),    // Field
                    Constraint::Length(actions_height),    // Actions
                ])
                .split(size);

            let title_lines = if is_load_retry {
                let mut lines = vec![Line::from(Span::styled(question.spec.text.clone(), Style::default().add_modifier(Modifier::BOLD)))];
                if let Some(err) = question.spec.data.get("error") {
                    lines.push(Line::from(Span::styled("Error:", Style::default().fg(Color::Red))));
                    for err_line in err.lines() {
                        lines.push(Line::from(Span::styled(err_line.to_string(), Style::default().fg(Color::Red))));
                    }
                }
                lines
            } else {
                vec![Line::from(Span::styled(question.spec.text.clone(), Style::default().add_modifier(Modifier::BOLD)))]
            };

            let title = Paragraph::new(title_lines)
                .block(Block::default().borders(Borders::ALL).title("Question (PageUp/PageDown to scroll)"))
                .wrap(ratatui::widgets::Wrap { trim: true })
                .scroll((title_scroll, 0));
            f.render_widget(title, chunks[0]);

            let field_block = Block::default().borders(Borders::ALL).title("Field / Data");
            let is_field_active = app_mode == AppMode::FieldInput;
            let field_style = if is_field_active {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default().fg(Color::DarkGray)
            };

            if is_load_retry {
                let p = Paragraph::new(format!("URL: {}", input_text))
                    .block(field_block.style(field_style));
                f.render_widget(p, chunks[1]);
            } else {
                match &question.spec.field {
                    QuestionField::None => {
                        let p = Paragraph::new("No additional data needed.")
                            .block(field_block.style(field_style));
                        f.render_widget(p, chunks[1]);
                    }
                    QuestionField::String | QuestionField::Password => {
                        let display_text = if matches!(question.spec.field, QuestionField::Password) {
                            "*".repeat(input_text.len())
                        } else {
                            input_text.clone()
                        };
                        let p = Paragraph::new(display_text)
                            .block(field_block.style(field_style));
                        f.render_widget(p, chunks[1]);
                    }
                    QuestionField::Select { options } => {
                        let items: Vec<ListItem> = options
                            .iter()
                            .enumerate()
                            .map(|(i, opt)| {
                                let prefix = if i == field_selection_idx { ">> " } else { "   " };
                                ListItem::new(format!("{}{}", prefix, opt.label))
                            })
                            .collect();
                        let list = List::new(items).block(field_block.style(field_style));
                        f.render_widget(list, chunks[1]);
                    }
                }
            }

            let action_block = Block::default().borders(Borders::ALL).title("Actions (Press Enter to submit)");
            let is_action_active = app_mode == AppMode::ActionSelection;
            let action_style = if is_action_active {
                Style::default().fg(Color::Yellow)
            } else {
                Style::default().fg(Color::DarkGray)
            };

            let actions_items: Vec<ListItem> = question
                .spec
                .actions
                .iter()
                .enumerate()
                .map(|(i, act)| {
                    let prefix = if i == action_selection_idx { ">> " } else { "   " };
                    ListItem::new(format!("{}{}", prefix, act.label))
                })
                .collect();
            let action_list = List::new(actions_items).block(action_block.style(action_style));
            f.render_widget(action_list, chunks[2]);
        })?;

        if let Event::Key(key) = event::read()? {
            if key.kind == KeyEventKind::Press {
                if key.code == KeyCode::PageUp {
                    title_scroll = title_scroll.saturating_sub(1);
                    continue;
                } else if key.code == KeyCode::PageDown {
                    title_scroll = title_scroll.saturating_add(1);
                    continue;
                }

                match app_mode {
                    AppMode::FieldInput => {
                        if is_load_retry {
                            match key.code {
                                KeyCode::Char(c) => input_text.push(c),
                                KeyCode::Backspace => { input_text.pop(); },
                                KeyCode::Enter | KeyCode::Tab | KeyCode::Down => {
                                    app_mode = AppMode::ActionSelection;
                                }
                                KeyCode::Esc => return Err(anyhow::anyhow!("Cancelled by user")),
                                _ => {}
                            }
                        } else {
                            match &question.spec.field {
                                QuestionField::String | QuestionField::Password => {
                                    match key.code {
                                        KeyCode::Char(c) => input_text.push(c),
                                        KeyCode::Backspace => { input_text.pop(); },
                                        KeyCode::Enter | KeyCode::Tab | KeyCode::Down => {
                                            app_mode = AppMode::ActionSelection;
                                        }
                                        KeyCode::Esc => return Err(anyhow::anyhow!("Cancelled by user")),
                                        _ => {}
                                    }
                                }
                                QuestionField::Select { options } => {
                                    match key.code {
                                        KeyCode::Up => {
                                            if field_selection_idx > 0 {
                                                field_selection_idx -= 1;
                                            }
                                        }
                                        KeyCode::Down => {
                                            if field_selection_idx + 1 < options.len() {
                                                field_selection_idx += 1;
                                            }
                                        }
                                        KeyCode::Enter | KeyCode::Tab | KeyCode::Right => {
                                            app_mode = AppMode::ActionSelection;
                                        }
                                        KeyCode::Esc => return Err(anyhow::anyhow!("Cancelled by user")),
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
                                if action_selection_idx > 0 {
                                    action_selection_idx -= 1;
                                } else if is_load_retry || !matches!(question.spec.field, QuestionField::None) {
                                    app_mode = AppMode::FieldInput;
                                }
                            }
                            KeyCode::Down => {
                                if action_selection_idx + 1 < question.spec.actions.len() {
                                    action_selection_idx += 1;
                                }
                            }
                            KeyCode::Enter => {
                                // Submit!
                                if question.spec.actions.is_empty() {
                                    return Ok(());
                                }
                                let selected_action = &question.spec.actions[action_selection_idx];
                                let mut answer = Answer::new(&selected_action.id);

                                if is_load_retry {
                                    if !input_text.is_empty() {
                                        answer = answer.with_value(&input_text);
                                    }
                                } else {
                                    match &question.spec.field {
                                        QuestionField::String | QuestionField::Password => {
                                            if !input_text.is_empty() {
                                                answer = answer.with_value(&input_text);
                                            }
                                        }
                                        QuestionField::Select { options } => {
                                            if !options.is_empty() && field_selection_idx < options.len() {
                                                answer = answer.with_value(&options[field_selection_idx].id);
                                            }
                                        }
                                        _ => {}
                                    }
                                }

                                client.answer_question(question.id, answer).await?;
                                return Ok(());
                            }
                            KeyCode::Esc => {
                                return Err(anyhow::anyhow!("Cancelled by user"));
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }
}
