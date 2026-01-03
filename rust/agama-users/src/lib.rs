pub mod service;
pub use service::{Service, Starter};

pub mod message;

mod config;

mod model;
pub use model::{Model, ModelAdapter};

#[cfg(test)]
mod tests {
    use super::*;
}
