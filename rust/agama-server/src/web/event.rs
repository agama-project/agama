use agama_lib::{progress::Progress, software::SelectedBy};
use serde::Serialize;
use std::collections::HashMap;
use tokio::sync::broadcast::{Receiver, Sender};

#[derive(Clone, Serialize)]
#[serde(tag = "type")]
pub enum Event {
    LocaleChanged { locale: String },
    Progress(Progress),
    ProductChanged { id: String },
    PatternsChanged(HashMap<String, SelectedBy>),
}

pub type EventsSender = Sender<Event>;
pub type EventsReceiver = Receiver<Event>;
