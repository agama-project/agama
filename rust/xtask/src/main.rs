use std::env;

mod tasks {
    use agama_cli::Cli;
    use clap_markdown::MarkdownOptions;

    pub fn generate_markdown() {
        let options = MarkdownOptions::new()
            .title("Command-line reference".to_string())
            .show_footer(false);
        let markdown = clap_markdown::help_markdown_custom::<Cli>(&options);
        print!("{}", markdown);
    }
}

fn main() {
    let Some(task) = env::args().nth(1) else {
        panic!("You must specify a task");
    };

    match task.as_str() {
        "markdown" => tasks::generate_markdown(),
        _ => eprintln!("Unknown task"),
    }
}
