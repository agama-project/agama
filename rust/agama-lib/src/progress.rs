use crate::proxies::ProgressProxy;
use futures::stream::StreamExt;
use futures::stream::{select_all, SelectAll};
use futures_util::future::try_join3;
use std::error::Error;
use zbus::{Connection, PropertyStream};

#[derive(Default, Debug)]
pub struct Progress {
    pub current_step: u32,
    pub max_steps: u32,
    pub current_title: String,
    pub finished: bool,
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

pub struct ProgressMonitorBuilder {
    proxies: Vec<(String, String)>,
    connection: Connection,
}

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

pub trait ProgressPresenter {
    fn start(&mut self, progress: &[Progress]);
    fn update(&mut self, progress: &[Progress]);
}

#[derive(Default)]
pub struct ProgressMonitor<'a> {
    pub proxies: Vec<ProgressProxy<'a>>,
}

impl<'a> ProgressMonitor<'a> {
    pub fn add_proxy(&mut self, proxy: ProgressProxy<'a>) {
        self.proxies.push(proxy);
    }

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
