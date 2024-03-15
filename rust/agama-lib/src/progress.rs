//! This module offers a mechanism to report the installation progress in Agama's command-line
//! interface.
//!
//! The library does not prescribe any way to present that information to the user. As shown in the
//! example below, you can build your own presenter and implement the [ProgressPresenter] trait.
//!
//! ```no_run
//! # use agama_lib::progress::{Progress, ProgressMonitor, ProgressPresenter};
//! # use async_trait::async_trait;
//! # use tokio::{runtime::Handle, task};
//! # use zbus;
//!
//! // Custom presenter
//! struct SimplePresenter {}
//!
//! impl SimplePresenter {
//!   fn report_progress(&self, progress: &Progress) {
//!       println!("{}/{} {}", &progress.current_step, &progress.max_steps, &progress.current_title);
//!   }
//! }
//!
//! #[async_trait]
//! impl ProgressPresenter for SimplePresenter {
//!     async fn start(&mut self, progress: &Progress) {
//!        println!("Starting...");
//!        self.report_progress(progress);
//!     }
//!
//!     async fn update_main(&mut self, progress: &Progress) {
//!        self.report_progress(progress);
//!     }
//!
//!     async fn update_detail(&mut self, progress: &Progress) {
//!        self.report_progress(progress);
//!     }
//!
//!     async fn finish(&mut self) {
//!         println!("Done");
//!     }
//! }
//!
//! async fn run_monitor() {
//!   let connection = zbus::Connection::system().await.unwrap();
//!   let mut monitor = ProgressMonitor::new(connection).await.unwrap();
//!   monitor.run(SimplePresenter {}).await;
//!}
//! ```

use crate::{error::ServiceError, proxies::ProgressProxy};
use async_trait::async_trait;
use serde::Serialize;
use tokio_stream::{StreamExt, StreamMap};
use zbus::Connection;

/// Represents the progress for an Agama service.
#[derive(Clone, Default, Debug, Serialize)]
pub struct Progress {
    /// Current step
    pub current_step: u32,
    /// Number of steps
    pub max_steps: u32,
    /// Title of the current step
    pub current_title: String,
    /// Whether the progress reporting is finished
    pub finished: bool,
}

impl Progress {
    pub async fn from_proxy(proxy: &crate::proxies::ProgressProxy<'_>) -> zbus::Result<Progress> {
        let (current_step, max_steps, finished) =
            tokio::join!(proxy.current_step(), proxy.total_steps(), proxy.finished());

        let (current_step, current_title) = current_step?;
        Ok(Self {
            current_step,
            current_title,
            max_steps: max_steps?,
            finished: finished?,
        })
    }

    pub fn from_cached_proxy(proxy: &crate::proxies::ProgressProxy<'_>) -> Option<Progress> {
        let (current_step, current_title) = proxy.cached_current_step().ok()??;
        let max_steps = proxy.cached_total_steps().ok()??;
        let finished = proxy.cached_finished().ok()??;

        Some(Progress {
            current_step,
            current_title,
            max_steps,
            finished,
        })
    }
}

/// Monitorizes and reports the progress of Agama's current operation.
///
/// It implements a main/details reporter by listening to the manager and software services,
/// similar to Agama's web UI. How this information is displayed depends on the presenter (see
/// [ProgressMonitor.run]).
pub struct ProgressMonitor<'a> {
    manager_proxy: ProgressProxy<'a>,
    software_proxy: ProgressProxy<'a>,
}

impl<'a> ProgressMonitor<'a> {
    pub async fn new(connection: Connection) -> Result<ProgressMonitor<'a>, ServiceError> {
        let manager_proxy = ProgressProxy::builder(&connection)
            .path("/org/opensuse/Agama/Manager1")?
            .destination("org.opensuse.Agama.Manager1")?
            .build()
            .await?;

        let software_proxy = ProgressProxy::builder(&connection)
            .path("/org/opensuse/Agama/Software1")?
            .destination("org.opensuse.Agama.Software1")?
            .build()
            .await?;

        Ok(Self {
            manager_proxy,
            software_proxy,
        })
    }

    /// Runs the monitor until the current operation finishes.
    pub async fn run(&mut self, mut presenter: impl ProgressPresenter) -> Result<(), ServiceError> {
        presenter.start(&self.main_progress().await?).await;
        let mut changes = self.build_stream().await;

        while let Some(stream) = changes.next().await {
            match stream {
                ("/org/opensuse/Agama/Manager1", _) => {
                    let progress = self.main_progress().await?;
                    if progress.finished {
                        presenter.finish().await;
                        return Ok(());
                    }
                    presenter.update_main(&progress).await;
                }
                ("/org/opensuse/Agama/Software1", _) => {
                    let progress = &self.detail_progress().await?;
                    presenter.update_detail(progress).await;
                }
                _ => eprintln!("Unknown"),
            };
        }

        Ok(())
    }

    /// Proxy that reports the progress.
    async fn main_progress(&self) -> Result<Progress, ServiceError> {
        Ok(Progress::from_proxy(&self.manager_proxy).await?)
    }

    /// Proxy that reports the progress detail.
    async fn detail_progress(&self) -> Result<Progress, ServiceError> {
        Ok(Progress::from_proxy(&self.software_proxy).await?)
    }

    /// Builds an stream of progress changes.
    ///
    /// It listens for changes in the `Current` property and generates a stream identifying the
    /// proxy where the change comes from.
    async fn build_stream(&self) -> StreamMap<&str, zbus::PropertyStream<'_, (u32, String)>> {
        let mut streams = StreamMap::new();

        let proxies = [&self.manager_proxy, &self.software_proxy];
        for proxy in proxies.iter() {
            let stream = proxy.receive_current_step_changed().await;
            let path = proxy.path().as_str();
            streams.insert(path, stream);
        }
        streams
    }
}

/// Presents the progress to the user.
#[async_trait]
pub trait ProgressPresenter {
    /// Starts the progress reporting.
    ///
    /// * `progress`: current main progress.
    async fn start(&mut self, progress: &Progress);

    /// Updates the progress.
    ///
    /// * `progress`: current progress.
    async fn update_main(&mut self, progress: &Progress);

    /// Updates the progress detail.
    ///
    /// * `progress`: current progress detail.
    async fn update_detail(&mut self, progress: &Progress);

    /// Finishes the progress reporting.
    async fn finish(&mut self);
}
