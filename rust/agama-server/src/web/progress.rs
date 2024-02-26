//! Implements a mechanism to monitor track service progress.

use super::event::{Event, EventsSender};
use agama_lib::progress::{Progress, ProgressPresenter};
use async_trait::async_trait;

// let presenter = EventsProgressPresenter::new(socket);
// let mut monitor = ProgressMonitor::new(connection).await.unwrap();
// _ = monitor.run(presenter).await;

/// Experimental ProgressPresenter to emit progress events over a Events.
pub struct EventsProgressPresenter(EventsSender);

impl EventsProgressPresenter {
    pub fn new(events: EventsSender) -> Self {
        Self(events)
    }

    pub async fn report_progress(&mut self, progress: &Progress) {
        _ = self.0.send(Event::Progress(progress.clone()))
        // _ = self.events.send(Message::Text(payload)).await;
    }
}

#[async_trait]
impl ProgressPresenter for EventsProgressPresenter {
    async fn start(&mut self, progress: &Progress) {
        self.report_progress(progress).await;
    }

    async fn update_main(&mut self, progress: &Progress) {
        self.report_progress(progress).await;
    }

    async fn update_detail(&mut self, progress: &Progress) {
        self.report_progress(progress).await;
    }

    async fn finish(&mut self) {}
}
