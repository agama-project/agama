pub mod service;
pub use service::{Service, Starter};

pub mod message;

mod config;

#[cfg(test)]
mod tests {
    use super::*;
}
