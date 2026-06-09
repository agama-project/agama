use agama_lib::questions::http_client::HTTPClient;
use agama_utils::api::question::{Answer, QuestionField};
use anyhow::Result;
use inquire::{Select, Text, Password};
use tokio::time::{sleep, Duration};

pub async fn run_interactive(client: HTTPClient) -> Result<()> {
    loop {
        let questions = client.get_questions().await?;
        let mut pending = questions.into_iter().filter(|q| q.answer.is_none()).peekable();

        if pending.peek().is_none() {
            println!("No pending questions.");
            break;
        }

        for question in pending {
            println!("\n--- Question: {} ---", question.spec.text);

            let mut answer_val = None;
            let is_load_retry = question.spec.class == "load.retry";

            if is_load_retry {
                if let Some(err) = question.spec.data.get("error") {
                    println!("Error: {}", err);
                }

                let mut text_prompt = Text::new("Enter URL (optional):");
                if let Some(orig) = question.spec.data.get("originalValue") {
                    text_prompt = text_prompt.with_initial_value(orig);
                }
                let input = text_prompt.prompt()?;
                if !input.trim().is_empty() {
                    answer_val = Some(input.trim().to_string());
                }
            } else {
                match &question.spec.field {
                    QuestionField::None => {}
                    QuestionField::String => {
                        let input = Text::new("Enter value (optional):").prompt()?;
                        if !input.trim().is_empty() {
                            answer_val = Some(input.trim().to_string());
                        }
                    }
                    QuestionField::Password => {
                        let input = Password::new("Enter password (optional):").prompt()?;
                        if !input.is_empty() {
                            answer_val = Some(input);
                        }
                    }
                    QuestionField::Select { options } => {
                        let labels: Vec<String> = options.iter().map(|o| o.label.clone()).collect();
                        let selection = Select::new("Select an option:", labels).prompt()?;
                        if let Some(opt) = options.iter().find(|o| o.label == selection) {
                            answer_val = Some(opt.id.clone());
                        }
                    }
                }
            }

            let actions_labels: Vec<String> = question.spec.actions.iter().map(|a| a.label.clone()).collect();
            if actions_labels.is_empty() {
                println!("No actions available for this question.");
                continue;
            }
            let action_selection = Select::new("Select an action:", actions_labels).prompt()?;
            let action_id = question.spec.actions.iter().find(|a| a.label == action_selection).unwrap().id.clone();

            let mut answer = Answer::new(&action_id);
            if let Some(val) = answer_val {
                answer = answer.with_value(&val);
            }

            client.answer_question(question.id, answer).await?;
            println!("Answer submitted for question {}.", question.id);
        }

        // Just break after processing the current batch to match CLI tool behavior
        // Or if we want to poll, we can sleep(Duration::from_secs(1)).await;
        // Let's just process pending and break.
        break;
    }

    Ok(())
}
