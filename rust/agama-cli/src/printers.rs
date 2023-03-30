use serde::Serialize;
use std::error;
use std::fmt::Debug;
use std::io::Write;

/// Prints the content using the given format
///
/// # Example
///
///```rust
/// use agama_lib::users;
/// use agama_cli::printers::{print, Format};
/// use std::io;
///
/// let user = users::User { login: "jane doe".to_string() };
/// print(user, io::stdout(), Some(Format::Json))
///   .expect("Something went wrong!")
/// ```
pub fn print<T, W>(content: T, writer: W, format: Format) -> Result<(), Box<dyn error::Error>>
where
    T: serde::Serialize + Debug,
    W: Write,
{
    let printer: Box<dyn Printer<T, W>> = match format {
        Format::Json => Box::new(JsonPrinter { content, writer }),
        Format::Yaml => Box::new(YamlPrinter { content, writer }),
        _ => Box::new(TextPrinter { content, writer }),
    };
    printer.print()
}

/// Supported output formats
#[derive(clap::ValueEnum, Clone)]
pub enum Format {
    Json,
    Yaml,
    Text,
}

pub trait Printer<T, W> {
    fn print(self: Box<Self>) -> Result<(), Box<dyn error::Error>>;
}

pub struct JsonPrinter<T, W> {
    content: T,
    writer: W,
}

impl<T: Serialize + Debug, W: Write> Printer<T, W> for JsonPrinter<T, W> {
    fn print(self: Box<Self>) -> Result<(), Box<dyn error::Error>> {
        Ok(serde_json::to_writer(self.writer, &self.content)?)
    }
}
pub struct TextPrinter<T, W> {
    content: T,
    writer: W,
}

impl<T: Serialize + Debug, W: Write> Printer<T, W> for TextPrinter<T, W> {
    fn print(mut self: Box<Self>) -> Result<(), Box<dyn error::Error>> {
        Ok(write!(self.writer, "{:?}", &self.content)?)
    }
}

pub struct YamlPrinter<T, W> {
    content: T,
    writer: W,
}

impl<T: Serialize + Debug, W: Write> Printer<T, W> for YamlPrinter<T, W> {
    fn print(self: Box<Self>) -> Result<(), Box<dyn error::Error>> {
        Ok(serde_yaml::to_writer(self.writer, &self.content)?)
    }
}
