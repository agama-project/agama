//! This module offers a mechanism to report the installation progress in Agama's command-line
//! interface.
//!
//! The library does not prescribe any way to present that information to the user. As shown in the
//! example below, you need to implement the [ProgressPresenter] for your own presenter.
//!
//! ```no_run
//! # use agama_lib::progress::{Progress, ProgressMonitorBuilder, ProgressPresenter};
//! # use async_std::task::block_on;
//! # use zbus;
//!
//! // Custom presenter
//! struct SimplePresenter {};
//!
//! impl ProgressPresenter for SimplePresenter {
//!     fn start(&mut self, progress: &[Progress]) {
//!         println!("Starting...");
//!     }
//!
//!     fn update(&mut self, progress: &[Progress]) {
//!         for info in progress.iter() {
//!             println!("{} ({}/{})", info.current_title, info.current_step, info.max_steps);
//!         }
//!     }
//! }
//!
//! let connection = block_on(zbus::Connection::system()).unwrap();
//! let builder = ProgressMonitorBuilder::new(connection)
//!     .add_proxy("org.opensuse.Agama1", "/org/opensuse/Agama1/Manager");
//! let mut monitor = block_on(builder.build()).unwrap();
//! monitor.run(SimplePresenter {});
//! ```

use crate::proxies::ProgressProxy;
use futures::stream::StreamExt;
use futures::stream::{select_all, SelectAll};
use futures_util::future::try_join3;
use std::error::Error;
use zbus::{Connection, PropertyStream};

/// Represents the progress for an Agama service.
#[derive(Default, Debug)]
pub struct Progress {
    /// Current step
    pub current_step: u32,
    /// Number of steps
    pub max_steps: u32,
    /// Title of the current step
    pub current_title: String,
    /// Whether the progress reporting is finished
    pub finished: bool,
    /// D-Bus path that reports the progress
    pub object_path: String,
}

impl Progress {
    pub async fn from_proxy(proxy: &crate::proxies::ProgressProxy<'_>) -> zbus::Result<Progress> {
        let ((current_step, current_title), max_steps, finished) =
            try_join3(proxy.current_step(), proxy.total_steps(), proxy.finished()).await?;

        Ok(Self {
            current_step,
            current_title,
            max_steps,
            finished,
            object_path: proxy.path().to_string(),
        })
    }
}

pub struct ProgressMonitorBuilder {
    proxies: Vec<(String, String)>,
    connection: Connection,
}

/// Builds a [ProgressMonitor] for a set of services. See [build_progress_monitor] for a usage
/// example.
impl<'a> ProgressMonitorBuilder {
    pub fn new(connection: Connection) -> Self {
        Self {
            proxies: vec![],
            connection,
        }
    }

    pub fn add_proxy(mut self, destination: &str, path: &str) -> Self {
        self.proxies.push((destination.to_owned(), path.to_owned()));
        self
    }

    pub async fn build(self) -> Result<ProgressMonitor<'a>, Box<dyn Error>> {
        let mut monitor = ProgressMonitor::default();

        for (destination, path) in self.proxies {
            let proxy = ProgressProxy::builder(&self.connection)
                .path(path)?
                .destination(destination)?
                .build()
                .await?;
            monitor.add_proxy(proxy);
        }
        Ok(monitor)
    }
}

/// Monitorizes and reports the progress of Agama's current operation.
#[derive(Default)]
pub struct ProgressMonitor<'a> {
    pub proxies: Vec<ProgressProxy<'a>>,
}

impl<'a> ProgressMonitor<'a> {
    pub fn add_proxy(&mut self, proxy: ProgressProxy<'a>) {
        self.proxies.push(proxy);
    }

    /// Starts the progress monitor.
    ///
    /// It stops when all the services report that their current operations are finished.
    pub async fn run(
        &mut self,
        mut presenter: impl ProgressPresenter,
    ) -> Result<(), Box<dyn Error>> {
        let mut changes = self.build_stream().await;
        presenter.start(&self.collect_progress().await?);

        while let Some(_change) = changes.next().await {
            presenter.update(&self.collect_progress().await?);
            if self.is_finished().await {
                return Ok(());
            }
        }

        Ok(())
    }

    async fn is_finished(&self) -> bool {
        for proxy in &self.proxies {
            if !proxy.finished().await.unwrap_or(false) {
                return false;
            }
        }
        true
    }

    async fn collect_progress(&self) -> Result<Vec<Progress>, Box<dyn Error>> {
        let mut progress = vec![];
        for proxy in &self.proxies {
            let proxy_progress = Progress::from_proxy(proxy).await?;
            progress.push(proxy_progress);
        }
        Ok(progress)
    }

    async fn build_stream(&self) -> SelectAll<PropertyStream<(u32, String)>> {
        let mut streams = vec![];
        for proxy in &self.proxies {
            let s = proxy.receive_current_step_changed().await;
            streams.push(s);
        }

        select_all(streams)
    }
}

/// Presents the progress to the user.
pub trait ProgressPresenter {
    /// Indicates the start of the progress reporting.
    ///
    /// * `progress`: initial progress for each service.
    fn start(&mut self, progress: &[Progress]);

    /// Indicates an update on the progress reporting.
    ///
    /// * `progress`: updated progress for each service.
    fn update(&mut self, progress: &[Progress]);
}

/// Convenience function that builds a progress monitor for Agama services.
///
/// Bear in mind that only the services with long-running tasks are considered.
pub async fn build_progress_monitor(
    connection: Connection,
) -> Result<ProgressMonitor<'static>, Box<dyn Error>> {
    let builder = ProgressMonitorBuilder::new(connection)
        .add_proxy("org.opensuse.Agama1", "/org/opensuse/Agama1/Manager")
        .add_proxy(
            "org.opensuse.Agama.Software1",
            "/org/opensuse/Agama/Software1",
        )
        .add_proxy(
            "org.opensuse.Agama.Storage1",
            "/org/opensuse/Agama/Storage1",
        );
    builder.build().await
}
