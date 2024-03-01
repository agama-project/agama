use agama_lib::progress::Progress;
use serde::Serialize;
use tokio::sync::broadcast::{Receiver, Sender};

#[derive(Clone, Serialize)]
#[serde(tag = "type")]
pub enum Event {
    LocaleChanged { locale: String },
    Progress(Progress),
    ProductChanged { id: String },
    PatternsChanged,
}

pub type EventsSender = Sender<Event>;
pub type EventsReceiver = Receiver<Event>;
